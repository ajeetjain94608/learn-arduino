#!/usr/bin/env bash
# Builds the AVR toolchain the app compiles with — GCC 7.3.0 + Arduino's patch (cc1plus) and GNU binutils (as, ld,
# objcopy, readelf) — as WebAssembly, from the original GNU sources, with Emscripten.
# Run inside Linux (WSL Ubuntu 24.04):  bash tools/avr-wasm/build.sh [sources|binutils|hostlibs|gcc|install|all]
# Outputs: public/avr/toolchain/<tool>.mjs + <tool>.wasm and SOURCES.md (GPL corresponding-source notice).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="${RQ_WASM_WORK:-$HOME/rq-avr-wasm}"   # Linux filesystem: much faster than /mnt/c
OUT="$REPO/public/avr/toolchain"
JOBS="${JOBS:-$(nproc)}"

EMSDK_VERSION=4.0.10
GCC_V=7.3.0
BINUTILS_V=2.42
GMP_V=6.2.1
MPFR_V=4.1.0
MPC_V=1.2.1
ARDUINO_TAG=7.3.0-atmel3.6.1-arduino7
ARDUINO_PATCH=atmel-patches-gcc.7.3.0-arduino2.patch

declare -A URL=(
  [gcc]="https://ftp.gnu.org/gnu/gcc/gcc-$GCC_V/gcc-$GCC_V.tar.xz"
  [binutils]="https://ftp.gnu.org/gnu/binutils/binutils-$BINUTILS_V.tar.xz"
  [gmp]="https://ftp.gnu.org/gnu/gmp/gmp-$GMP_V.tar.xz"
  [mpfr]="https://ftp.gnu.org/gnu/mpfr/mpfr-$MPFR_V.tar.xz"
  [mpc]="https://ftp.gnu.org/gnu/mpc/mpc-$MPC_V.tar.gz"
  [patch]="https://raw.githubusercontent.com/arduino/toolchain-avr/$ARDUINO_TAG/avr-gcc-patches/$ARDUINO_PATCH"
)
SUMS="$REPO/tools/avr-wasm/SHA256SUMS"   # recorded on the first download, verified on every later one

# Final link: an ES module exporting a factory; the app creates one instance per run (callMain, then discard).
EM_LINK="-O2 -sALLOW_MEMORY_GROWTH=1 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createTool -sFORCE_FILESYSTEM=1 \
-sINVOKE_RUN=0 -sEXIT_RUNTIME=1 -sENVIRONMENT=web,worker,node -sEXPORTED_RUNTIME_METHODS=FS,callMain -sSTACK_SIZE=8MB"

# shellcheck disable=SC1091
source "$HOME/emsdk/emsdk_env.sh" > /dev/null 2>&1
[[ "$(emcc --version | head -1)" == *"$EMSDK_VERSION"* ]] || { echo "Emscripten $EMSDK_VERSION required"; exit 1; }
mkdir -p "$WORK/src" "$OUT"

# Emscripten's libc has these; libiberty's cross-compile guesses say otherwise and redefines them.
export ac_cv_func_psignal=yes ac_cv_func_strsignal=yes

fetch() { # name → verified file in $WORK/src
  local name=$1 file; file="$WORK/src/$(basename "${URL[$name]}")"
  [[ -f "$file" ]] || wget -q -O "$file" "${URL[$name]}"
  local sum; sum="$(sha256sum "$file" | cut -d' ' -f1)"
  local base; base="$(basename "$file")"
  if grep -q " $base\$" "$SUMS" 2>/dev/null; then
    grep -q "^$sum  $base\$" "$SUMS" || { echo "CHECKSUM MISMATCH: $base"; exit 1; }
  else echo "$sum  $base" >> "$SUMS"; fi
  echo "$file"
}

stage_sources() {
  cd "$WORK/src"
  for n in gcc binutils gmp mpfr mpc patch; do fetch "$n" > /dev/null; done
  [[ -d gcc-$GCC_V ]] || { tar xf "gcc-$GCC_V.tar.xz"; (cd "gcc-$GCC_V" && patch -p1 < "../$ARDUINO_PATCH"); }
  [[ -d binutils-$BINUTILS_V ]] || tar xf "binutils-$BINUTILS_V.tar.xz"
  [[ -d gmp-$GMP_V ]] || tar xf "gmp-$GMP_V.tar.xz"
  [[ -d mpfr-$MPFR_V ]] || tar xf "mpfr-$MPFR_V.tar.xz"
  [[ -d mpc-$MPC_V ]] || tar xf "mpc-$MPC_V.tar.gz"
}

stage_binutils() {
  rm -rf "$WORK/build-binutils"; mkdir -p "$WORK/build-binutils"; cd "$WORK/build-binutils"
  # --prefix=/sysroot (like GCC): ld then finds its default scripts in /sysroot/avr/lib/ldscripts
  emconfigure "../src/binutils-$BINUTILS_V/configure" --build=x86_64-pc-linux-gnu --host=i686-pc-linux-gnu --target=avr --prefix=/sysroot \
    --disable-nls --disable-werror --disable-gdb --disable-gdbserver --disable-sim --disable-gprof --disable-gprofng \
    --disable-plugins --disable-shared --enable-static --disable-libctf --without-zstd --without-debuginfod \
    CC_FOR_BUILD=gcc CFLAGS="-O2" LDFLAGS="$EM_LINK" > configure.log 2>&1
  emmake make -j"$JOBS" all-gas all-ld all-binutils > make.log 2>&1
}

stage_hostlibs() { # GMP, MPFR, MPC for the WebAssembly host (generic C, no assembly)
  local P="$WORK/hostlibs"; rm -rf "$P" "$WORK/build-gmp" "$WORK/build-mpfr" "$WORK/build-mpc"
  mkdir -p "$WORK/build-gmp" && cd "$WORK/build-gmp"
  emconfigure "../src/gmp-$GMP_V/configure" --host=none --build=x86_64-pc-linux-gnu --disable-assembly --disable-shared --enable-static \
    --prefix="$P" CC_FOR_BUILD=gcc > configure.log 2>&1 && emmake make -j"$JOBS" install > make.log 2>&1
  mkdir -p "$WORK/build-mpfr" && cd "$WORK/build-mpfr"
  emconfigure "../src/mpfr-$MPFR_V/configure" --host=none --build=x86_64-pc-linux-gnu --disable-shared --enable-static \
    --with-gmp="$P" --prefix="$P" > configure.log 2>&1 && emmake make -j"$JOBS" install > make.log 2>&1
  mkdir -p "$WORK/build-mpc" && cd "$WORK/build-mpc"
  emconfigure "../src/mpc-$MPC_V/configure" --host=none --build=x86_64-pc-linux-gnu --disable-shared --enable-static \
    --with-gmp="$P" --with-mpfr="$P" --prefix="$P" > configure.log 2>&1 && emmake make -j"$JOBS" install > make.log 2>&1
}

stage_gcc() { # only cc1plus is needed (the app runs the compiler proper, as and ld itself — no gcc driver)
  local P="$WORK/hostlibs"; mkdir -p "$WORK/build-gcc"; cd "$WORK/build-gcc"
  # Same configuration as Arduino's avr-gcc 7.3.0-atmel3.6.1-arduino7 (see `avr-gcc -v`), built for a 32-bit host
  # (wasm32 is ILP32 like i686). --prefix=/sysroot: where the app mounts the sysroot, so built-in paths resolve.
  # (configured once; delete $WORK/build-gcc to start over)
  [[ -f Makefile ]] || emconfigure "../src/gcc-$GCC_V/configure" --build=x86_64-pc-linux-gnu --host=i686-pc-linux-gnu --target=avr --prefix=/sysroot \
    --enable-fixed-point --enable-languages=c,c++ --disable-nls --disable-libssp --disable-libada --disable-shared \
    --with-avrlibc=yes --with-dwarf2 --disable-doc --disable-plugin --disable-lto --without-isl --disable-bootstrap \
    --with-gmp="$P" --with-mpfr="$P" --with-mpc="$P" \
    CC_FOR_BUILD=gcc CXX_FOR_BUILD=g++ CFLAGS="-O2" CXXFLAGS="-O2 -std=gnu++98 -Wno-register -Wno-deprecated" LDFLAGS="$EM_LINK" > configure.log 2>&1
  # host (WebAssembly) libraries, plus the build machine's own libiberty/libcpp for GCC's generator programs
  emmake make -j"$JOBS" configure-gcc all-libiberty all-libcpp all-libdecnumber all-libbacktrace \
    all-build-libiberty all-build-libcpp all-build-fixincludes > make-libs.log 2>&1
  # GCC's own configure leaves its generator programs on the host compiler; they must be native Linux programs
  emmake make -j"$JOBS" -C gcc cc1plus CC_FOR_BUILD=gcc CXX_FOR_BUILD=g++ CFLAGS_FOR_BUILD="-O2" \
    CXXFLAGS_FOR_BUILD="-O2 -std=gnu++11" LDFLAGS_FOR_BUILD="" ZLIB="-sUSE_ZLIB=1" > make-cc1plus.log 2>&1
}

stage_install() {
  local B="$WORK/build-binutils"
  cp "$WORK/build-gcc/gcc/cc1plus" "$OUT/cc1plus.mjs"; cp "$WORK/build-gcc/gcc/cc1plus.wasm" "$OUT/cc1plus.wasm"
  cp "$B/gas/as-new" "$OUT/as.mjs";              cp "$B/gas/as-new.wasm" "$OUT/as.wasm"
  cp "$B/ld/ld-new" "$OUT/ld.mjs";               cp "$B/ld/ld-new.wasm" "$OUT/ld.wasm"
  cp "$B/binutils/objcopy" "$OUT/objcopy.mjs";   cp "$B/binutils/objcopy.wasm" "$OUT/objcopy.wasm"
  cp "$B/binutils/readelf" "$OUT/readelf.mjs";   cp "$B/binutils/readelf.wasm" "$OUT/readelf.wasm"
  # the linker's default scripts for the ATmega328P's architecture (generated by this binutils build)
  mkdir -p "$OUT/ldscripts"; cp "$B"/ld/ldscripts/avr5.* "$OUT/ldscripts/"
  # the licences travel with the binaries (GPL 3 for GCC/binutils, LGPL 3 for GMP/MPFR/MPC)
  mkdir -p "$OUT/LICENSES"; cp "$WORK/src/gcc-$GCC_V/COPYING3" "$WORK/src/gcc-$GCC_V/COPYING3.LIB" "$OUT/LICENSES/"
  {
    echo "# Corresponding source — AVR toolchain (WebAssembly)"
    echo
    echo "The files in this folder are GNU GCC $GCC_V (cc1plus, with Arduino's \`$ARDUINO_PATCH\` from"
    echo "arduino/toolchain-avr tag $ARDUINO_TAG) and GNU binutils $BINUTILS_V (as, ld, objcopy, readelf), licensed under the"
    echo "GNU General Public License version 3, compiled to WebAssembly with Emscripten $EMSDK_VERSION by"
    echo "\`tools/avr-wasm/build.sh\` (that script is the complete build recipe). GMP $GMP_V, MPFR $MPFR_V and MPC $MPC_V"
    echo "(GNU LGPL 3) are linked in. Programs compiled with this compiler are covered by the GCC Runtime Library Exception."
    echo
    echo "Licence texts: \`LICENSES/COPYING3\` (GNU GPL 3) and \`LICENSES/COPYING3.LIB\` (GNU LGPL 3)."
    echo
    echo "| File | SHA-256 | Download |"
    echo "|---|---|---|"
    for n in gcc binutils gmp mpfr mpc patch; do
      local base; base="$(basename "${URL[$n]}")"
      echo "| $base | \`$(grep " $base\$" "$SUMS" | cut -d' ' -f1)\` | ${URL[$n]} |"
    done
  } > "$OUT/SOURCES.md"
  ls -la "$OUT"
}

for s in "${@:-all}"; do
  case "$s" in
    all) stage_sources; stage_binutils; stage_hostlibs; stage_gcc; stage_install ;;
    sources|binutils|hostlibs|gcc|install) "stage_$s" ;;
    *) echo "unknown stage $s"; exit 1 ;;
  esac
done

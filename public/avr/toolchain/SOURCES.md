# Corresponding source — AVR toolchain (WebAssembly)

The files in this folder are GNU GCC 7.3.0 (cc1plus, with Arduino's `atmel-patches-gcc.7.3.0-arduino2.patch` from
arduino/toolchain-avr tag 7.3.0-atmel3.6.1-arduino7) and GNU binutils 2.42 (as, ld, objcopy, readelf), licensed under the
GNU General Public License version 3, compiled to WebAssembly with Emscripten 4.0.10 by
`tools/avr-wasm/build.sh` (that script is the complete build recipe). GMP 6.2.1, MPFR 4.1.0 and MPC 1.2.1
(GNU LGPL 3) are linked in. Programs compiled with this compiler are covered by the GCC Runtime Library Exception.

Licence texts: `LICENSES/COPYING3` (GNU GPL 3) and `LICENSES/COPYING3.LIB` (GNU LGPL 3).

| File | SHA-256 | Download |
|---|---|---|
| gcc-7.3.0.tar.xz | `832ca6ae04636adbb430e865a1451adf6979ab44ca1c8374f61fba65645ce15c` | https://ftp.gnu.org/gnu/gcc/gcc-7.3.0/gcc-7.3.0.tar.xz |
| binutils-2.42.tar.xz | `f6e4d41fd5fc778b06b7891457b3620da5ecea1006c6a4a41ae998109f85a800` | https://ftp.gnu.org/gnu/binutils/binutils-2.42.tar.xz |
| gmp-6.2.1.tar.xz | `fd4829912cddd12f84181c3451cc752be224643e87fac497b69edddadc49b4f2` | https://ftp.gnu.org/gnu/gmp/gmp-6.2.1.tar.xz |
| mpfr-4.1.0.tar.xz | `0c98a3f1732ff6ca4ea690552079da9c597872d30e96ec28414ee23c95558a7f` | https://ftp.gnu.org/gnu/mpfr/mpfr-4.1.0.tar.xz |
| mpc-1.2.1.tar.gz | `17503d2c395dfcf106b622dc142683c1199431d095367c6aacba6eec30340459` | https://ftp.gnu.org/gnu/mpc/mpc-1.2.1.tar.gz |
| atmel-patches-gcc.7.3.0-arduino2.patch | `96782c75dd11e994e1ab9250c41fc5cd81ba65bbcf44383cd9d660d01cc85f97` | https://raw.githubusercontent.com/arduino/toolchain-avr/7.3.0-atmel3.6.1-arduino7/avr-gcc-patches/atmel-patches-gcc.7.3.0-arduino2.patch |

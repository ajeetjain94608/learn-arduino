// Native AVR toolchain installed with the Arduino IDE (build-time only: precompiling the core, recording the
// tool command lines, building test fixtures). The app itself never uses it.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ARDUINO15 = join(process.env.LOCALAPPDATA ?? join(process.env.HOME ?? '', '.arduino15'), 'Arduino15');
export const GCC_DIR = process.env.AVR_GCC_DIR ?? join(ARDUINO15, 'packages/arduino/tools/avr-gcc/7.3.0-atmel3.6.1-arduino7');
export const CORE_DIR = process.env.AVR_CORE_DIR ?? join(ARDUINO15, 'packages/arduino/hardware/avr/1.8.7');

const exe = process.platform === 'win32' ? '.exe' : '';
const bin = (name) => join(GCC_DIR, 'bin', `avr-${name}${exe}`);

export const nativeTools = () => ({
  gcc: bin('gcc'), gpp: bin('g++'), ar: bin('ar'), objcopy: bin('objcopy'), objdump: bin('objdump'), readelf: bin('readelf'),
});
export const nativeAvailable = () => existsSync(nativeTools().gpp) && existsSync(join(CORE_DIR, 'cores/arduino/Arduino.h'));

// Uno build settings (boards.txt uno.* + platform.txt 1.8.7), without link-time optimisation: the WASM toolchain has
// no lto1, so the precompiled core and every sketch are built the same way.
export const MCU = ['-mmcu=atmega328p', '-DF_CPU=16000000L', '-DARDUINO=10819', '-DARDUINO_AVR_UNO', '-DARDUINO_ARCH_AVR'];
export const INCLUDES = [`-I${join(CORE_DIR, 'cores/arduino')}`, `-I${join(CORE_DIR, 'variants/standard')}`];
export const C_FLAGS = ['-c', '-g', '-Os', '-w', '-std=gnu11', '-ffunction-sections', '-fdata-sections'];
export const CPP_FLAGS = ['-c', '-g', '-Os', '-std=gnu++11', '-fpermissive', '-fno-exceptions', '-ffunction-sections', '-fdata-sections', '-fno-threadsafe-statics', '-Wno-error=narrowing'];
// Learner sketches only: keep every call a real call (no tail-call jumps) so the running line can always be found
// from the stack's return addresses (src/sim/avr/sourceLine.ts). Costs a few bytes.
export const SKETCH_FLAGS = ['-fno-optimize-sibling-calls'];
export const S_FLAGS = ['-c', '-g', '-x', 'assembler-with-cpp'];
export const LINK_FLAGS = ['-Os', '-g', '-Wl,--gc-sections', '-mmcu=atmega328p'];

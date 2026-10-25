import type { Compiler } from './types';

// The compiler the app uses. Each platform installs its own (GCC as WebAssembly on Android and the web); tests
// install a stand-in. Until one is installed, compiling reports that the compiler is not available.
const unavailable: Compiler = { compile: () => Promise.reject(new Error('The compiler is not available yet.')) };
let current: Compiler = unavailable;

export const setCompiler = (c: Compiler): void => { current = c; };
export const getCompiler = (): Compiler => current;

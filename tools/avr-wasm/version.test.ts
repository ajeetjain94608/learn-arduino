// @vitest-environment node
import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { TOOLCHAIN_VERSION } from '../../src/build/compiler/toolchainVersion';
import { toolchainHash } from './toolchainHash.mjs';

it.skipIf(!existsSync('public/avr/uno/sysroot.tar'))('the app’s toolchain version matches the toolchain files (run npm run avr:sysroot after a rebuild)', () => {
  expect(TOOLCHAIN_VERSION).toBe(toolchainHash());
});

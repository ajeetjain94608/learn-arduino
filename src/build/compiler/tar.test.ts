// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { makeTar, readTar } from './tar';

describe('tar (the sysroot archive)', () => {
  it('round-trips files, including long paths and empty files', () => {
    const enc = new TextEncoder();
    const files = {
      'avr/include/avr/io.h': enc.encode('#include <avr/iom328p.h>\n'),
      'lib/gcc/avr/7.3.0/include/stdint-gcc.h': enc.encode('x'.repeat(1000)),
      ['core/' + 'deep/'.repeat(30) + 'long-name-header.h']: enc.encode('/* long */'),
      'empty.h': new Uint8Array(0),
    };
    const back = readTar(makeTar(files));
    expect(Object.keys(back).sort()).toEqual(Object.keys(files).sort());
    for (const [k, v] of Object.entries(files)) expect(back[k]).toEqual(v);
  });

  it('rejects a damaged archive', () => {
    const tar = makeTar({ 'a.h': new TextEncoder().encode('a') });
    tar[148] = 0x41; // corrupt the header checksum
    expect(() => readTar(tar)).toThrow(/checksum/);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { BLINK } from '../content/sketches/blink';
import { useWorkbenchStore } from './workbenchStore';

const s = () => useWorkbenchStore.getState();

describe('workbench store: program and serial', () => {
  beforeEach(() => { s().clearSerial(); s().setRunning(false); });

  it('starts with the shipped Blink program', () => {
    expect(s().program).toBe(BLINK.program);
  });

  it('serial text joins partial lines and drops carriage returns', () => {
    s().appendSerialText('LED o');
    s().appendSerialText('n\r\nLED off\r\nHI');
    expect(s().serial).toEqual(['LED on', 'LED off', 'HI']);
    s().appendSerialText('!\n');
    expect(s().serial).toEqual(['LED on', 'LED off', 'HI!']);
    s().appendSerialText('next\n');
    expect(s().serial.at(-1)).toBe('next');
  });

  it('keeps only the last 200 lines', () => {
    s().appendSerialText('x\n'.repeat(450));
    expect(s().serial).toHaveLength(200);
  });

  it('text sent to the board waits in a queue until the board takes it', () => {
    s().serialSend('hi');
    s().serialSend('there');
    expect(s().takeSerialInput()).toBe('hi\nthere\n');
    expect(s().takeSerialInput()).toBe('');
  });

  it('loadProgram runs another program: upload first', () => {
    const p = { ...BLINK.program, hex: ':00000001FF\n' };
    s().loadProgram(p);
    expect(s().program).toBe(p);
    expect(s().uploading).toBe(true);
    expect(s().running).toBe(true);
    s().loadProgram(BLINK.program);
  });
});

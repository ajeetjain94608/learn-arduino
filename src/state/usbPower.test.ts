import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimEngine } from '../sim/simEngine';
import { PLUG_MS, useWorkbenchStore } from './workbenchStore';

describe('the USB cable is the board\'s power', () => {
  afterEach(() => { vi.useRealTimers(); useWorkbenchStore.setState({ usb: true, plugging: false, running: false, uploading: false, compiling: false }); });

  it('Run plugs the cable in first, and the upload waits for it', () => {
    vi.useFakeTimers();
    useWorkbenchStore.setState({ usb: false });
    useWorkbenchStore.getState().upload();
    expect(useWorkbenchStore.getState()).toMatchObject({ usb: true, plugging: true, uploading: false });
    vi.advanceTimersByTime(PLUG_MS + 10);
    expect(useWorkbenchStore.getState().plugging).toBe(false);
    expect(useWorkbenchStore.getState().uploading).toBe(true);   // the shipped Blink sketch uploads at once
  });

  it('Stop while the cable is still going in cancels the upload; the cable stays in', () => {
    vi.useFakeTimers();
    useWorkbenchStore.setState({ usb: false });
    useWorkbenchStore.getState().upload();
    useWorkbenchStore.getState().setRunning(false);
    vi.advanceTimersByTime(PLUG_MS + 10);
    expect(useWorkbenchStore.getState()).toMatchObject({ usb: true, plugging: false, uploading: false });
  });

  it('with the cable out nothing in the circuit has power; plugged in, an LED on 5 V lights', () => {
    const e = new SimEngine();
    e.setCircuit({
      parts: [{ id: 'led1', type: 'led', params: { color: 'red' }, at: { col: 10, row: 'a' } }, { id: 'r1', type: 'resistor', params: { ohms: 220 }, at: { col: 11, row: 'b' } }],
      wires: [{ id: 'w1', from: 'uno.5V', to: 'bb.10c', color: '#000' }, { id: 'w2', from: 'bb.15c', to: 'uno.GND', color: '#000' }],
    });
    e.setPower(false);
    for (let t = 0; t < 50; t += 16) e.step(t, 1e9);
    expect(e.snapshot().circuit!.parts.led1.brightness).toBe(0);
    e.setPower(true);
    for (let t = 50; t < 100; t += 16) e.step(t, 1e9);
    expect(e.snapshot().circuit!.parts.led1.brightness).toBeGreaterThan(0.5);
  });
});

// What a wire shows while the board runs (the "Simulator" tags): GND, the supply voltage, HIGH / LOW on a digital pin,
// the analogRead() number on an analog pin, or the plain voltage.
const unoPin = (ref: string) => (ref.startsWith('uno.') ? ref.slice(4) : null);

export function wireLabel(from: string, to: string, volts: number): string {
  const pins = [unoPin(from), unoPin(to)].filter((p): p is string => p !== null);
  const bus = [from, to].find((r) => /.(SDA|SCL)$/.test(r)); // I²C: the line's name, not a pin reading
  if (bus) return bus.slice(bus.lastIndexOf('.') + 1);
  const analog = pins.find((p) => /^A[0-5]$/.test(p));
  if (analog) return `${analog} = ${Math.round(Math.min(5, Math.max(0, volts)) / 5 * 1023)}`;
  if (pins.some((p) => p === 'GND')) return 'GND';
  if (pins.some((p) => p === '5V' || p === '3V3' || p === 'VIN')) return `${Math.round(volts * 10) / 10} V`;
  if (pins.some((p) => /^D\d+$/.test(p))) return volts > 2.5 ? 'HIGH' : 'LOW';
  return `${volts.toFixed(2)} V`;
}

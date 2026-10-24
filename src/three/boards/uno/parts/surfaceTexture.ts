import { allPads, allSmd, LAYOUT, PIN_TRACES, UNO } from '../layout';

const DEG = Math.PI / 180;
const PWM = new Set(['3', '5', '6', '9', '10', '11']);
const COPPER = 'rgba(130,232,226,0.30)';
const TIN = '#D5DADF';

// Paints the top of the board at `px` pixels per mm: copper seen through the teal mask,
// tinned pads, the design's silkscreen, pin labels and our own board mark.
export function drawSurface(c: CanvasRenderingContext2D, px: number): void {
  const w = UNO.L * px, h = UNO.W * px;
  const X = (x: number) => x * px, Y = (y: number) => (UNO.W - y) * px;
  const line = (x1: number, y1: number, x2: number, y2: number, width: number) => {
    c.lineWidth = width * px; c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke();
  };
  const disc = (x: number, y: number, r: number, fill: string) => { c.fillStyle = fill; c.beginPath(); c.arc(X(x), Y(y), r * px, 0, Math.PI * 2); c.fill(); };

  c.clearRect(0, 0, w, h);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // copper: the whole top layer, plus digital-pin routes that run underneath so every pin visibly reaches the chip
  c.strokeStyle = COPPER;
  for (const [x1, y1, x2, y2, wd] of LAYOUT.copper) line(x1, y1, x2, y2, Math.max(wd, 0.2));
  for (const { segs } of Object.values(PIN_TRACES)) for (const [x1, y1, x2, y2, wd, layer] of segs) if (layer === 16) line(x1, y1, x2, y2, Math.max(wd, 0.25));

  // tented vias
  for (const [x, y, d] of LAYOUT.vias) { disc(x, y, d / 2 + 0.25, 'rgba(150,235,230,0.32)'); disc(x, y, d / 2, 'rgba(4,55,62,0.85)'); }

  // tinned SMD pads
  c.fillStyle = TIN;
  for (const p of allSmd()) {
    c.save(); c.translate(X(p.x), Y(p.y)); c.rotate(-p.rot * DEG);
    c.beginPath(); c.roundRect((-p.dx / 2) * px, (-p.dy / 2) * px, p.dx * px, p.dy * px, (Math.min(p.dx, p.dy) / 2) * px * (p.roundness / 100)); c.fill();
    c.restore();
  }
  // through-hole pads and drills
  for (const p of allPads()) {
    c.fillStyle = TIN; c.beginPath();
    if (p.shape === 'square') c.rect(X(p.x) - (p.diameter / 2) * px, Y(p.y) - (p.diameter / 2) * px, p.diameter * px, p.diameter * px);
    else c.arc(X(p.x), Y(p.y), (p.diameter / 2) * px, 0, Math.PI * 2);
    c.fill();
    disc(p.x, p.y, p.drill / 2, '#16191F');
  }
  // mounting-hole rings
  c.strokeStyle = TIN; c.lineWidth = 0.9 * px;
  for (const [x, y, d] of LAYOUT.holes) { c.beginPath(); c.arc(X(x), Y(y), (d / 2 + 0.45) * px, 0, Math.PI * 2); c.stroke(); }

  // silkscreen from the design (component outlines, header frames)
  c.strokeStyle = 'rgba(255,255,255,0.92)';
  for (const [x1, y1, x2, y2, wd] of LAYOUT.silk) line(x1, y1, x2, y2, Math.max(wd, 0.15));
  for (const [x, y, r, wd] of LAYOUT.silkCircles) { c.lineWidth = Math.max(wd, 0.15) * px; c.beginPath(); c.arc(X(x), Y(y), r * px, 0, Math.PI * 2); c.stroke(); }

  // labels
  c.fillStyle = 'rgba(255,255,255,0.95)';
  const txt = (s: string, x: number, y: number, size: number, rot = 0, align: CanvasTextAlign = 'left', weight = 800) => {
    c.save(); c.translate(X(x), Y(y)); c.rotate(-rot * DEG);
    c.font = `${weight} ${size * px}px system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0);
    c.restore();
  };
  for (const [x, y, size, rot, s] of LAYOUT.texts) if (/^\d+$/.test(s)) txt(PWM.has(s) ? `~${s}` : s, x + 0.55, y, size * 1.05, rot);
  for (const [s, x] of [['AREF', 23.876], ['GND', 26.416], ['SDA', 21.336], ['SCL', 18.796]] as const) txt(s, x, 49.0, 1.25, 270);
  for (const [s, x] of [['IOREF', 30.48], ['RESET', 33.02], ['3.3V', 35.56], ['5V', 38.1], ['GND', 40.64], ['GND', 43.18], ['VIN', 45.72],
    ['A0', 50.8], ['A1', 53.34], ['A2', 55.88], ['A3', 58.42], ['A4', 60.96], ['A5', 63.5]] as const) txt(s, x, 4.6, 1.25, 90);
  txt('POWER', 38.1, 10.2, 1.7, 0, 'center', 900);
  txt('ANALOG IN', 57.15, 10.2, 1.7, 0, 'center', 900);
  txt('DIGITAL (PWM~)', 52.0, 42.6, 1.55, 0, 'center', 900);
  txt('L', 29.6, 42.164, 1.3); txt('TX', 29.6, 36.576, 1.3); txt('RX', 29.6, 34.29, 1.3); txt('ON', 56.0, 36.576, 1.3, 0, 'right');
  txt('ICSP', 61.6, 27.94, 1.3, 90, 'center'); txt('ICSP', 18.288, 43.2, 1.1, 0, 'center');
  txt('RESET', 10.4, 49.4, 1.2);

  // our own generic board mark (never the Arduino name or logo)
  c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 0.32 * px;
  c.beginPath(); c.roundRect(X(35.0), Y(33.8), 16.5 * px, 6.0 * px, 3.0 * px); c.stroke();
  txt('UNO', 43.25, 30.8, 4.2, 0, 'center', 900);
  txt('MAKER BOARD · R3', 43.25, 26.6, 1.25, 0, 'center', 700);
}

import { describe, expect, it } from 'vitest';
import { preprocessSketch } from './preprocess';

// What line GCC would report for each line of the generated .cpp: follows `#line N "file"` directives.
function reportedLines(cpp: string): { file: string; line: number; text: string }[] {
  let file = 'sketch.cpp', line = 1;
  const out: { file: string; line: number; text: string }[] = [];
  for (const text of cpp.split('\n')) {
    const m = text.match(/^#line (\d+)(?: "([^"]+)")?/);
    if (m) { line = Number(m[1]); file = m[2] ?? file; continue; }
    out.push({ file, line, text });
    line++;
  }
  return out;
}
const lineOf = (cpp: string, needle: string) => reportedLines(cpp).find((l) => l.text.includes(needle));

describe('preprocessSketch', () => {
  it('adds Arduino.h', () => {
    expect(preprocessSketch('void setup() {}\nvoid loop() {}\n').cpp.split('\n')[0]).toBe('#include <Arduino.h>');
  });

  it('adds a prototype for a function defined after loop', () => {
    const { cpp } = preprocessSketch('void setup() {}\nvoid loop() { blinkTwice(3); }\nint blinkTwice(int times) {\n  return times;\n}\n');
    const proto = cpp.indexOf('int blinkTwice(int times);');
    expect(proto).toBeGreaterThan(-1);
    expect(proto).toBeLessThan(cpp.indexOf('void loop() {'));
    expect(lineOf(cpp, 'return times;')).toMatchObject({ file: 'sketch.ino', line: 4 });
  });

  it('does not duplicate an existing prototype', () => {
    const { cpp } = preprocessSketch('void helper(int x);\nvoid setup() { helper(1); }\nvoid loop() {}\nvoid helper(int x) {}\n');
    expect(cpp.match(/void helper\(int x\);/g)).toHaveLength(1);
  });

  it('ignores functions inside comments and strings', () => {
    const { cpp } = preprocessSketch('// void ghost() {}\n/* int phantom(int a) { return a; } */\nconst char* s = "void fake() {";\nvoid setup() {}\nvoid loop() {}\n');
    expect(cpp).not.toMatch(/ghost\(\);|phantom\(int a\);|fake\(\);/);
  });

  it('CRLF sketches map errors to the right line', () => {
    const ino = ['void setup() {', '  pinMode(13, OUTPUT);', '}', '', 'void loop() {', '  digitalWrite(13, HIGH);', '  delay(1000)', '}'].join('\r\n');
    const { cpp, userLine } = preprocessSketch(ino);
    expect(cpp).not.toContain('\r');
    expect(lineOf(cpp, 'delay(1000)')).toMatchObject({ file: 'sketch.ino', line: 7 });
    expect(userLine(7)).toBe(7);
    expect(userLine(99)).toBeNull();
  });

  it('default arguments move to the prototype, so calls before the definition can use them', () => {
    const { cpp } = preprocessSketch('void setup() { flash(); }\nvoid loop() {}\nvoid flash(int times = 3, int ms = 100) {}\n');
    expect(cpp).toContain('void flash(int times = 3, int ms = 100);');
    const def = cpp.split('\n').find((l) => l.startsWith('void flash(') && l.includes('{'))!;
    expect(def).not.toContain('=');
    expect(def.length).toBe('void flash(int times = 3, int ms = 100) {}'.length); // blanked, not removed: columns stay
  });

  it('keeps line numbers right when prototypes are inserted', () => {
    const ino = '#include <Servo.h>\nint led = 13;\n\nvoid setup() {\n  go();\n}\nvoid loop() {}\nvoid go() {\n  led++;\n}\n';
    const { cpp } = preprocessSketch(ino);
    for (const [needle, line] of [['int led = 13;', 2], ['  go();', 5], ['  led++;', 9]] as const) {
      expect(lineOf(cpp, needle), needle).toMatchObject({ file: 'sketch.ino', line });
    }
    expect(cpp).toContain('void go();');
  });
});

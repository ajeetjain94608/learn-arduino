// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n/en';
import { parseDiagnostics } from './diagnostics';
import { preprocessSketch } from './preprocess';

// the sketches these outputs came from (tools/avr/build-fixtures.mjs DIAGNOSTIC_CASES)
const SOURCES: Record<string, string> = {
  semicolon: 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH)\n  delay(1000);\n}\n',
  undeclared: 'void setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n}\n',
  brace: 'void setup() {\n  pinMode(13, OUTPUT);\n\nvoid loop() {\n  delay(10);\n}\n',
  noloop: 'void setup() {\n  pinMode(13, OUTPUT);\n}\n',
  warning: 'void setup() {\n  byte b = 300;\n  Serial.begin(9600);\n  Serial.println(b);\n}\n\nvoid loop() {\n}\n',
  missinglib: '#include <Servo.h>\n\nServo arm;\n\nvoid setup() {\n  arm.attach(9);\n}\n\nvoid loop() {\n}\n',
  note: 'void blinkTimes(int n) {\n  delay(n);\n}\n\nvoid setup() {\n  blinkTimes();\n}\n\nvoid loop() {\n}\n',
};
const parse = (name: string) => {
  const src = SOURCES[name];
  return parseDiagnostics(readFileSync(`src/build/compiler/fixtures/${name}.txt`, 'utf8'), preprocessSketch(src).userLine, src);
};

describe('parseDiagnostics', () => {
  it('missing semicolon points at the right line with the hint', () => {
    const [d, ...rest] = parse('semicolon');
    expect(rest).toHaveLength(0);
    // GCC reports the next statement (line 7); the semicolon is missing at the end of line 6
    expect(d).toMatchObject({ line: 6, col: '  digitalWrite(13, HIGH)'.length + 1, severity: 'error', hint: t('compile.hint.semicolon') });
    expect(d.message).toContain("expected ';'");
  });

  it('undeclared name', () => {
    const [d, ...rest] = parse('undeclared');
    expect(rest).toHaveLength(0);
    expect(d).toMatchObject({ line: 2, col: 11, severity: 'error', hint: t('compile.hint.undeclared') });
    expect(d.message).toContain('ledPin');
    expect(d.notes).toEqual([{ line: 2, message: "suggested alternative: 'ldiv'" }]);
  });

  it('unclosed brace', () => {
    const ds = parse('brace');
    expect(ds.length).toBeGreaterThanOrEqual(1);
    expect(ds.every((d) => d.severity === 'error')).toBe(true);
    expect(ds.some((d) => d.hint === t('compile.hint.brace'))).toBe(true);
  });

  it('missing loop is explained', () => {
    const ds = parse('noloop');
    expect(ds).toHaveLength(1); // the collect2 summary line is dropped
    expect(ds[0]).toMatchObject({ line: 1, col: 1, severity: 'error', hint: t('compile.hint.noLoop') });
  });

  it('a missing setup is explained', () => {
    const ds = parseDiagnostics("x.o: In function `main':\nmain.cpp:43: undefined reference to `setup'\ncollect2.exe: error: ld returned 1 exit status\n", (l) => l);
    expect(ds).toEqual([expect.objectContaining({ line: 1, severity: 'error', hint: t('compile.hint.noSetup') })]);
  });

  it('a program that does not fit is explained', () => {
    const ds = parseDiagnostics("ld.exe: sketch.elf section `.text' will not fit in region `text'\nld.exe: region `text' overflowed by 120 bytes\ncollect2.exe: error: ld returned 1 exit status\n", (l) => l);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ severity: 'error', hint: t('compile.hint.tooBig') });
  });

  it('a library that is not available is explained on its #include line', () => {
    const ds = parse('missinglib');
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ line: 1, col: 10, severity: 'error', hint: t('compile.hint.noLibrary') });
    expect(ds[0].message).toContain('Servo.h');
  });

  it('warnings are kept as warnings', () => {
    expect(parse('warning')).toEqual([expect.objectContaining({ line: 2, col: 12, severity: 'warning' })]);
  });

  it('notes attach to their error', () => {
    const ds = parse('note');
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ line: 6, severity: 'error' });
    expect(ds[0].notes).toEqual([{ line: 1, message: 'declared here' }]);
  });
});

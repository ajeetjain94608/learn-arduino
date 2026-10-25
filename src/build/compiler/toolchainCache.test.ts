import { describe, expect, it } from 'vitest';
import { cacheName, staleCaches, usableResponse } from './toolchainCache';

describe('the compiler cache', () => {
  it('is named after the toolchain version', () => {
    expect(cacheName('abc123')).toBe('rq-avr-abc123');
  });

  it('caches from other toolchain versions are the stale ones (other apps’ caches are left alone)', () => {
    expect(staleCaches(['rq-avr-v1', 'rq-avr-abc123', 'rq-avr-old', 'something-else'], 'abc123')).toEqual(['rq-avr-v1', 'rq-avr-old']);
  });

  it('never accepts an HTML page in place of a tool file (a host fallback for a missing file)', () => {
    expect(usableResponse(new Response('x', { status: 200, headers: { 'content-type': 'application/wasm' } }))).toBe(true);
    expect(usableResponse(new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }))).toBe(false);
    expect(usableResponse(new Response('nope', { status: 404 }))).toBe(false);
  });
});

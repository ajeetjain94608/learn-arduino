import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash } from './route';

describe('page addresses', () => {
  it('each page has its own address, and reading it back gives the same page', () => {
    const routes = [
      { page: 'home' }, { page: 'projects' }, { page: 'project', id: 'night-light' },
      { page: 'components' }, { page: 'component', type: 'servo' }, { page: 'build' },
    ] as const;
    for (const r of routes) expect(parseRoute(routeHash(r))).toEqual(r);
    expect(routeHash({ page: 'project', id: 'blink' })).toBe('#/projects/blink');
  });
  it('anything unknown is Home', () => {
    for (const h of ['', '#', '#/', '#/nope', '#/projects/a/b', 'garbage']) expect(parseRoute(h)).toEqual({ page: 'home' });
  });
});

describe('malformed addresses never break the app', () => {
  it('a broken percent-escape is just an unknown page', () => {
    for (const h of ['#/projects/%E0%A4%A', '#/components/%', '#/projects/%zz']) expect(() => parseRoute(h)).not.toThrow();
    expect(parseRoute('#/projects/%E0%A4%A')).toEqual({ page: 'projects' });
    expect(parseRoute('#/components/%')).toEqual({ page: 'components' });
  });
});

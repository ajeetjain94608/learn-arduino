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

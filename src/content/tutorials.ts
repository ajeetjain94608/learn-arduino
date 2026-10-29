// The written tutorial of a project (learnarduino.tech/learn/<slug>/), where there is one. Kept in step with content/learn by a
// test (tools/learn/build.test.ts): each tutorial that names a project is listed here.
export const TUTORIALS: Record<string, string> = {
  blink: 'blink-an-led',
  distance: 'measure-distance-hc-sr04',
};
export const tutorialUrl = (projectId: string) => (TUTORIALS[projectId] ? `/learn/${TUTORIALS[projectId]}/` : null);

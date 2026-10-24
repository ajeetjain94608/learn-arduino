// Every user-facing string lives here so the app can be translated later.
export const en = {
  'app.name': 'RoboQuest',
  'credits.boardLayout': 'Board layout based on Arduino UNO Rev3 design files (CC BY-SA 4.0)',
} as const;

export type StringKey = keyof typeof en;

export function t(key: StringKey): string {
  return en[key];
}

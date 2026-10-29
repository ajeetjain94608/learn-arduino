// The written tutorial of each project (learnarduino.tech/learn/<slug>/). Kept in step with content/learn by a test
// (tools/learn/build.test.ts): every tutorial that names a project is listed here.
export const TUTORIALS: Record<string, string> = {
  'board': 'meet-the-arduino-uno-board',
  'blink': 'blink-an-led',
  'button': 'push-button-arduino',
  'knob': 'potentiometer-arduino',
  'rgb': 'rgb-led-arduino',
  'night-light': 'night-light-ldr-arduino',
  'distance': 'measure-distance-hc-sr04',
  'tune': 'play-a-tune-buzzer-arduino',
  'piano': 'arduino-piano-buttons-buzzer',
  'motor': 'dc-motor-transistor-arduino',
  'thermostat': 'arduino-thermostat-tmp36-fan',
  'servo': 'servo-motor-arduino',
  'wheel': 'stepper-motor-arduino',
  'plant': 'plant-watering-monitor-soil-sensor-oled',
  'strength': 'force-sensor-strength-tester-arduino',
  'parking': 'arduino-parking-sensor',
};
export const tutorialUrl = (projectId: string) => (TUTORIALS[projectId] ? `/learn/${TUTORIALS[projectId]}/` : null);

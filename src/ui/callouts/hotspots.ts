import * as THREE from 'three';
import { t, type StringKey } from '../../i18n/en';
import { boardToLocal, element, headerPin } from '../../three/boards/uno/layout';
import { HEADER_H } from '../../three/boards/uno/parts/Headers';
import { BB, colX, ROW, holeLocal } from '../../three/breadboard/breadboardGeometry';
import { LED_Y0 } from '../../three/parts/Led5mm';
import { BLINK } from '../../three/scenes/blinkLayout';
import type { View } from '../../three/workbench/cameraViews';

export type Hotspot = {
  id: string;
  // the strings, by key (the UNO and the Blink circuit)…
  nameKey?: StringKey;
  subKey?: StringKey;
  textKey?: StringKey;
  // …or written out (the parts of the other projects, from the component library)
  name?: string;
  sub?: string;
  text?: string;
  view?: View;              // only shown in this view (both when omitted)
  offset: [number, number]; // card offset from the anchor, px at full size
  anchor: () => THREE.Vector3;
};

// the label's strings, however they were given
export const hotName = (h: Hotspot) => h.name ?? (h.nameKey ? t(h.nameKey) : '');
export const hotSub = (h: Hotspot) => h.sub ?? (h.subKey ? t(h.subKey) : '');
export const hotText = (h: Hotspot) => h.text ?? (h.textKey ? t(h.textKey) : '');

const onBoard = (x: number, y: number, h: number) => new THREE.Vector3(...boardToLocal(x, y, h)).add(new THREE.Vector3(...BLINK.board));
const onBreadboard = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(new THREE.Vector3(...BLINK.breadboard));
const keys = (k: string) => ({ nameKey: `hot.${k}.name`, subKey: `hot.${k}.sub`, textKey: `hot.${k}.text` }) as Pick<Hotspot, 'nameKey' | 'subKey' | 'textKey'>;

export const HOTSPOTS: Hotspot[] = [
  { id: 'usb', ...keys('usb'), view: 'board', offset: [-120, -10], anchor: () => onBoard(1.8, element('X2').y, 10.8) },
  { id: 'mcu', ...keys('mcu'), view: 'board', offset: [70, 105], anchor: () => onBoard(element('ZU4').x - 8, element('ZU4').y, 5.3) },
  { id: 'digital', ...keys('digital'), view: 'board', offset: [40, -80], anchor: () => onBoard(56, headerPin('13').y, HEADER_H) },
  { id: 'jack', ...keys('jack'), view: 'board', offset: [-100, 40], anchor: () => onBoard(-2.6, element('X1').y, 6) },
  { id: 'power', ...keys('power'), view: 'board', offset: [-120, 70], anchor: () => onBoard(headerPin('5V').x, headerPin('5V').y, HEADER_H) },
  { id: 'analog', ...keys('analog'), view: 'board', offset: [150, 30], anchor: () => onBoard(57, headerPin('A0').y, HEADER_H) },
  { id: 'reset', ...keys('reset'), view: 'board', offset: [10, -85], anchor: () => onBoard(element('RESET').x, element('RESET').y, 2.1) },
  { id: 'led', ...keys('led'), view: 'circuit', offset: [-20, -95], anchor: () => {
    const [ax, , z] = holeLocal(...BLINK.ledAnode), [kx] = holeLocal(...BLINK.ledCathode);
    return onBreadboard((ax + kx) / 2, LED_Y0 + 6.5, z);
  } },
  { id: 'resistor', ...keys('resistor'), view: 'circuit', offset: [95, -60], anchor: () => {
    const [x1, , z] = holeLocal(...BLINK.resistorFrom), [x2] = holeLocal(...BLINK.resistorTo);
    return onBreadboard((x1 + x2) / 2, BB.H + 4.6, z);
  } },
  { id: 'breadboard', ...keys('breadboard'), view: 'circuit', offset: [60, 80], anchor: () => onBreadboard(colX(24), BB.H, ROW.h) },
];

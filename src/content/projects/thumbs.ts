import type { ComponentId } from '../components';

// The picture of each component on its own, baked from the real 3D scene (npm run bake:components).
const urls = import.meta.glob('../../assets/components/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const componentThumb = (id: string): string | undefined => urls[`../../assets/components/${id}.png`];

// The one component each project is about: its card shows that part (the LED for Blink, the distance sensor for
// Measure distance …), not the whole bench.
export const MAIN_COMPONENT: Record<string, ComponentId> = {
  board: 'uno', blink: 'led', button: 'button', knob: 'pot', rgb: 'rgb', 'night-light': 'ldr', distance: 'hcsr04', tune: 'buzzer',
  piano: 'button', motor: 'motor', thermostat: 'tmp36', servo: 'servo', wheel: 'stepper', plant: 'soil', strength: 'fsr', parking: 'traffic',
};
export const projectThumb = (id: string): string | undefined => componentThumb(MAIN_COMPONENT[id] ?? '');

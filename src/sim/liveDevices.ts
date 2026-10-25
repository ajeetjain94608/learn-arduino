import type { DeviceState } from './devices';

// The modules' latest state from the simulator (servo angle, buzzer note, stepper position, OLED picture), updated
// by SimClock every frame. 3D models and the buzzer's sound read it in their own frame loop, so a moving servo
// doesn't re-render the page 60 times a second.
export const liveDevices: { states: Record<string, DeviceState> } = { states: {} };

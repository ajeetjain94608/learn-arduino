import { environmentFromBuffer } from './bakedEnvironment';
import envUrl from './env/room-env.bin?url';

// Loaded once before the 3D scene mounts, so materials compile with their reflections from the first frame.
export const ROOM_ENV = environmentFromBuffer(await (await fetch(envUrl)).arrayBuffer());

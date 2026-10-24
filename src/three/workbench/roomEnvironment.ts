import { loadBakedEnvironment } from './bakedEnvironment';
import envUrl from './env/room-env.bin?url';

// Loaded once before the 3D scene mounts, so materials compile with their reflections from the first frame.
// null if the file can't be loaded: the scene still works, only metal reflections are lost.
export const ROOM_ENV = await loadBakedEnvironment(envUrl);

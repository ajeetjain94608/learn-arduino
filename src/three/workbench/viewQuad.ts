// The part of the table the camera is looking at, as four corners on the table (x, z, in mm), kept by the camera rig every frame
// and read by the table map in the corner of the view. Not React state: it changes all the time while the camera moves.
export const viewQuad: { pts: [number, number][] | null } = { pts: null };

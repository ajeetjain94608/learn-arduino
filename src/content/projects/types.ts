import type { BuildStart } from '../../state/buildStore';

// A ready-made project: its text (our own words), and the build it opens with — parts, wires, input values and
// code — which the learner can run, change, and reset.
export type Project = {
  id: string;
  title: string;
  summary: string;      // one line for its card
  about: string;        // what it is and how it works
  learn: string[];      // what you learn
  tryIt: string[];      // what to do with it
  build: BuildStart;
};

// wire helper for project files: colour by role
const COLOR = { power: '#E2483D', ground: '#2B2F38', signal: '#F28C16', data: '#2563EB', extra: '#10B981', other: '#8B5CF6' } as const;
let n = 0;
export const wire = (from: string, to: string, role: keyof typeof COLOR = 'signal') => ({ id: `w${++n}`, from, to, color: COLOR[role] });

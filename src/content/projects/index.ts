import { BASICS } from './basics';
import { MORE } from './more';
import type { Project } from './types';

export type { Project } from './types';

// The 16 ready-made projects, in the order a beginner takes them.
export const PROJECTS: Project[] = [...BASICS, ...MORE];
export const projectById = (id: string) => PROJECTS.find((p) => p.id === id);

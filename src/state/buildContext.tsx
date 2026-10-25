import { createContext, useContext } from 'react';
import { useBuildStore, type BuildState, type BuildStore } from './buildStore';

// Which build the Build screen is showing: the learner's free build, or a project's own copy. Every panel reads the
// build through this, so the same screen works for both.
export const BuildStoreContext = createContext<BuildStore>(useBuildStore);

export function useBuild<T>(select: (s: BuildState) => T): T {
  return useContext(BuildStoreContext)(select);
}
export const useBuildApi = (): BuildStore => useContext(BuildStoreContext);

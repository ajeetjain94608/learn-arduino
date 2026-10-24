// Key-value storage that never throws: WebViews in private mode or with full storage
// can throw on any access, and the app must keep working with defaults.
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // not persisted; the in-memory state still applies for this session
    }
  },
};

// The compiler's offline cache (Cache Storage) is named after the toolchain version, so an updated compiler
// replaces the old files instead of mixing with them.
const PREFIX = 'rq-avr-';
export const cacheName = (version: string) => `${PREFIX}${version}`;
export const staleCaches = (names: string[], version: string) => names.filter((n) => n.startsWith(PREFIX) && n !== cacheName(version));
// A file we can use: a successful response that is not an HTML page (some hosts answer a missing file with the app)
export const usableResponse = (r: Response) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html');

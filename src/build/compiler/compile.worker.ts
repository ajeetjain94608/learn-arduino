/// <reference lib="webworker" />
import { compileSketch, type ToolName } from './pipeline';
import { readTar } from './tar';
import { cacheName, staleCaches, usableResponse } from './toolchainCache';
import { TOOLCHAIN_VERSION } from './toolchainVersion';
import { createWasmEnv, type LoadedTool, type ToolFactory } from './wasmEnv';
import type { CompileResult } from './types';

// Compiles sketches off the main thread with the WebAssembly toolchain (public/avr/). The tools and the sysroot
// are fetched from our own site on first use and kept in Cache Storage, so later compiles (and visits) work offline.
const BASE = new URL(`${import.meta.env.BASE_URL}avr/`, self.location.origin).href;
const CACHE = cacheName(TOOLCHAIN_VERSION);
// files of an older compiler version are no longer needed
if (typeof caches !== 'undefined') caches.keys().then((names) => Promise.all(staleCaches(names, TOOLCHAIN_VERSION).map((n) => caches.delete(n)))).catch(() => undefined);

async function fetchCached(url: string): Promise<Response> {
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => null) : null; // absent on plain-http LAN
  const hit = await cache?.match(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!usableResponse(res)) throw new Error(`Could not load the compiler (${res.status} ${url})`);
  await cache?.put(url, res.clone()).catch(() => undefined);
  return res;
}

const tools = new Map<ToolName, Promise<LoadedTool>>();
const load = (tool: ToolName) => {
  if (!tools.has(tool)) {
    tools.set(tool, (async () => {
      const js = await (await fetchCached(`${BASE}toolchain/${tool}.mjs`)).text();
      const url = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
      const factory = (await import(/* @vite-ignore */ url)).default as ToolFactory;
      URL.revokeObjectURL(url);
      const module = await WebAssembly.compile(await (await fetchCached(`${BASE}toolchain/${tool}.wasm`)).arrayBuffer());
      return { factory, module };
    })());
    tools.get(tool)!.catch(() => tools.delete(tool)); // retry after a failed download
  }
  return tools.get(tool)!;
};

let env: Promise<ReturnType<typeof createWasmEnv>> | null = null;
const getEnv = () => (env ??= fetchCached(`${BASE}uno/sysroot.tar`)
  .then((r) => r.arrayBuffer())
  .then((b) => createWasmEnv(load, readTar(new Uint8Array(b))))
  .catch((e) => { env = null; throw e; }));

self.onmessage = async (e: MessageEvent<{ id: number; sketch: string }>) => {
  const { id, sketch } = e.data;
  try {
    const result: CompileResult = await compileSketch(sketch, await getEnv());
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

import init, {
  serialize as wasmSerialize,
  lookup as wasmLookup,
  entries as wasmEntries,
  keys as wasmKeys,
  values as wasmValues,
  count as wasmCount,
} from "../wasm/lpkv.js";

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initialize(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = init().then(() => {
    initialized = true;
  });
  return initPromise;
}

export function isInitialized(): boolean {
  return initialized;
}

function assertInitialized(): void {
  if (!initialized) {
    throw new Error("WASM module not initialized. Call initialize() first.");
  }
}

export function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function serialize(items: [Uint8Array, Uint8Array][]): Uint8Array {
  assertInitialized();
  const flat = items.flatMap(([k, v]) => [k, v]);
  return new Uint8Array(wasmSerialize(flat));
}

export function serializeStrings(items: [string, string][]): Uint8Array {
  return serialize(items.map(([k, v]) => [encode(k), encode(v)]));
}

export function serializeObject(obj: Record<string, string>): Uint8Array {
  return serializeStrings(Object.entries(obj));
}

export function lookup(key: Uint8Array, data: Uint8Array): Uint8Array | undefined {
  assertInitialized();
  const result = wasmLookup(key, data);
  return result ? new Uint8Array(result) : undefined;
}

export function lookupString(key: string, data: Uint8Array): string | undefined {
  const result = lookup(encode(key), data);
  return result ? decode(result) : undefined;
}

export function entries(data: Uint8Array): [Uint8Array, Uint8Array][] {
  assertInitialized();
  const flat = wasmEntries(data);
  const result: [Uint8Array, Uint8Array][] = [];
  for (let i = 0; i < flat.length; i += 2) {
    result.push([flat[i], flat[i + 1]]);
  }
  return result;
}

export function entriesStrings(data: Uint8Array): [string, string][] {
  return entries(data).map(([k, v]) => [decode(k), decode(v)]);
}

export function toObject(data: Uint8Array): Record<string, string> {
  return Object.fromEntries(entriesStrings(data));
}

export function keys(data: Uint8Array): Uint8Array[] {
  assertInitialized();
  return wasmKeys(data);
}

export function keysStrings(data: Uint8Array): string[] {
  return keys(data).map(decode);
}

export function values(data: Uint8Array): Uint8Array[] {
  assertInitialized();
  return wasmValues(data);
}

export function valuesStrings(data: Uint8Array): string[] {
  return values(data).map(decode);
}

export function count(data: Uint8Array): number {
  assertInitialized();
  return wasmCount(data);
}

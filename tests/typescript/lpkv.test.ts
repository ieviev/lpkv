import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import init, {
  serialize as wasmSerialize,
  lookup as wasmLookup,
  entries as wasmEntries,
  keys as wasmKeys,
  values as wasmValues,
  count as wasmCount,
} from '../../npm/wasm/lpkv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const encode = (str: string): Uint8Array => new TextEncoder().encode(str);
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

function serialize(items: [Uint8Array, Uint8Array][]): Uint8Array {
  const flat = items.flatMap(([k, v]) => [k, v]);
  return new Uint8Array(wasmSerialize(flat));
}

function serializeStrings(items: [string, string][]): Uint8Array {
  return serialize(items.map(([k, v]) => [encode(k), encode(v)]));
}

function serializeObject(obj: Record<string, string>): Uint8Array {
  return serializeStrings(Object.entries(obj));
}

function lookup(key: Uint8Array, data: Uint8Array): Uint8Array | undefined {
  const result = wasmLookup(key, data);
  return result ? new Uint8Array(result) : undefined;
}

function lookupString(key: string, data: Uint8Array): string | undefined {
  const result = lookup(encode(key), data);
  return result ? decode(result) : undefined;
}

function entries(data: Uint8Array): [Uint8Array, Uint8Array][] {
  const flat = wasmEntries(data);
  const result: [Uint8Array, Uint8Array][] = [];
  for (let i = 0; i < flat.length; i += 2) {
    result.push([flat[i], flat[i + 1]]);
  }
  return result;
}

function entriesStrings(data: Uint8Array): [string, string][] {
  return entries(data).map(([k, v]) => [decode(k), decode(v)]);
}

function toObject(data: Uint8Array): Record<string, string> {
  return Object.fromEntries(entriesStrings(data));
}

function keys(data: Uint8Array): Uint8Array[] {
  return wasmKeys(data);
}

function keysStrings(data: Uint8Array): string[] {
  return keys(data).map(decode);
}

function values(data: Uint8Array): Uint8Array[] {
  return wasmValues(data);
}

function valuesStrings(data: Uint8Array): string[] {
  return values(data).map(decode);
}

function count(data: Uint8Array): number {
  return wasmCount(data);
}

beforeAll(async () => {
  const wasmPath = join(__dirname, '../../npm/wasm/lpkv_bg.wasm');
  const wasmBuffer = readFileSync(wasmPath);
  await init(wasmBuffer);
});

describe('encode/decode', () => {
  it('should encode string to Uint8Array', () => {
    const result = encode('hello');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(5);
  });

  it('should decode Uint8Array to string', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    expect(decode(bytes)).toBe('hello');
  });

  it('should roundtrip encode/decode', () => {
    const original = 'test string 日本語 🎉';
    expect(decode(encode(original))).toBe(original);
  });
});

describe('serialize', () => {
  it('should serialize single entry', () => {
    const items: [Uint8Array, Uint8Array][] = [[encode('key'), encode('value')]];
    const data = serialize(items);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(16); // 4+4+3+5
  });

  it('should serialize multiple entries', () => {
    const items: [Uint8Array, Uint8Array][] = [
      [encode('a'), encode('1')],
      [encode('b'), encode('2')],
    ];
    const data = serialize(items);
    expect(data.length).toBeGreaterThan(0);
  });

  it('should serialize empty array', () => {
    const data = serialize([]);
    expect(data.length).toBe(0);
  });
});

describe('serializeStrings', () => {
  it('should serialize string pairs', () => {
    const data = serializeStrings([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
    expect(data.length).toBeGreaterThan(0);
    expect(lookupString('key1', data)).toBe('value1');
    expect(lookupString('key2', data)).toBe('value2');
  });
});

describe('serializeObject', () => {
  it('should serialize plain object', () => {
    const obj = { name: 'Alice', age: '30' };
    const data = serializeObject(obj);
    expect(lookupString('name', data)).toBe('Alice');
    expect(lookupString('age', data)).toBe('30');
  });

  it('should serialize empty object', () => {
    const data = serializeObject({});
    expect(data.length).toBe(0);
  });
});

describe('lookup', () => {
  it('should find existing key', () => {
    const data = serializeStrings([['key', 'value']]);
    const result = lookup(encode('key'), data);
    expect(result).toBeDefined();
    expect(decode(result!)).toBe('value');
  });

  it('should return undefined for missing key', () => {
    const data = serializeStrings([['key', 'value']]);
    const result = lookup(encode('missing'), data);
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty data', () => {
    const result = lookup(encode('key'), new Uint8Array(0));
    expect(result).toBeUndefined();
  });

  it('should find first match when duplicates exist', () => {
    const data = serializeStrings([
      ['key', 'first'],
      ['key', 'second'],
    ]);
    expect(lookupString('key', data)).toBe('first');
  });
});

describe('lookupString', () => {
  it('should find and decode value', () => {
    const data = serializeStrings([['greeting', 'hello world']]);
    expect(lookupString('greeting', data)).toBe('hello world');
  });

  it('should return undefined for missing key', () => {
    const data = serializeStrings([['key', 'value']]);
    expect(lookupString('missing', data)).toBeUndefined();
  });
});

describe('entries', () => {
  it('should return all entries as byte arrays', () => {
    const data = serializeStrings([
      ['a', '1'],
      ['b', '2'],
    ]);
    const result = entries(data);
    expect(result.length).toBe(2);
    expect(decode(result[0][0])).toBe('a');
    expect(decode(result[0][1])).toBe('1');
    expect(decode(result[1][0])).toBe('b');
    expect(decode(result[1][1])).toBe('2');
  });

  it('should return empty array for empty data', () => {
    const result = entries(new Uint8Array(0));
    expect(result.length).toBe(0);
  });
});

describe('entriesStrings', () => {
  it('should return all entries as strings', () => {
    const data = serializeStrings([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
    const result = entriesStrings(data);
    expect(result).toEqual([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
  });
});

describe('toObject', () => {
  it('should convert to plain object', () => {
    const original = { foo: 'bar', baz: 'qux' };
    const data = serializeObject(original);
    const result = toObject(data);
    expect(result).toEqual(original);
  });

  it('should return empty object for empty data', () => {
    const result = toObject(new Uint8Array(0));
    expect(result).toEqual({});
  });

  it('should use last value for duplicate keys', () => {
    const data = serializeStrings([
      ['key', 'first'],
      ['key', 'second'],
    ]);
    const result = toObject(data);
    expect(result.key).toBe('second'); // Object.fromEntries behavior
  });
});

describe('keys', () => {
  it('should return all keys as byte arrays', () => {
    const data = serializeStrings([
      ['a', '1'],
      ['b', '2'],
    ]);
    const result = keys(data);
    expect(result.length).toBe(2);
    expect(decode(result[0])).toBe('a');
    expect(decode(result[1])).toBe('b');
  });
});

describe('keysStrings', () => {
  it('should return all keys as strings', () => {
    const data = serializeStrings([
      ['x', '1'],
      ['y', '2'],
      ['z', '3'],
    ]);
    expect(keysStrings(data)).toEqual(['x', 'y', 'z']);
  });
});

describe('values', () => {
  it('should return all values as byte arrays', () => {
    const data = serializeStrings([
      ['a', 'first'],
      ['b', 'second'],
    ]);
    const result = values(data);
    expect(result.length).toBe(2);
    expect(decode(result[0])).toBe('first');
    expect(decode(result[1])).toBe('second');
  });
});

describe('valuesStrings', () => {
  it('should return all values as strings', () => {
    const data = serializeStrings([
      ['a', 'one'],
      ['b', 'two'],
    ]);
    expect(valuesStrings(data)).toEqual(['one', 'two']);
  });
});

describe('count', () => {
  it('should return correct count', () => {
    const data = serializeStrings([
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
    ]);
    expect(count(data)).toBe(3);
  });

  it('should return 0 for empty data', () => {
    expect(count(new Uint8Array(0))).toBe(0);
  });
});

describe('edge cases', () => {
  it('should handle empty key', () => {
    const data = serializeStrings([['', 'value']]);
    expect(lookupString('', data)).toBe('value');
  });

  it('should handle empty value', () => {
    const data = serializeStrings([['key', '']]);
    expect(lookupString('key', data)).toBe('');
  });

  it('should handle empty key and value', () => {
    const data = serializeStrings([['', '']]);
    expect(data.length).toBe(8); // just headers
    expect(lookupString('', data)).toBe('');
  });

  it('should handle unicode keys and values', () => {
    const data = serializeStrings([['日本語', '🎉emoji🎊']]);
    expect(lookupString('日本語', data)).toBe('🎉emoji🎊');
  });

  it('should handle binary data', () => {
    const key = new Uint8Array([0, 1, 2, 255, 254]);
    const value = new Uint8Array([128, 0, 0, 0, 127]);
    const data = serialize([[key, value]]);
    const result = lookup(key, data);
    expect(result).toEqual(value);
  });

  it('should handle large values', () => {
    const key = encode('big');
    const value = new Uint8Array(65536).fill(0xab);
    const data = serialize([[key, value]]);
    const result = lookup(key, data);
    expect(result).toEqual(value);
  });

  it('should handle many entries', () => {
    const items: [string, string][] = [];
    for (let i = 0; i < 1000; i++) {
      items.push([`key${i}`, `val${i}`]);
    }
    const data = serializeStrings(items);
    expect(lookupString('key0', data)).toBe('val0');
    expect(lookupString('key500', data)).toBe('val500');
    expect(lookupString('key999', data)).toBe('val999');
    expect(lookupString('key1000', data)).toBeUndefined();
  });
});

describe('format structure', () => {
  it('should produce correct binary format', () => {
    const data = serializeStrings([['AB', 'XYZ']]);
    expect(Array.from(data)).toEqual([
      2, 0, 0, 0, // key_len = 2 (little endian)
      3, 0, 0, 0, // value_len = 3 (little endian)
      65, 66, // key = "AB"
      88, 89, 90, // value = "XYZ"
    ]);
  });
});

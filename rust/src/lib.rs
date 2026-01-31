use wasm_bindgen::prelude::*;

/// Format: [key_len: u32][value_len: u32][key bytes][value bytes]...
pub fn serialize<'a>(items: impl IntoIterator<Item = (&'a [u8], &'a [u8])>) -> Vec<u8> {
    let mut result = Vec::new();
    for (key, value) in items {
        result.extend_from_slice(&(key.len() as u32).to_le_bytes());
        result.extend_from_slice(&(value.len() as u32).to_le_bytes());
        result.extend_from_slice(key);
        result.extend_from_slice(value);
    }
    result
}

#[inline]
pub fn iter<F>(data: &[u8], mut f: F)
where
    F: FnMut(&[u8], &[u8]) -> bool,
{
    let mut pos = 0;
    while pos < data.len() {
        if pos + 8 > data.len() {
            panic!("eof reading header");
        }
        let key_len = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap()) as usize;
        let value_len = u32::from_le_bytes(data[pos + 4..pos + 8].try_into().unwrap()) as usize;
        if pos + 8 + key_len + value_len > data.len() {
            panic!("eof reading value");
        }
        let key = &data[pos + 8..pos + 8 + key_len];
        let value = &data[pos + 8 + key_len..pos + 8 + key_len + value_len];
        if !f(key, value) {
            break;
        }
        pos += 8 + key_len + value_len;
    }
}

#[inline]
pub fn lookup<'a>(key: &[u8], data: &'a [u8]) -> Option<&'a [u8]> {
    let mut pos = 0;
    while pos < data.len() {
        if pos + 8 > data.len() {
            panic!("eof reading header");
        }
        let key_len = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap()) as usize;
        let value_len = u32::from_le_bytes(data[pos + 4..pos + 8].try_into().unwrap()) as usize;
        if pos + 8 + key_len + value_len > data.len() {
            panic!("eof reading value");
        }
        let stored_key = &data[pos + 8..pos + 8 + key_len];
        if stored_key == key {
            return Some(&data[pos + 8 + key_len..pos + 8 + key_len + value_len]);
        }
        pos += 8 + key_len + value_len;
    }
    None
}

#[wasm_bindgen(js_name = "serialize")]
pub fn wasm_serialize(items: Vec<js_sys::Uint8Array>) -> Vec<u8> {
    let pairs: Vec<Vec<u8>> = items.iter().map(|arr| arr.to_vec()).collect();
    let pair_slices: Vec<(&[u8], &[u8])> = pairs
        .chunks(2)
        .filter_map(|chunk| {
            if chunk.len() == 2 {
                Some((chunk[0].as_slice(), chunk[1].as_slice()))
            } else {
                None
            }
        })
        .collect();
    serialize(pair_slices)
}

#[wasm_bindgen(js_name = "lookup")]
pub fn wasm_lookup(key: &[u8], data: &[u8]) -> Option<Vec<u8>> {
    lookup(key, data).map(|v| v.to_vec())
}

#[wasm_bindgen(js_name = "entries")]
pub fn wasm_entries(data: &[u8]) -> Vec<js_sys::Uint8Array> {
    let mut result = Vec::new();
    iter(data, |k, v| {
        result.push(js_sys::Uint8Array::from(k));
        result.push(js_sys::Uint8Array::from(v));
        true
    });
    result
}

#[wasm_bindgen(js_name = "keys")]
pub fn wasm_keys(data: &[u8]) -> Vec<js_sys::Uint8Array> {
    let mut result = Vec::new();
    iter(data, |k, _| {
        result.push(js_sys::Uint8Array::from(k));
        true
    });
    result
}

#[wasm_bindgen(js_name = "values")]
pub fn wasm_values(data: &[u8]) -> Vec<js_sys::Uint8Array> {
    let mut result = Vec::new();
    iter(data, |_, v| {
        result.push(js_sys::Uint8Array::from(v));
        true
    });
    result
}

#[wasm_bindgen(js_name = "count")]
pub fn wasm_count(data: &[u8]) -> u32 {
    let mut count = 0u32;
    iter(data, |_, _| {
        count += 1;
        true
    });
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_and_lookup() {
        let items = vec![
            (b"key1".as_slice(), b"value1".as_slice()),
            (b"key2".as_slice(), b"value2".as_slice()),
        ];
        let data = serialize(items);
        assert_eq!(lookup(b"key1", &data), Some(b"value1".as_slice()));
        assert_eq!(lookup(b"key2", &data), Some(b"value2".as_slice()));
        assert_eq!(lookup(b"key3", &data), None);
    }

    #[test]
    fn test_iter() {
        let items = vec![
            (b"a".as_slice(), b"1".as_slice()),
            (b"b".as_slice(), b"2".as_slice()),
            (b"c".as_slice(), b"3".as_slice()),
        ];
        let data = serialize(items);
        let mut collected = Vec::new();
        iter(&data, |k, v| {
            collected.push((k.to_vec(), v.to_vec()));
            true
        });
        assert_eq!(collected.len(), 3);
        assert_eq!(collected[0], (b"a".to_vec(), b"1".to_vec()));
        assert_eq!(collected[1], (b"b".to_vec(), b"2".to_vec()));
        assert_eq!(collected[2], (b"c".to_vec(), b"3".to_vec()));
    }

    #[test]
    fn test_iter_early_stop() {
        let items = vec![
            (b"a".as_slice(), b"1".as_slice()),
            (b"b".as_slice(), b"2".as_slice()),
            (b"c".as_slice(), b"3".as_slice()),
        ];
        let data = serialize(items);
        let mut count = 0;
        iter(&data, |_, _| {
            count += 1;
            count < 2
        });
        assert_eq!(count, 2);
    }

    #[test]
    fn test_empty() {
        let data = serialize(std::iter::empty());
        assert!(data.is_empty());
        assert_eq!(lookup(b"anything", &data), None);
    }
}

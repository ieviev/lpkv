#[cfg(test)]
mod tests {
    use lpkv::{iter, lookup, serialize};

    #[test]
    fn serialize_single_entry() {
        let items = vec![(b"key".as_slice(), b"value".as_slice())];
        let data = serialize(items);
        // 4 bytes key_len + 4 bytes value_len + 3 bytes key + 5 bytes value = 16
        assert_eq!(data.len(), 16);
        assert_eq!(lookup(b"key", &data), Some(b"value".as_slice()));
    }

    #[test]
    fn serialize_multiple_entries() {
        let items = vec![
            (b"a".as_slice(), b"1".as_slice()),
            (b"bb".as_slice(), b"22".as_slice()),
            (b"ccc".as_slice(), b"333".as_slice()),
        ];
        let data = serialize(items);
        assert_eq!(lookup(b"a", &data), Some(b"1".as_slice()));
        assert_eq!(lookup(b"bb", &data), Some(b"22".as_slice()));
        assert_eq!(lookup(b"ccc", &data), Some(b"333".as_slice()));
    }

    #[test]
    fn serialize_empty() {
        let data = serialize(std::iter::empty());
        assert!(data.is_empty());
    }

    #[test]
    fn lookup_missing_key() {
        let items = vec![(b"exists".as_slice(), b"value".as_slice())];
        let data = serialize(items);
        assert_eq!(lookup(b"missing", &data), None);
    }

    #[test]
    fn lookup_empty_data() {
        assert_eq!(lookup(b"key", &[]), None);
    }

    #[test]
    fn lookup_first_match_wins() {
        let items = vec![
            (b"key".as_slice(), b"first".as_slice()),
            (b"key".as_slice(), b"second".as_slice()),
        ];
        let data = serialize(items);
        assert_eq!(lookup(b"key", &data), Some(b"first".as_slice()));
    }

    #[test]
    fn iter_collects_all() {
        let items = vec![
            (b"a".as_slice(), b"1".as_slice()),
            (b"b".as_slice(), b"2".as_slice()),
        ];
        let data = serialize(items);
        let mut collected = Vec::new();
        iter(&data, |k, v| {
            collected.push((k.to_vec(), v.to_vec()));
            true
        });
        assert_eq!(collected.len(), 2);
        assert_eq!(collected[0], (b"a".to_vec(), b"1".to_vec()));
        assert_eq!(collected[1], (b"b".to_vec(), b"2".to_vec()));
    }

    #[test]
    fn iter_early_termination() {
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
    fn iter_empty_data() {
        let mut called = false;
        iter(&[], |_, _| {
            called = true;
            true
        });
        assert!(!called);
    }

    #[test]
    fn empty_key() {
        let items = vec![(b"".as_slice(), b"value".as_slice())];
        let data = serialize(items);
        assert_eq!(lookup(b"", &data), Some(b"value".as_slice()));
    }

    #[test]
    fn empty_value() {
        let items = vec![(b"key".as_slice(), b"".as_slice())];
        let data = serialize(items);
        assert_eq!(lookup(b"key", &data), Some(b"".as_slice()));
    }

    #[test]
    fn empty_key_and_value() {
        let items = vec![(b"".as_slice(), b"".as_slice())];
        let data = serialize(items);
        assert_eq!(data.len(), 8); // just headers
        assert_eq!(lookup(b"", &data), Some(b"".as_slice()));
    }

    #[test]
    fn binary_data() {
        let key = &[0u8, 1, 2, 255, 254];
        let value = &[128u8, 0, 0, 0, 127];
        let items = vec![(key.as_slice(), value.as_slice())];
        let data = serialize(items);
        assert_eq!(lookup(key, &data), Some(value.as_slice()));
    }

    #[test]
    fn unicode_strings() {
        let key = "日本語".as_bytes();
        let value = "🎉emoji🎊".as_bytes();
        let items = vec![(key, value)];
        let data = serialize(items);
        assert_eq!(lookup(key, &data), Some(value));
    }

    #[test]
    fn large_values() {
        let key = b"big";
        let value = vec![0xABu8; 65536];
        let items = vec![(key.as_slice(), value.as_slice())];
        let data = serialize(items);
        assert_eq!(lookup(key, &data), Some(value.as_slice()));
    }

    #[test]
    fn many_entries() {
        let entries: Vec<(Vec<u8>, Vec<u8>)> = (0..1000)
            .map(|i| (format!("key{}", i).into_bytes(), format!("val{}", i).into_bytes()))
            .collect();
        let items: Vec<(&[u8], &[u8])> = entries.iter().map(|(k, v)| (k.as_slice(), v.as_slice())).collect();
        let data = serialize(items);

        // Check first, middle, and last
        assert_eq!(lookup(b"key0", &data), Some(b"val0".as_slice()));
        assert_eq!(lookup(b"key500", &data), Some(b"val500".as_slice()));
        assert_eq!(lookup(b"key999", &data), Some(b"val999".as_slice()));
        assert_eq!(lookup(b"key1000", &data), None);
    }

    #[test]
    #[should_panic(expected = "eof reading header")]
    fn truncated_header() {
        lookup(b"key", &[0, 0, 0]); // less than 8 bytes
    }

    #[test]
    #[should_panic(expected = "eof reading value")]
    fn truncated_body() {
        // header says key=3, value=5 but only provide 2 bytes after header
        let bad_data = [3, 0, 0, 0, 5, 0, 0, 0, b'a', b'b'];
        lookup(b"ab", &bad_data);
    }

    #[test]
    fn format_structure() {
        let items = vec![(b"AB".as_slice(), b"XYZ".as_slice())];
        let data = serialize(items);
        // key_len=2 (le), value_len=3 (le), key="AB", value="XYZ"
        assert_eq!(data, vec![
            2, 0, 0, 0,  // key_len = 2
            3, 0, 0, 0,  // value_len = 3
            b'A', b'B',  // key
            b'X', b'Y', b'Z'  // value
        ]);
    }
}

#[cfg(test)]
mod proptest_tests {
    use lpkv::{iter, lookup, serialize};
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn roundtrip_single(key in prop::collection::vec(any::<u8>(), 0..256),
                           value in prop::collection::vec(any::<u8>(), 0..256)) {
            let items = vec![(key.as_slice(), value.as_slice())];
            let data = serialize(items);
            prop_assert_eq!(lookup(&key, &data), Some(value.as_slice()));
        }

        #[test]
        fn roundtrip_multiple(entries in prop::collection::vec(
            (prop::collection::vec(any::<u8>(), 0..64), prop::collection::vec(any::<u8>(), 0..64)),
            0..50
        )) {
            let items: Vec<(&[u8], &[u8])> = entries.iter()
                .map(|(k, v)| (k.as_slice(), v.as_slice()))
                .collect();
            let data = serialize(items);

            let mut collected = Vec::new();
            iter(&data, |k, v| {
                collected.push((k.to_vec(), v.to_vec()));
                true
            });

            prop_assert_eq!(collected.len(), entries.len());
            for (i, (k, v)) in entries.iter().enumerate() {
                prop_assert_eq!(&collected[i].0, k);
                prop_assert_eq!(&collected[i].1, v);
            }
        }

        #[test]
        fn iter_count_matches(entries in prop::collection::vec(
            (prop::collection::vec(any::<u8>(), 1..32), prop::collection::vec(any::<u8>(), 1..32)),
            0..100
        )) {
            let items: Vec<(&[u8], &[u8])> = entries.iter()
                .map(|(k, v)| (k.as_slice(), v.as_slice()))
                .collect();
            let data = serialize(items);

            let mut count = 0;
            iter(&data, |_, _| {
                count += 1;
                true
            });

            prop_assert_eq!(count, entries.len());
        }
    }
}

### lpkv: length-prefixed key-value

A simple binary key-value format where length prefixes allow skipping unwanted entries.

```bnf
entry := key_len:u32le value_len:u32le key:bytes value:bytes
lpkv  := entry*
```

someone surely must have invented this already, but i found that the standard [KLV](https://en.wikipedia.org/wiki/KLV) format uses big-endian lengths, and everything else i found is either
part of a larger framework or used a different encoding scheme.
if you know of an existing implementation, please let me know!

this repository contains reference implementations for 
languages that i use frequently - Rust, F# and Javascript.

Have fun!

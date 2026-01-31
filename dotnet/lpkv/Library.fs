module lpkv

open System
open System.IO
open System.Runtime.InteropServices
open System.Runtime.CompilerServices

let serialize (items: struct (ReadOnlyMemory<byte> * ReadOnlyMemory<byte>) seq) : byte[] =
    use ms = new MemoryStream()
    for (key, value) in items do
        ms.Write(BitConverter.GetBytes(uint32 key.Length), 0, 4)
        ms.Write(BitConverter.GetBytes(uint32 value.Length), 0, 4)
        ms.Write(key.Span)
        ms.Write(value.Span)
    ms.ToArray()

[<MethodImpl(MethodImplOptions.AggressiveInlining)>]
let inline iter
    (
        data: ReadOnlyMemory<byte>,
        [<InlineIfLambda>] fn: struct (ReadOnlyMemory<byte> * ReadOnlyMemory<byte>) -> bool
    ) =
    let mutable pos = 0
    while pos < data.Length do
        let keyLen = MemoryMarshal.Read<uint32>(data.Span.Slice(pos, 4))
        let valueLen = MemoryMarshal.Read<uint32>(data.Span.Slice(pos + 4, 4))
        if (pos + int (keyLen + valueLen)) > data.Length then
            failwith "eof reading value len"
        if not (fn struct (data.Slice(pos + 8, int keyLen), data.Slice(pos + 8 + int keyLen, int valueLen))) then
            pos <- data.Length
        pos <- pos + 8 + int keyLen + int valueLen

[<MethodImpl(MethodImplOptions.AggressiveInlining)>]
let lookup (key: ReadOnlySpan<byte>, data: ReadOnlySpan<byte>) : ReadOnlySpan<byte> =
    let mutable result = ReadOnlySpan<byte>.Empty
    let mutable pos = 0
    while pos < data.Length do
        let keyLen = MemoryMarshal.Read<uint32>(data.Slice(pos, 4))
        let valueLen = MemoryMarshal.Read<uint32>(data.Slice(pos + 4, 4))
        if (pos + int (keyLen + valueLen)) > data.Length then
            failwith "eof reading value len"
        if keyLen = uint32 key.Length && data.Slice(pos + 8, int keyLen).SequenceEqual(key) then
            result <- data.Slice(pos + 8 + int keyLen, int valueLen)
            pos <- data.Length
        else
            pos <- pos + 8 + int keyLen + int valueLen
    result

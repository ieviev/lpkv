module LpkvTests

open System
open System.Text
open Xunit
open FsCheck
open FsCheck.Xunit

let toMem (bytes: byte[]) = ReadOnlyMemory<byte>(bytes)
let fromStr (s: string) = Encoding.UTF8.GetBytes(s)
let toStr (span: ReadOnlySpan<byte>) = Encoding.UTF8.GetString(span)

[<Fact>]
let ``serialize single entry`` () =
    let items = [| struct (toMem (fromStr "key"), toMem (fromStr "value")) |]
    let data = lpkv.serialize items
    // 4 bytes key_len + 4 bytes value_len + 3 bytes key + 5 bytes value = 16
    Assert.Equal(16, data.Length)

[<Fact>]
let ``serialize multiple entries`` () =
    let items = [|
        struct (toMem (fromStr "a"), toMem (fromStr "1"))
        struct (toMem (fromStr "bb"), toMem (fromStr "22"))
        struct (toMem (fromStr "ccc"), toMem (fromStr "333"))
    |]
    let data = lpkv.serialize items
    Assert.True(data.Length > 0)

[<Fact>]
let ``serialize empty`` () =
    let data = lpkv.serialize Array.empty
    Assert.Equal(0, data.Length)

[<Fact>]
let ``lookup existing key`` () =
    let items = [| struct (toMem (fromStr "key"), toMem (fromStr "value")) |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>(fromStr "key"), ReadOnlySpan<byte>(data))
    Assert.Equal("value", toStr result)

[<Fact>]
let ``lookup missing key`` () =
    let items = [| struct (toMem (fromStr "exists"), toMem (fromStr "value")) |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>(fromStr "missing"), ReadOnlySpan<byte>(data))
    Assert.True(result.IsEmpty)

[<Fact>]
let ``lookup empty data`` () =
    let result = lpkv.lookup(ReadOnlySpan<byte>(fromStr "key"), ReadOnlySpan<byte>.Empty)
    Assert.True(result.IsEmpty)

[<Fact>]
let ``lookup first match wins`` () =
    let items = [|
        struct (toMem (fromStr "key"), toMem (fromStr "first"))
        struct (toMem (fromStr "key"), toMem (fromStr "second"))
    |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>(fromStr "key"), ReadOnlySpan<byte>(data))
    Assert.Equal("first", toStr result)

[<Fact>]
let ``iter collects all`` () =
    let items = [|
        struct (toMem (fromStr "a"), toMem (fromStr "1"))
        struct (toMem (fromStr "b"), toMem (fromStr "2"))
    |]
    let data = lpkv.serialize items
    let collected = ResizeArray<string * string>()
    lpkv.iter(toMem data, fun struct (k, v) ->
        collected.Add((toStr k.Span, toStr v.Span))
        true)
    Assert.Equal(2, collected.Count)
    Assert.Equal(("a", "1"), collected.[0])
    Assert.Equal(("b", "2"), collected.[1])

[<Fact>]
let ``iter early termination`` () =
    let items = [|
        struct (toMem (fromStr "a"), toMem (fromStr "1"))
        struct (toMem (fromStr "b"), toMem (fromStr "2"))
        struct (toMem (fromStr "c"), toMem (fromStr "3"))
    |]
    let data = lpkv.serialize items
    let mutable count = 0
    lpkv.iter(toMem data, fun _ ->
        count <- count + 1
        count < 2)
    Assert.Equal(2, count)

[<Fact>]
let ``iter empty data`` () =
    let mutable called = false
    lpkv.iter(toMem Array.empty, fun _ ->
        called <- true
        true)
    Assert.False(called)

[<Fact>]
let ``empty key`` () =
    let items = [| struct (toMem [||], toMem (fromStr "value")) |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>.Empty, ReadOnlySpan<byte>(data))
    Assert.Equal("value", toStr result)

[<Fact>]
let ``empty value`` () =
    let items = [| struct (toMem (fromStr "key"), toMem [||]) |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>(fromStr "key"), ReadOnlySpan<byte>(data))
    Assert.True(result.IsEmpty)

[<Fact>]
let ``empty key and value`` () =
    let items = [| struct (toMem [||], toMem [||]) |]
    let data = lpkv.serialize items
    Assert.Equal(8, data.Length) // just headers
    let result = lpkv.lookup(ReadOnlySpan<byte>.Empty, ReadOnlySpan<byte>(data))
    Assert.True(result.IsEmpty)

[<Fact>]
let ``binary data`` () =
    let key = [| 0uy; 1uy; 2uy; 255uy; 254uy |]
    let value = [| 128uy; 0uy; 0uy; 0uy; 127uy |]
    let items = [| struct (toMem key, toMem value) |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>(key), ReadOnlySpan<byte>(data))
    Assert.Equal<byte>(value, result.ToArray())

[<Fact>]
let ``unicode strings`` () =
    let key = fromStr "日本語"
    let value = fromStr "🎉emoji🎊"
    let items = [| struct (toMem key, toMem value) |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>(key), ReadOnlySpan<byte>(data))
    Assert.Equal("🎉emoji🎊", toStr result)

[<Fact>]
let ``large values`` () =
    let key = fromStr "big"
    let value = Array.create 65536 0xABuy
    let items = [| struct (toMem key, toMem value) |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>(key), ReadOnlySpan<byte>(data))
    Assert.Equal<byte>(value, result.ToArray())

[<Fact>]
let ``many entries`` () =
    let items = [|
        for i in 0..999 do
            struct (toMem (fromStr $"key{i}"), toMem (fromStr $"val{i}"))
    |]
    let data = lpkv.serialize items

    let r0 = lpkv.lookup(ReadOnlySpan<byte>(fromStr "key0"), ReadOnlySpan<byte>(data))
    Assert.Equal("val0", toStr r0)

    let r500 = lpkv.lookup(ReadOnlySpan<byte>(fromStr "key500"), ReadOnlySpan<byte>(data))
    Assert.Equal("val500", toStr r500)

    let r999 = lpkv.lookup(ReadOnlySpan<byte>(fromStr "key999"), ReadOnlySpan<byte>(data))
    Assert.Equal("val999", toStr r999)

    let r1000 = lpkv.lookup(ReadOnlySpan<byte>(fromStr "key1000"), ReadOnlySpan<byte>(data))
    Assert.True(r1000.IsEmpty)

[<Fact>]
let ``format structure`` () =
    let items = [| struct (toMem (fromStr "AB"), toMem (fromStr "XYZ")) |]
    let data = lpkv.serialize items
    let expected = [|
        2uy; 0uy; 0uy; 0uy  // key_len = 2 (little endian)
        3uy; 0uy; 0uy; 0uy  // value_len = 3 (little endian)
        65uy; 66uy          // key = "AB"
        88uy; 89uy; 90uy    // value = "XYZ"
    |]
    Assert.Equal<byte>(expected, data)

// Property-based tests
[<Property>]
let ``roundtrip single entry`` (key: byte[]) (value: byte[]) =
    let key = if isNull key then [||] else key
    let value = if isNull value then [||] else value
    let items = [| struct (toMem key, toMem value) |]
    let data = lpkv.serialize items
    let result = lpkv.lookup(ReadOnlySpan<byte>(key), ReadOnlySpan<byte>(data))
    result.SequenceEqual(ReadOnlySpan<byte>(value))

[<Property(MaxTest = 50)>]
let ``roundtrip multiple entries`` (entries: (byte[] * byte[]) list) =
    let entries =
        entries
        |> List.map (fun (k, v) ->
            (if isNull k then [||] else k),
            (if isNull v then [||] else v))
        |> List.truncate 50
    let items = entries |> List.map (fun (k, v) -> struct (toMem k, toMem v)) |> Array.ofList
    let data = lpkv.serialize items

    let collected = ResizeArray<byte[] * byte[]>()
    lpkv.iter(toMem data, fun struct (k, v) ->
        collected.Add((k.ToArray(), v.ToArray()))
        true)

    collected.Count = entries.Length &&
    (entries, collected |> Seq.toList)
    ||> List.forall2 (fun (ek, ev) (ak, av) ->
        ek.AsSpan().SequenceEqual(ReadOnlySpan<byte>(ak)) &&
        ev.AsSpan().SequenceEqual(ReadOnlySpan<byte>(av)))

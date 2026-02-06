
build-wasm:
    cd rust/ && wasm-pack build --target web --out-dir ../npm/wasm
    cd npm && fish -c 'npm install' && fish -c 'npm run build:ts'

# Run all tests
test: test-rust test-typescript test-dotnet

# Run Rust tests only
test-rust:
    cd rust/ && cargo test
    cd tests/rust && cargo test

# Run TypeScript tests only
test-typescript:
    cd tests/typescript && npm install && npm test

# Run .NET tests only
test-dotnet:
    cd tests/dotnet && dotnet test


build-wasm:
    cd rust/ && wasm-pack build --target web --out-dir ../npm/wasm
    cd npm && fish -c 'npm install' && fish -c 'npm run build:ts'

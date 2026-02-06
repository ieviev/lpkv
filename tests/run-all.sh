#!/bin/bash
set -e

# note: this is entirely LLM-generated

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FAILED=0

# Rust tests
echo ""
echo "--- Rust Tests ---"
if cd "$SCRIPT_DIR/rust" && cargo test 2>&1; then
    echo "✓ Rust tests passed"
else
    echo "✗ Rust tests failed"
    FAILED=1
fi

# Also run the original rust tests
echo ""
echo "--- Rust Core Tests ---"
if cd "$ROOT_DIR/rust" && cargo test 2>&1; then
    echo "✓ Rust core tests passed"
else
    echo "✗ Rust core tests failed"
    FAILED=1
fi

# TypeScript tests
echo ""
echo "--- TypeScript Tests ---"
if cd "$SCRIPT_DIR/typescript" && npm install --silent && npm test 2>&1; then
    echo "✓ TypeScript tests passed"
else
    echo "✗ TypeScript tests failed"
    FAILED=1
fi

# .NET tests
echo ""
echo "--- .NET/F# Tests ---"
if cd "$SCRIPT_DIR/dotnet" && dotnet test 2>&1; then
    echo "✓ .NET tests passed"
else
    echo "✗ .NET tests failed"
    FAILED=1
fi

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
    echo "All tests passed!"
    exit 0
else
    echo "Some tests failed!"
    exit 1
fi

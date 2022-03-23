target/wasm32-unknown-unknown/release/distrotron.wasm: $(wildcard distrotron/src/*.rs) Cargo.toml distrotron/Cargo.toml
	cargo build --target wasm32-unknown-unknown --release -p distrotron

target/wasm32-unknown-unknown/debug/distrotron.wasm: $(wildcard distrotron/src/*.rs) Cargo.toml distrotron/Cargo.toml
	cargo build --target wasm32-unknown-unknown -p distrotron

release: target/wasm32-unknown-unknown/release/distrotron.wasm

debug: target/wasm32-unknown-unknown/debug/distrotron.wasm

simtest: release $(wildcard tests/sim/*.rs)
	cargo test first_tests -- --nocapture

unittest: release debug 
	cd distrotron; make test

test: simtest unittest
	cargo test -- --nocapture

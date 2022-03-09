target/wasm32-unknown-unknown/release/distrotron.wasm: $(wildcard src/*.rs)
	cargo build --target wasm32-unknown-unknown --release 

contract: target/wasm32-unknown-unknown/release/distrotron.wasm -p distrotron

test: 
	cargo test -- --nocapture

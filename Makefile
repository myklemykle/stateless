target/wasm32-unknown-unknown/release/distrotron.wasm: $(wildcard distrotron/src/*.rs) Cargo.toml distrotron/Cargo.toml
	cargo build --target wasm32-unknown-unknown --release -p distrotron

target/wasm32-unknown-unknown/debug/distrotron.wasm: $(wildcard distrotron/src/*.rs) Cargo.toml distrotron/Cargo.toml
	cargo build --target wasm32-unknown-unknown -p distrotron

target/wasm32-unknown-unknown/debug/stub.wasm: $(wildcard stub/src/*.rs) Cargo.toml stub/Cargo.toml
	cargo build --target wasm32-unknown-unknown -p stub

target/wasm32-unknown-unknown/release/stub.wasm: $(wildcard stub/src/*.rs) Cargo.toml stub/Cargo.toml
	cargo build --target wasm32-unknown-unknown --release -p stub

release: target/wasm32-unknown-unknown/release/distrotron.wasm

debug: target/wasm32-unknown-unknown/debug/distrotron.wasm

stub: target/wasm32-unknown-unknown/debug/stub.wasm

stub_release: target/wasm32-unknown-unknown/release/stub.wasm

# TODO: sandbox targets:
# start sandbox 
#  (how to test if its already running?)
#
# .PHONY: start_sandbox
# start_sandbox: 
# 	echo "starting sandbox!!!!!"
# 	osascript -e 'tell application "Terminal" do script "../nearcore/sandbox/start_sandbox.sh" '  # need remote-exec version of this script

# deploy stub contract & user
#
# deploy main contract & user
#
# create test users

sandboxtest: stub_release release
	node tests/sandbox/tests.js

stubtest: stub
	cargo test -p stub -- --nocapture


simtest: release $(wildcard tests/sim/*.rs)
	cargo test first_tests -- --nocapture

unittest: release debug 
	cd distrotron; make test

test: simtest unittest
	cargo test -- --nocapture

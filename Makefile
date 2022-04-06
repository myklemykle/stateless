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

stub_debug: target/wasm32-unknown-unknown/debug/stub.wasm

stub_release: target/wasm32-unknown-unknown/release/stub.wasm


# sandbox test targets:
#
# start sandbox 
#  (how do i test if its already running?)
#
.PHONY: sandbox_start
sandbox_start: 
	echo "starting sandbox:"
	#osascript -e 'tell application "Terminal" \n do script "../nearcore/start_sandbox.sh" \n end tell'  # need remote-exec version of this script
	../nearcore/start_sandbox.sh
	# touch $TARGETS/sandbox_started

# find/get sandbox master key
# ~/tmp/near-sandbox: $TARGETS/sandbox_started
# scp osboxes@nearnode:tmp/near-sandbox/validator_key.json ~/tmp/near-sandbox

# deploy stub contract & user
sandbox_deploy_stub: stub_release
	node tests/sandbox/tests.js deploy_stub

# deploy main contract & user
sandbox_deploy_distro: release
	node tests/sandbox/tests.js deploy_main

# create test users
sandbox_make_users:
	node tests/sandbox/tests.js make_test_users

sandbox_test: sandbox_deploy_stub sandbox_deploy_distro
	node tests/sandbox/tests.js


stubtest: stub_debug
	cargo test -p stub -- --nocapture


simtest: release $(wildcard tests/sim/*.rs)
	cargo test first_tests -- --nocapture

unittest: release debug 
	cd distrotron; make test

test: simtest unittest
	cargo test -- --nocapture

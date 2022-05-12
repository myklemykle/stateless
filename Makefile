# # handle synthetic targets with little empty files in .make_targets
# mkfile_home := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
# .TARGETS: 
# 	mkdir $(mkfile_home)/.TARGETS
#
# .TARGETS/foo: .TARGETS
# 	touch .TARGETS/foo
#
# foo: .TARGETS/foo

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



############
# test targets:

# run the unit tests of the distro contract:
unittest: release debug 
	cd distrotron; make test

# run simulator tests
# note: as of 5/1/2022 simulator tests still can't be compiled on a M1 mac
simtest: release $(wildcard tests/sim/*.rs)
	cargo test first_tests -- --nocapture

# run the unit tests of the stub contract:
stubtest: stub_debug
	cargo test -p stub -- --nocapture

#####
# sandbox tests -- testing in a live toy NEAR instance -- requires several steps.
# * build & test the sandbox -- not supported on M1 macs, so I do it on a seperate system
# * start the sandbox, either locally or remotely,
# * after launch of a remote sandbox, copy the master key to a local file
# * set up the blockchain state for testing -- deploy contracts, create users
# * then you can actually run the tests in tests/sandbox, using jest.
##
#
# * start sandbox 
#  (how do i test if its already running?)
#
.PHONY: sandbox_start
sandbox_start: 
	echo "starting sandbox:"
	#osascript -e 'tell application "Terminal" \n do script "../nearcore/start_sandbox.sh" \n end tell'  # need remote-exec version of this script
	../nearcore/start_sandbox.sh
	# touch $TARGETS/sandbox_started

##
# * TODO: find/get sandbox master key
# ~/tmp/near-sandbox: $TARGETS/sandbox_started 
## for a remote instance
# scp osboxes@nearnode:tmp/near-sandbox/validator_key.json ~/tmp/near-sandbox 
## (for local instance, tests can just find that file ...
#
##
# * set up state, then run all payment tests. This is the default.
sandboxtest: 
	cd tests/sandbox; npx jest -t setup; npx jest -t payment
#
##
# * setup state and run all tests, including a stress test that can take several minutes to finish.
sandboxtest_all: 
	cd tests/sandbox; npx jest 
#
##
# * just set up test state in the sandbox.
# deploying both contracts & setting up test users can take a couple minutes.
sandboxtest_setup: 
	cd tests/sandbox; npx jest -t setup
#
###
# * test against a mintbase contract in testnet.  
# (this will require various variables to be set up -- see the test script for a list.)
mintbasetest:
	cd tests/sandbox; npx jest -t setup; npx jest -t mintbase


##
# these other targets are useful while iterating during test-driven development:
#
# redeploy stub contract & user
sandbox_deploy_stub: stub_release
	cd tests/sandbox; npx jest -t "deploy stub"

# redeploy main contract & user
sandbox_deploy_distro: release
	cd tests/sandbox; npx jest -t "deploy distro"

# recreate test users
sandbox_make_users:
	cd tests/sandbox; npx jest -t "make test users"

# run payment tests against current state
sandbox_payment:
	cd tests/sandbox; npx jest -t "payment"



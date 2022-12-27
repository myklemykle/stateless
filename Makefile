

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

# # run simulator tests
# # note: as of 5/1/2022 simulator tests still can't be compiled on a M1 mac
# simtest: release $(wildcard tests/sim/*.rs)
# 	cargo test first_tests -- --nocapture

# run the unit tests of the stub contract:
stubtest: stub_debug
	cargo test -p stub -- --nocapture

#####
# sandbox tests -- testing in a live toy NEAR instance -- requires several steps.
#

NEARD_HOME := $${HOME}/.near
NEARD_KEY := ${NEARD_HOME}/validator_key.json
NEARCORE := ./nearcore

#########
#
# These targets can fetch, build, configure and run a local neard instance
# for sandbox tests.
#
#

LOCAL_NEARD_HOME := ${NEARD_HOME}

# neard will run in the local terminal until stopped:
local_sandbox_start: local_sandbox local_sandbox_init
	cd ${NEARCORE}; cargo run --profile quick-release -p neard -- --home ${NEARD_HOME} run


local_sandbox: local_sandbox_repo ${NEARCORE}/target/quick-release/neard

local_sandbox_repo: ${NEARCORE}

${NEARCORE}: 
	echo "cloning nearcore:"
	git clone https://github.com/near/nearcore ${NEARCORE}

${NEARCORE}/target/quick-release/neard:
	cd ${NEARCORE}; cargo build --profile quick-release -p neard 

local_sandbox_init: local_sandbox
	mkdir ${NEARD_HOME}; \
	cd ${NEARCORE}; cargo run --profile quick-release -p neard -- --home ${LOCAL_NEARD_HOME} init

############
#
# These targets can fetch, launch, configure and run a Docker image for sandbox tests.
#
docker_sandbox_start: 
	docker start distrotron_docker_sandbox || \
		mkdir ${NEARD_HOME}; \
		docker run -v ${NEARD_HOME}:/root/.near -p 3030:3030 --name distrotron_docker_sandbox nearprotocol/nearcore:latest \
		 /bin/bash -c "neard init; neard run"

docker_sandbox_stop: 
	docker kill distrotron_docker_sandbox
	docker rm distrotron_docker_sandbox


# ~/tmp/near-sandbox: $TARGETS/sandbox_started 
#
## for a remote instance
## (for local instance, tests can just find that file ...
#
#
#
#############
#
# These targets perform sandbox tests.
# They can run in localnet or testnet.
#
##
# * set up state, then run all payment tests. This is the default.
sandboxtest: 
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t setup; npx jest -t payment
#
##
# * setup state and run all tests, including a stress test that can take several minutes to finish.
sandboxtest_all: 
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest 
#
##
# * just set up test state in the sandbox.
# deploying both contracts & setting up test users can take a couple minutes.
sandboxtest_setup: 
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t setup
#
###
# * test against a mintbase contract in testnet.  
# (this will require various variables to be set up -- see the test script for a list.)
mintbasetest:
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t setup; \
		npx jest -t mintbase


##
# these other targets are useful while iterating during test-driven development:
#
# redeploy stub contract & user
sandbox_deploy_stub: stub_release
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t "deploy stub"

# redeploy main contract & user
sandbox_deploy_distro: release
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t "deploy distro"

# recreate test users
sandbox_make_users:
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t "make test users"

# run payment tests against current state.
# (The nature of the sandbox payment tests is that the test users will eventually run out of money;
# recreating the users is faster, in the long run, than rebalancing all of their accounts after every test.
# However you can run sandbox_payment at least 3 times before you have to recreate them.
# This has been a time-saver during iterative development & testing.
sandbox_payment:
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t "payment"


#####
# doc targets:
#

docs: 
	cd distrotron; cargo doc
	cd stub; cargo doc



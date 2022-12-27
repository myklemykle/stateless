

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

# run the unit tests of the stub contract:
stubtest: stub_debug
	cargo test -p stub -- --nocapture

#####
# sandbox tests -- testing in a live toy NEAR instance -- requires several steps.
#

# test scripts will need to find the validator key for the sandbox 
NEARD_HOME := $${HOME}/.near
NEARD_KEY := ${NEARD_HOME}/validator_key.json

#########
#
# These targets can fetch, build, configure and run a local neard instance
# for sandbox tests.
#
#

NEARCORE := ./nearcore

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
	cd ${NEARCORE}; cargo run --profile quick-release -p neard -- --home ${NEARD_HOME} init

############
#
# These targets can fetch, launch, configure and run a Docker image for sandbox tests.
# The image, nearprotocol/nearcore, is published by NEAR devs, and is compiled with
# AVX extensions that will not work on an M1 macintosh.
#
docker_sandbox_start: 
	docker start distrotron_docker_sandbox || \
		mkdir ${NEARD_HOME}; \
		docker run -v ${NEARD_HOME}:/root/.near -p 3030:3030 --name distrotron_docker_sandbox nearprotocol/nearcore:latest \
		 /bin/bash -c "neard init; neard run"

docker_sandbox_stop: 
	docker kill distrotron_docker_sandbox
	docker rm distrotron_docker_sandbox

#############
#
# These targets perform sandbox tests.
# They can be run in a localnet (on the local host, a remote host or in a Docker container)
# or even in the NEAR public testnet.
#
# TODO: document $NEARD_HOME and $NEARD_KEY,
# plus all environment variables the tests can use (NEAR_ENV & etc.)
#
##
# Default test: deploy contracts, create test users, run all payment tests.
sandboxtest: 
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t setup; \
		npx jest -t payment
#
##
# Set up state and run all tests, including a stress test that can take several minutes to finish.
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
# These other targets have been useful during development:
#
# redeploy only the stub contract & user
sandbox_deploy_stub: stub_release
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t "deploy stub"

# redeploy only the main distro contract & user
sandbox_deploy_distro: release
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t "deploy distro"

# recreate all of the test users, with their initial balances
sandbox_make_users:
	cd tests/sandbox; \
		export NEARD_HOME=${NEARD_HOME}; \
		export NEARD_KEY=${NEARD_KEY}; \
		npx jest -t "make test users"

# Run all the payment tests against the current contract state.
# 
# These payment tests shift balances of NEAR between users, 
# and will eventually cause some test users to be bankrupt,
# which is why the main test target re-initialzes users before running them.
#
# However you can run sandbox_payment at least 3 times before this is a problem.
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



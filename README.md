# stateless-distrotron

`distrotron` is a NEAR smart contract for evenly splitting a payment of NEAR tokens between several recipients. 
It has two public methods, both payable:

* `split_payment(payees: Vec<AccountId>)`
  * Divide an attached payment of NEAR evenly between the list of NEAR accounts in `payees`

* `pay_minters(minter_contract: AccountId)`
  * Divide an attached payment of NEAR evenly between the list of NEAR accounts returned by the `list_minters()` method of the specifid `minter_contract`.
	(`minter_contract` is intended to be a Mintbase store contract.)

Both of these methods return a NEAR `Balance` (currently a `BigInt`) of the net sum paid to each payee.

The other contract in this repo, `stub`, provides a stub implementation of `list_minters()` for sandbox testing.

## Requirements:

Some standard UNIX tools: `make`, `sed`. Windows users can install the [Gnuwin32](https://gnuwin32.sourceforge.net/) versions of these.

The NEAR contracts (and the `local_sandbox` targets) require the [Rust toolchain](https://rustup.rs/) and the [wasm32-unknown-unknown](https://www.hellorust.com/setup/wasm-target/) target for Rust.

The tests require [Node.js, npm](https://nodejs.org/en/download/) and [npx](https://www.npmjs.com/package/npx).

[Docker](https://www.docker.com/) is needed by the `docker_sandbox` test targets. (_Not supported on Apple Silicon._)

## Building:

* `make unittest` to build the contract and run some unit tests.

## Sandbox Testing:

Testing against a real NEAR instance is the best way to assure that all contract functions are correct.
There are several ways to do this:

* `make docker_sandbox_start` will launch a NEAR sandbox (a `neard` instance in `localnet` mode) in a Docker container.  
_Note for Mac users: at the time of this writing, this option does not work on Apple Silicon._

* `make local_sandbox_start` will clone the `neard` source from Github, then build and launch a local NEAR sandbox.

* You may also test against any other NEAR sandbox, by configuring these environment variables:
	* `NEAR_SANDBOX_NODE` -- hostname or IP of remote `neard`, or leave blank for `localhost`
	* `NEAR_SANDBOX_PORT` -- TCP port of `neard`, or leave blank for `3030`

* You may also run sandbox tests on the offical NEAR testnet. We use this mainly to confirm that tests past against an actual Mintbase contract as well as they do against our stub. To test on testnet, you must set at least these two environment variables:
    * `NEAR_ENV`="testnet"
    * `NEAR_TESTNET_ACCOUNT`="a.valid.account.on.NEAR.testnet"

Once one of those sandbox options is configured and running, 
* `make sandboxtest` to run the main sandbox tests
* `make sandboxtest_all` to run the main tests plus a time-consuming stress test.

## Deployment:

Deploy the contract with near-cli: `near deploy` or `near dev-deploy`

## Repo Contents:

`distrotron/`
  - The NEAR smart contract that divides a payment between all of the minters in a given Mintbase contract.

`stub/`
  - A test contract that provides the same `list_minters()` API as does a Mintbase contract

`tests/sandbox/`
  - A comprehensive set of sandbox tests, which exercise the contract against a live blockchain.

`package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`
  - Node.js and Cargo configuration files.

## Warnings:

* If any account in the payee list does not exist, that payment will stall, leaving the funds in this contract.  The other payments will still be completed.

* At the time of writing, the NEAR transaction gas limit (0.3 blocks' worth of gas) means a maximum of 87 recipients can be paid with one call to this contract. This number could change during contract development, or if the NEAR protocol ever adjusts that gas limit. The sandbox tests include a stress test that can find the limit through trial & error.


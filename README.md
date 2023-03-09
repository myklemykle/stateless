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

To build and test automatically in your browser, 
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/myklemykle/stateless/tree/milestone2_gitpod)

## Requirements:

Some standard UNIX tools: `make`, `sed`. Windows users can install the [Gnuwin32](https://gnuwin32.sourceforge.net/) versions of these.

The NEAR contracts (and the `local_sandbox` targets) require the [Rust toolchain](https://rustup.rs/) and the [wasm32-unknown-unknown](https://www.hellorust.com/setup/wasm-target/) target for Rust.

The tests require [Node.js, npm](https://nodejs.org/en/download/) and [npx](https://www.npmjs.com/package/npx).

[Docker](https://www.docker.com/) is needed by the `docker_sandbox` test targets. (_Not supported on Apple Silicon._)

## Building:

* `make release` to compile Distrotron for deployment.
* `make doc` to generate HTML docs from inline rustdoc documentation.

## Testing:

See TESTING.md .

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


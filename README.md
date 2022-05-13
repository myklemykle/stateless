# stateless-distrotron
This NEAR smart contract has two public payable methods:

* `pay_out(payees: Vec<AccountId>)`
  * Divide an attached payment of NEAR evenly between the list of users in `payees`

* `pay_minters(minter_contract: AccountId)`
  * Divide an attached payment of NEAR between a list of accounts returned by the `list_minters` method of `minter_contract`

Both of these methods return a NEAR `Balance` (currently a `BigInt`) of the net sum paid to each payee.

## Quick-ish start

* `make unittest` to build and test the contract

* Configure your environment for sandbox testing:
  * `export NEAR_ENV=testnet`
  * `export NEAR_TESTNET_ACCOUNT="some_account_on.testnet"`

* `make sandboxtest` to run sandbox tests

* Deploy the contract with near-cli: `near deploy` or `near dev-deploy`

## Repo Contents

`distrotron/`
  - The NEAR smart contract that divides a payment between all of the minters in a given Mintbase contract.

`stub/`
  - A test contract that provides the same `list_minters()` API as does a Mintbase contract

`tests/sim/`
  - A few tests for the NEAR Simulator (deprecated & doesn't cover everything)

`tests/sandbox/`
  - A comprehensive set of sandbox tests, which exercise the contract against a live blockchain.

## Building the contract

The Makefile includes these build targets:

* `release`
* `debug`
  * build the distrotron contract
  
* `stub_release`
* `stub_debug`
  * build the stub contract

## Testing the contract

The Makefile includes these test targets:

* `unittest` -- build and unit-test the distrotron contract
* `stubtest` -- build and unit-test the stub contract

* `simtest` -- run the simulator tests

* `sandbox_start` -- start the sandbox test environment
* `sandboxtest` -- run most of the sandbox tests
* `sandboxtest_all` -- run all of the sandbox tests
* `mintbasetest` -- test the distro contract against Mintbase's contract, instead of against the stub.  (testnet only)

NOTE: The sandbox tests run in a live blockchain instance, such as [the NEAR end-to-end sandbox test environment](https://docs.near.org/docs/develop/contracts/sandbox)

Because M1 Mac users can't yet build the sandbox locally,
these sandbox tests can be cofigured to run in a remote instance.  

Or, they can be run in the NEAR testnet. 
(Caution: testing in NEAR testnet is slower, 
and if you test too often you may be temporarily throttled.)

The inline doc in tests/sandbox/sandbox.tests.js 
has instructions how to configure the sandbox tests 
for a local sandbox, a remote sandbox or testnet.

## Warnings:

* If any account in the payee list does not exist, that payment will stall, leaving the funds in this contract.  The other payments will still be completed.

* At the time of writing, the NEAR transaction gas limit (0.3 blocks' worth of gas) means there is a practical maximum of about 40 users that can be paid with one method call on this contract.  Optimization might possibly increase that limit somewhat; gas cost per transaction could also change in NEAR.  The sandbox tests include a stress test that can find this limit through trial & error.

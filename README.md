# stateless-distrotron

distrotron/: the NEAR smart contract that divides a payment between all of the minters in a given Mintbase contract.
stub/: a test contract that provides the same list_minters() API as does a Mintbase contract
tests/sim/: a few tests for the NEAR Simulator (deprecated & doesn't cover everything)
tests/sandbox/: a set of sandbox tests, which exercise the contract against a live blockchain.

The Makefile includes these targets:

* release
* debug
  * build the distrotron contract
  
* stub_release
* stub_debug
  * build the stub contract
  
* unittest -- build and unit-test the distrotron contract
* stubtest -- build and unit-test the stub contract

* simtest -- run the simulator tests

* sandbox_start -- start the sandbox test environment
* sandboxtest -- run most of the sandbox tests
* sandboxtest_all -- run all of the sandbox tests
* mintbasetest -- test the distro contract against Mintbase's contract, instead of against the stub.  (testnet only)

NOTE: The sandbox tests require the NEAR end-to-end sandbox test environment:
https://docs.near.org/docs/develop/contracts/sandbox

Because M1 Mac users can't yet build the sandbox locally,
these sandbox tests can be cofigured to run in a remote sandbox.  

Or, they can be run in the NEAR testnet. 
(Caution: testing in NEAR testnet is slower, 
and if you test too often you may be temporarily throttled.)

The inline doc in tests/sandbox/sandbox.tests.js 
has instructions how to configure the sandbox tests 
for a local sandbox, a remote sandbox or testnet.

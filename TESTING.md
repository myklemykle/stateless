# Testing the contract: 

## Requirements:

The tests require [Node.js, npm](https://nodejs.org/en/download/) and [npx](https://www.npmjs.com/package/npx).

[Docker](https://www.docker.com/) is needed by the `docker_sandbox` test targets. (_Not supported on Apple Silicon._)

## Unit Testing:

* `make unittest` to build the contract and run unit tests.

## Sandbox Setup:

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

## Sandbox Testing:

Once one of those sandbox options is configured and running, 
* `make sandboxtest` to run the main sandbox tests
* `make sandboxtest_all` to run the main tests plus a time-consuming stress test.


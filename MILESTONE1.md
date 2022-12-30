# Milestone 1 Submission for Mintbase Grants Program

* Project: (Distrotron)[https://github.com/myklemykle/Grants-Program/blob/main/applications/cootoo.md]
* Source code: https://github.com/myklemykle/stateless/tree/milestone1_gitpod
* License: [Unlicense](https://unlicense.org/)
* Documentation: [README.md](https://github.com/myklemykle/stateless/blob/milestone1_gitpod/README.md) gives an overview. Inline Rust documentation describes the contract API.
* Code format: [rustfmt](https://github.com/rust-lang/rustfmt) & [Standard JS](https://standardjs.com/)
Testing Guide: [TESTING.md](https://github.com/myklemykle/stateless/blob/milestone1_gitpod/README.md) tells how to use `make` targets to run all tests at the command line, including options to deploy the contract on a sandbox node or on the public NEAR testnet.
* Deliverables:
|  |  |  |
|---|---|---|
| # | Deliverable | Specification |
| 1.  | Distribution Contract | Distrotron, the Distribution Contract, distributes a single payment equally between all NEAR accounts defined as minters on a given Mintbase store contract.  It makes a cross-contract call to the list_minters() method of a Mintbase store contract to fetch that minters list.  |
| 2 | Mock Mintbase Contract | For testing the Distribution Contract, we developed a Mock Contract that provides the same list_minters() method as a real Mintbase store contract, and that can be configured to return arbitrary test output or exhibit various failure modes.  |
| 3 | Fuel Economy | The Distribution Contract gas consuption has been analyzed and tuned to minimize gas-per-minter and maximize the number of minters that can be paid in one invocation, given the hard limit on gas-per-method-call built into the NEAR blockchain. Today, the contract supports payments to 80 users in a single NEAR method call.  |


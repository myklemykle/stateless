# Milestone 2 Submission for Mintbase Grants Program

* Project: [Distrotron](https://github.com/myklemykle/Grants-Program/blob/main/applications/cootoo.md)
* Source code: [GitHub](https://github.com/myklemykle/stateless/tree/milestone2_gitpod)
* License: [Unlicense](https://unlicense.org/)
* Documentation: [README.md](https://github.com/myklemykle/stateless/blob/milestone2_gitpod/README.md) gives an overview. Inline Rust documentation describes the contract API. "make help" documents Makefile targets .
* Code format: [rustfmt](https://github.com/rust-lang/rustfmt) & [Standard JS](https://standardjs.com/)
* Testing Guide: [TESTING.md](https://github.com/myklemykle/stateless/blob/milestone2_gitpod/README.md) tells how to use `make` targets to run all tests at the command line, including options to deploy the contract on a sandbox node or on the public NEAR testnet.


## Deliverables:

1: *Distribution Interface*	

We created and hosted [a single-page web interface](https://statelessart.org/cootoo.html) to inspect the minters list of a Mintbase contract, and to distribute a payment to those users via our Distribution Contract. ([The github repo for that interface](https://github.com/STATELESSART/distrotron-demo) is a sub-module of [the main repo.](https://github.com/myklemykle/stateless/tree/milestone2_gitpod)) We also deployed the Contract on testnet, and hosted the same interface for that instance [here](http://testnet.statelessart.org/cootoo.html).

2: *NEAR Wallet integration*	

The Distribution Interface integrates with the web-based [NEAR Wallet](https://wallet.near.org) for authentication & payment authorization.

3: *NEAR Explorer integration*	

The Distribution Interface integrates with the web-based [NEAR Explorer](https://explorer.near.org). After a transaction succeds, the Ditribution Interface gives a link to inspect the entire transaction in the Explorer. Furthermore, the Distribution Contract now annotates the transaction to confirm individual payments and/or report individual errors. These annotations are visible in the Explorer.

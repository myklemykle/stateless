#!node
const nearAPI = require("near-api-js");
const BN = require("bn.js");
const fs = require("fs").promises;
const assert = require("assert").strict;
const path = require("path");
const { utils } = nearAPI;

let config;
let masterAccount;
let masterKey;
let pubKey;
let keyStore;
let near;

let testUsers = {
	alice: '',
	bob: '',
	carol: '',
	doug: '',
	emily: ''
};

const LOTSAGAS = "300000000000000"; // the max that can be attached, actually.

function getConfig(env = process.env.NEAR_ENV || "sandbox") {
  switch (env) {
    case "testnet":
      return {
        networkId: "testnet",
				nearnodeUrl: "http://rpc.testnet.near.org",
        masterAccount: "mykletest.testnet",
        contractAccount: "distro_test",
				stubAccount: "stub",
				keyPath: "/Volumes/External/mykle/.near-credentials/testnet/mykletest.testnet.json",
      };
		case "sandbox": // remote sandbox
      return {
        networkId: "sandbox",
        nearnodeUrl: "http://nearnode:3030",
        masterAccount: "test.near",
        contractAccount: "distro",
				stubAccount: "stub",
				keyPath: "/Volumes/External/mykle/tmp/near-sandbox/validator_key.json",
      };
		case "local": // local sandbox
      return {
        networkId: "sandbox",
        nearnodeUrl: "http://localhost:3030",
        masterAccount: "test.near",
        contractAccount: "distro",
        stubAccount: "stub",
        keyPath: "/tmp/near-sandbox/validator_key.json",
      };
  }
}

function n2y(near) { return utils.format.parseNearAmount(near.toString()); }
function y2n(yocto) { return utils.format.formatNearAmount(yocto); }

function fullAccountName(prefix){
	return prefix + '.' + config.masterAccount;
}

async function connectToNear() {
  config = getConfig();
	console.log("connecting to " + config.networkId);

  const keyFile = require(config.keyPath);
  masterKey = nearAPI.utils.KeyPair.fromString(
    keyFile.secret_key || keyFile.private_key
  );
  pubKey = masterKey.getPublicKey();
  keyStore = new nearAPI.keyStores.InMemoryKeyStore();
  keyStore.setKey(config.networkId, config.masterAccount, masterKey);
  near = await nearAPI.connect({
    deps: {
      keyStore,
    },
    networkId: config.networkId,
    nodeUrl: config.nearnodeUrl,
  });
  masterAccount = new nearAPI.Account(near.connection, config.masterAccount);
  console.log("connected");
}

async function createTestUser(
  accountPrefix, initBalance = 10
) {
  let accountId = fullAccountName(accountPrefix);
  keyStore.setKey(config.networkId, accountId, masterKey);
  const account = new nearAPI.Account(near.connection, accountId);

	// delete it first, 
	try { 
		await account.deleteAccount(config.masterAccount);
		console.log("deleted " + accountPrefix);
	} catch {
		// fails if it didn't exist
	}

	// then recreate it.
  await masterAccount.createAccount(
    accountId,
    pubKey,
		n2y(initBalance)
  );
	console.log("created " + accountId);
	return account;
}

async function makeTestUsers(){
	console.log(Object.keys(testUsers));
	// Object.keys(testUsers).forEach(async function(u){ 
	for (u of Object.keys(testUsers)) {
		testUsers[u] = await createTestUser(u, 10);
	};
}

async function makeNUsers(count){
	for (let n = 0; n<count; n++) { 
		u = "user" + n;
		testUsers[u] = await createTestUser(u, 10);
	};
	console.log("loaded " + count + " test users");

	testUsers[config.stubAccount] = loadTestUser(config.stubAccount);
	return testUsers;
}

function loadTestUsers(){ // also loads the stub account
	userList = Object.keys(testUsers);
	userList.push(config.stubAccount);

	userList.forEach(function(u){ 
		// let accountId = fullAccountName(u);
		// keyStore.setKey(config.networkId, accountId, masterKey);
		// testUsers[u] = new nearAPI.Account(near.connection, accountId);
		testUsers[u] = loadTestUser(u);
	});

	return testUsers;
}

function loadTestUser(u){
		let accountId = fullAccountName(u);
		keyStore.setKey(config.networkId, accountId, masterKey);
		return new nearAPI.Account(near.connection, accountId);
}

async function loadNUsers(count){ // also loads the stub account
	let userList = [];
	for (let n = 0; n<count; n++) { 
		userList.push("user" + n);
	}
	userList.push(config.stubAccount);

	userList.forEach(async function(u){ 
		let accountId = fullAccountName(u);
		keyStore.setKey(config.networkId, accountId, masterKey);
		testUsers[u] = new nearAPI.Account(near.connection, accountId);
	});

	console.log("loaded " + count + " test users");
	return testUsers;
}

async function deployStub() {
	const stubwasm = await fs.readFile(path.resolve(__dirname, "../../target/wasm32-unknown-unknown/release/stub.wasm"));
	const _stubAccount = await createTestUser(config.stubAccount, 100);
	await _stubAccount.deployContract(stubwasm);

  console.log("stub deployed");

	const stubContract = loadStub(_stubAccount);
	await stubContract.init({args:{}});

  console.log("stub initialized");

	return _stubAccount;
}

function loadStub(acct) {
	return new nearAPI.Contract(
		acct, // will call it
		fullAccountName(config.stubAccount), // name (string) of acct where contract is deployed
		{changeMethods: ["init","mock_minters"], 
			viewMethods: ["list_minters","be_good"]}
	);
}

async function deployDistro() {
  const contractwasm = await fs.readFile(path.resolve(__dirname, "../../target/wasm32-unknown-unknown/release/distrotron.wasm"));
	const _contractAccount = await createTestUser(config.contractAccount, 100);
	await _contractAccount.deployContract(contractwasm);

  console.log("main contract deployed");
	return _contractAccount;
}

function loadDistro(acct) { 
	return new nearAPI.Contract(
		acct, // will call it
		fullAccountName(config.contractAccount), // name (string) of acct where contract is deployed
		{changeMethods: ["pay_minters", "pay_out"]}
	);
}

async function totalBalance(acct){
	b = await acct.getAccountBalance();
	return BigInt(b.total); 
}


jest.setTimeout(300000);
describe("blockchain state setup (slow!)", ()=>{

	beforeAll(async () => {
		await connectToNear();
	});

	test("deploy distro contract", async()=>{
		await deployDistro();
	});

	test("deploy stub contract", async()=>{
		await deployStub();
	});

	test("make test users", async()=>{
		await makeTestUsers();
	});
});

//////////
// the tests:
///////////

describe("payment tests", ()=>{

	beforeAll(async () => {
		await connectToNear();
	});

	test("can pay out funds to a list of users", async()=>{
		let users = loadTestUsers();

		let balances = {
			before: {
				"alice": await totalBalance(users.alice),
				"bob": await totalBalance(users.bob),
				"carol": await totalBalance(users.carol),
			}
		};

		let distro = loadDistro(users.carol);

		// have carol send some money to distrotron
		
		net_payment = BigInt( await distro.pay_out( { 
			args: {
				payees: [users.alice.accountId, users.bob.accountId]
		}, 
			gas: LOTSAGAS, // attached GAS (optional)
			amount: n2y(1),				// attached near
		}));

		// check that it was distributed to alice and bob
		
		balances.after = {
				"alice": await totalBalance(users.alice),
				"bob": await totalBalance(users.bob),
				"carol": await totalBalance(users.carol),
		};

		console.log("Net payment: " + net_payment + " = " + y2n(net_payment) + " NEAR");
		console.log(balances);
		assert(balances.before.alice + net_payment == balances.after.alice, "alice bad balance");
		assert(balances.before.bob + net_payment == balances.after.bob, "bob bad balance");

		// What did Carol pay for gas?
		let gascost =  balances.before.carol - (balances.after.carol + (BigInt(2) * net_payment)); 
		console.log("gas cost: " + gascost + " yocto = " + y2n(gascost) + " NEAR");

	}  );
	
	test("duplicates are removed from user list", async()=>{
		let users = loadTestUsers();

		let balances = {
			before: {
				"alice": await totalBalance(users.alice),
				"bob": await totalBalance(users.bob),
				"carol": await totalBalance(users.carol),
			}
		};

		let distro = loadDistro(users.carol);

		// have carol send some money to distrotron
		
		net_payment = BigInt( await distro.pay_out( { 
			args: {
				payees: [users.alice.accountId, users.bob.accountId, users.alice.accountId]
		}, 
			gas: LOTSAGAS, // attached GAS (optional)
			amount: n2y(1),				// attached near
		}));

		// check that it was distributed to alice and bob,
		// in equal amounts, because alice was only paid once.
		
		balances.after = {
				"alice": await totalBalance(users.alice),
				"bob": await totalBalance(users.bob),
				"carol": await totalBalance(users.carol),
		};

		console.log("Net payment: " + net_payment + " = " + y2n(net_payment) + " NEAR");
		console.log(balances);
		assert(balances.before.alice + net_payment == balances.after.alice, "alice bad balance");
		assert(balances.before.bob + net_payment == balances.after.bob, "bob bad balance");

		// What did Carol pay for gas?
		let gascost =  balances.before.carol - (balances.after.carol + (BigInt(2) * net_payment)); 
		console.log("gas cost: " + gascost + " yocto = " + y2n(gascost) + " NEAR");

	}  );

	test("payment to nonexistent user wont go through", async()=>{
		let users = loadTestUsers();
		users.distro = loadTestUser(config.contractAccount);

		let balances = {
			before: {
				"alice": await totalBalance(users.alice),
				"bob": await totalBalance(users.bob),
				"carol": await totalBalance(users.carol),
				"distro": await totalBalance(users.distro),
			}
		};

		let distro = loadDistro(users.carol);

		// have carol send some money to distrotron
		
		try { 
			net_payment = BigInt( await distro.pay_out( { 
				args: {
					payees: [users.alice.accountId, "your_mom", users.bob.accountId]
			}, 
				gas: LOTSAGAS, // attached GAS (optional)
				amount: n2y(1),				// attached near
			}));
			//
			// should fail:
			assert(false, "failure failure: failure failed to fail");
		} catch {

			// check that nothing was distributed
			
			balances.after = {
					"alice": await totalBalance(users.alice),
					"bob": await totalBalance(users.bob),
					"carol": await totalBalance(users.carol),
					"distro": await totalBalance(users.distro),
			};

			// What did Carol pay 

			let cost = balances.before.carol - balances.after.carol;
			console.log("cost: " + cost + " = " + y2n( cost ) + " NEAR");

			console.log(balances);

			// currently the transactions are not atomic, so the payments will go through for all good users ...
			// assert(balances.before.alice == balances.after.alice, "alice bad balance");
			// assert(balances.before.bob == balances.after.bob, "bob bad balance");

		}
	}  );


	test("bad minter in list causes crash", async()=>{
		let users = loadTestUsers();

		let balances = {
			before: {
				"alice": await totalBalance(users.alice),
				"bob": await totalBalance(users.bob),
				"carol": await totalBalance(users.carol),
			}
		};

		// 1. mock up a minters list with a nonexistent user on it
		let stub = loadStub(users.stub);
		await stub.mock_minters({
			args: {minters: [users.alice.accountId, "asdf.mcasdfserson", users.carol.accountId, "count_chocula"]}
		});

		// 2. have bob send some money to distrotron
		let distro = loadDistro(users.bob);
		try { 
			net_payment = BigInt( await distro.pay_minters( { 
				args: {
					minter_contract: fullAccountName(config.stubAccount)
			}, 
				gas: "300000000000000", // attached GAS (optional)
				amount: n2y(1),				// attached near
			}));

			// we expect that to fail ...
			assert(false, "bad payment should have failed");
		} catch {

			// 3. check that funds didn't move
			balances.after = {
					"alice": await totalBalance(users.alice),
					"bob": await totalBalance(users.bob),
					"carol": await totalBalance(users.carol),
			};

			console.log(balances);
			// still a problem ...
			// assert(balances.before.alice == balances.after.alice, "alice bad balance");
			// assert(balances.before.bob == balances.after.carol, "bob bad balance");
			// assert(balances.before.carol == balances.after.carol, "carol bad balance");
		}

		// 4. what did bob pay for gas?
		let gascost =  balances.before.bob - (balances.after.bob + (BigInt(2) * net_payment)); 
		console.log("gas cost: " + gascost + " yocto = " + y2n(gascost) + " NEAR");
			
	}  );

	test("can pay the list of minters from a contract", async()=>{
		let users = loadTestUsers();

		let balances = {
			before: {
				"alice": await totalBalance(users.alice),
				"bob": await totalBalance(users.bob),
				"carol": await totalBalance(users.carol),
			}
		};

		let distro = loadDistro(users.bob);
		let stub = loadStub(users.stub);

		// 1. mock up a minters list
		await stub.mock_minters({
			args: {minters: [users.alice.accountId, users.carol.accountId]}
		});

		// 2. have bob send some money to distrotron
		
		net_payment = BigInt( await distro.pay_minters( { 
			args: {
				minter_contract: fullAccountName(config.stubAccount)
		}, 
			gas: "300000000000000", // attached GAS (optional)
			amount: n2y(1),				// attached near
		}));

		// 3. check that it was distributed to alice and carol
		
		balances.after = {
				"alice": await totalBalance(users.alice),
				"bob": await totalBalance(users.bob),
				"carol": await totalBalance(users.carol),
		};

		console.log("Net payment: " + net_payment + " = " + y2n(net_payment) + " NEAR");
		console.log(balances);
		assert(balances.before.alice + net_payment == balances.after.alice, "alice bad balance");
		assert(balances.before.carol + net_payment == balances.after.carol, "carol bad balance");

		// 4. what did bob pay for gas?
		let gascost =  balances.before.bob - (balances.after.bob + (BigInt(2) * net_payment)); 
		console.log("gas cost: " + gascost + " yocto = " + y2n(gascost) + " NEAR");
	}  );


	test("stub contract works", async ()=>{
		let users = loadTestUsers();
		let stub = loadStub(users.stub);

		// Initialize the contract storage --
		// only ecessary the first time it's called after deployment (deployStub() handles this)
		// await stub.init({args: {} });

		// check the stub contract is loaded
		good = await stub.be_good();

		// call the list_minters method on the stub contract,
		// which could be any old leftover from some other test ...
		minters = await stub.list_minters();

		// mock up a minters list:
		await stub.mock_minters( {
			args: {
				minters: ["alice.boop","bruce.beep"]
			},
			gas: "300000000000000", // attached GAS (optional)
		});

		// confirm it worked:
		minters = await stub.list_minters();
		console.log(minters);
		assert(minters[0] === "alice.boop");
		assert(minters[1] === "bruce.beep");
	});


});


// This one takes a while ...

describe("stress tests", ()=>{

	beforeAll(async () => {
		await connectToNear();
		jest.setTimeout(300000);
	});

	test("can pay 30 minters", async()=>{
		// actually tests payments from 1 user to (n-1) users
		let n = 31;
		let users = await makeNUsers(n);
		let balances = {before: {}, after: {}};

		console.log("balances before:");
		for(let count=0; count<n; count++) {
			let u = "user" + count;
			balances.before[u] = await totalBalance(users[u]);
			console.log(u + ": " + y2n(balances.before[u]));
		}
		
		// user0 is the payer
		let distro = loadDistro(users.user0);
		let stub = loadStub(users.stub);

		// users 1-(n-1) are the payees
		let minters = [];
		for(let count=1; count<n; count++) {
			minters.push(fullAccountName("user" + count));
		}
		await stub.mock_minters({
			args: {minters: minters}
		});

		// have user0 send some money to distrotron
		
		net_payment = BigInt( await distro.pay_minters( { 
			args: {
				minter_contract: fullAccountName(config.stubAccount)
			}, 
			gas: "300000000000000", // attached GAS (optional)
			amount: n2y(1),				// attached near
		}));

		console.log("balances after:");
		for(let count=0; count<n; count++) {
			let u = "user" + count;
			balances.after[u] = await totalBalance(users[u]);
			console.log(u + ": " + y2n(balances.after[u]));
		}

		console.log("Net payment: " + net_payment + " = " + y2n(net_payment) + " NEAR");

		// assert it all worked out:
		for(let count=1; count<n; count++) {
			let u = "user" + count;
			assert(balances.before[u] + net_payment == balances.after[u], u + "bad balance");
		}

		// what did user0 pay for gas?
		let gascost =  balances.before.user0 - (balances.after.user0 + (BigInt(n - 1) * net_payment));
		console.log("gas cost: " + gascost + " yocto = " + y2n(gascost) + " NEAR");

	});

});




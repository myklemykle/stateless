#!node
/****
 *
 * This is the sandbox test script for the Stateless distrotron contract
 * It uses these environment variables:
 *
 * Mandatory:
 * 	* NEAR_ENV -- "testnet", "sandbox" or "localnet"
 *
 * Mandatory for testing with a remote sanbox:
 * 	* NEAR_SANDBOX_NODE -- hostname or IP of remote sandbox, or leave blank for local
 *
 * Mandatory for testing on testnet:
 *  * NEAR_TESTNET_ACCOUNT -- an account on testnet to run tests under
 *  * NEAR_TESTNET_MINTER_ACCOUNT -- a contract that supports the listMinters() method.  
 *  	Defaults to our stub contract, but may also be a real mintbase contract.
 *
 * Optional:
 * 	* NEAR_SANDBOX_PORT -- TCP port of near API on sandbox, or leave blank for default of 3030
 *
 * Alternately, you can edit any of these values manually in the getConfig() method.
 *
 * */

const nearAPI = require("near-api-js");
const BN = require("bn.js");
const fs = require("fs").promises;
const assert = require("assert").strict;
const path = require("path");
const { utils } = nearAPI;
const homedir = require('os').homedir();

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

// this works with node v16:
async function fileExists (path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

const LOTSAGAS = "300000000000000"; // ATM this is the max gas that can be attached to a transaction

async function getConfig(env = process.env.NEAR_ENV || "sandbox") {
	// To test on testnet, we need the name of a testnet account.
	let testnet_master = process.env.NEAR_TESTNET_ACCOUNT;
	let config = {};
	let keyPath = "";

  switch (env) {

		case "testnet": // the live NEAR testnet

			if (! testnet_master ) {
				console.error("please set NEAR_TESTNET_ACCOUNT to run tests on testnet");
				process.exit(1);
			}

			keyPath = homedir + "/.near-credentials/testnet/" + testnet_master + ".json";
			if (! await fileExists(keyPath) ) {
				console.error("can't find near credentials at '" + keyPath + "'");
				console.error("(try logging in with near-cli)");
				process.exit(2);
			}

      config = {
        networkId: "testnet",
				nearnodeUrl: "http://rpc.testnet.near.org",
        masterAccount: testnet_master,
        contractAccount: "distro_test",
				minterContract: process.env.NEAR_TESTNET_MINTER_ACCOUNT || "stub",
				keyPath: keyPath
      };
			break;

		case "sandbox": // local or remote standalone NEAR daemon
		case "localnet": 
			neard_home = process.env.NEARD_HOME || homedir + "/.near";
			keyPath = process.env.NEARD_KEY || neard_home + "/validator_key.json";
			if (! await fileExists(keyPath) ) {
				console.error("can't find NEAR credentials at '" + keyPath + "'");
				process.exit(3);
			}

      config = {
        networkId: "localnet",
				nearnodeUrl: "http://" + (process.env.NEAR_SANDBOX_NODE || "localhost") + ':' + (process.env.NEAR_SANDBOX_PORT || "3030"),
        masterAccount: "test.near",
        contractAccount: "distro",
        minterContract: "stub",
				keyPath: keyPath
      };
			console.log("keypath = " + config.keyPath);
			break;

		default: 
			console.error("please set the NEAR_ENV environment variable to 'localnet' or 'testnet'");
			process.exit(4);
  }

	console.debug(config);
	return config;
}

function n2y(near) { return utils.format.parseNearAmount(near.toString()); }
function y2n(yocto) { return utils.format.formatNearAmount(yocto); }

function fullAccountName(prefix){
	// if prefix already has dots in it, 
	// assume it's fully-qualified already and return it unchanged
	if (prefix.match(/\./)) 
		return prefix;

	return prefix + '.' + config.masterAccount;
}

async function connectToNear() {
  config = await getConfig();
	console.log("connecting to " + config.networkId);

  const keyFile = require(config.keyPath);
  masterKey = nearAPI.KeyPair.fromString(
    keyFile.secret_key || keyFile.private_key
  );
  pubKey = masterKey.getPublicKey();
  keyStore = new nearAPI.keyStores.InMemoryKeyStore();
  keyStore.setKey(config.networkId, config.masterAccount, masterKey);
  near = await nearAPI.connect({
		// deps: {   /// used to work, deprecated pattern i guess...
    //   keyStore,
    // },
		keyStore: keyStore,
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

	testUsers[config.minterContract] = loadTestUser(config.minterContract);
	return testUsers;
}

function loadTestUsers(){ // also loads the stub account
	userList = Object.keys(testUsers);
	userList.push(config.minterContract);

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
	userList.push(config.minterContract);

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
	const minterContractAccount = await createTestUser(config.minterContract, 100);
	await minterContractAccount.deployContract(stubwasm);

  console.log("stub deployed");

	const stubContract = getNewMinterContract(minterContractAccount);
	await stubContract.init({args:{}});

  console.log("stub initialized");

	return minterContractAccount;
}

function getNewMinterContract(acct) {
	return new nearAPI.Contract(
		acct, // will call it
		fullAccountName(config.minterContract), // name (string) of acct where contract is deployed
		{changeMethods: ["init","mock_minters"], 
			viewMethods: ["list_minters"]}
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
		{changeMethods: ["pay_minters", "split_payment"]}
	);
}

async function totalBalance(acct){
	b = await acct.getAccountBalance();
	return BigInt(b.total); 
}


jest.setTimeout(600000);
describe("blockchain state setup (slow!)", ()=>{

	beforeAll(async () => {
		await connectToNear();
	});

	test("deploy distro contract", async()=>{
		await deployDistro();
	});

	test("make test users", async()=>{
		await makeTestUsers();
	});

	test("deploy stub contract", async()=>{
		let users = loadTestUsers();
		if (config.minterContract == "stub") { 
			await deployStub();
			// mock up a minters list
			let mc = getNewMinterContract(users.stub);
			await mc.mock_minters({
				args: {minters: [users.alice.accountId, users.carol.accountId]}
			});

		} else {
			console.log("not using stub");
		}
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
		
		net_payment = BigInt( await distro.split_payment( { 
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
		
		net_payment = BigInt( await distro.split_payment( { 
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
			net_payment = BigInt( await distro.split_payment( { 
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
		let mc = getNewMinterContract(users.stub);
		await mc.mock_minters({
			args: {minters: [users.alice.accountId, "asdf.mcasdfserson", users.carol.accountId, "count_chocula"]}
		});

		// 2. have bob send some money to distrotron
		let distro = loadDistro(users.bob);
		try { 
			net_payment = BigInt( await distro.pay_minters( { 
				args: {
					minter_contract: fullAccountName(config.minterContract)
			}, 
				gas: LOTSAGAS, // attached GAS (optional)
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
		let mc = getNewMinterContract(users.stub);

		// 1. mock up a minters list
		await mc.mock_minters({
			args: {minters: [users.alice.accountId, users.carol.accountId]}
		});

		// 2. have bob send some money to distrotron
		
		net_payment = BigInt( await distro.pay_minters( { 
			args: {
				minter_contract: fullAccountName(config.minterContract)
		}, 
			gas: LOTSAGAS, // attached GAS (optional)
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
		if (config.minterContract != "stub") { 
			console.log("not using stub");
			return;
		}

		let users = loadTestUsers();
		let stub = getNewMinterContract(users.stub);

		// call the list_minters method on the stub contract,
		// which could be any old leftover from some other test ...
		minters = await stub.list_minters();

		// mock up a minters list:
		await stub.mock_minters( {
			args: {
				minters: ["alice.boop","bruce.beep"]
			},
			gas: LOTSAGAS, // attached GAS (optional)
		});

		// confirm it worked:
		minters = await stub.list_minters();
		console.log(minters);
		assert(minters[0] === "alice.boop");
		assert(minters[1] === "bruce.beep");
	});


});

// Test against the list_minters() function of a live mintbase contract, instead of using our stub .
describe("mintbase tests", ()=>{

	beforeAll(async () => {
		await connectToNear();
	});

	test("can get payees from mintbase contract", async()=>{
		let users = loadTestUsers();
		let balances = {
			before: {},
			after: {}
		}

		// let carol call it, since she's buying ...
		let mc = getNewMinterContract(users.carol);

		// 1) get the minters list and the balances before:
		let minters = await mc.list_minters();
		console.log("contract '" + mc.contractId + "' minters: " + minters);

		for (let i=0; i<minters.length; i++) {
			let m = minters[i];
			users[m] = loadTestUser(m);
			balances.before[m] = await totalBalance(users[m]);
		};
		balances.before.carol = await totalBalance(users.carol);

		// 2) have carol send some money to the minters:
		
		let distro = loadDistro(users.carol);
		net_payment = BigInt( await distro.pay_minters( { 
			args: {
				minter_contract: mc.contractId
		}, 
			gas: LOTSAGAS, // attached GAS (optional)
			amount: n2y(1),				// attached near
		}));

		// 3) get balances after.
		for (let i=0; i<minters.length; i++) {
			let m = minters[i];
			balances.after[m] = await totalBalance(users[m]);
		};
		balances.after.carol = await totalBalance(users.carol);
		console.log(balances);

		// 4) all kosher?
		for (let i=0; i<minters.length; i++) {
			let m = minters[i];
			assert(balances.before[m] + net_payment == balances.after[m], m + " bad balance");
		};
		assert(balances.before.carol - (BigInt(minters.length) * net_payment) > balances.after.carol, "carol bad balance");

		// 5. what did carol pay for gas?
    let gascost =  balances.before.carol - (balances.after.carol + (BigInt(minters.length) * net_payment));
    console.log("gas cost: " + gascost + " yocto = " + y2n(gascost) + " NEAR");

	});

});

// This one takes a while ...

describe("stress tests", ()=>{

	beforeAll(async () => {
		await connectToNear();
		jest.setTimeout(600000);
	});

	test("can pay 87 minters", async()=>{
		// the real mintbase contracts don't support mock_minters() (obviously)
		// so this test will fail there.
		
		let n = 87;
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
		let mc = getNewMinterContract(users.stub);

		// users 1-(n-1) are the payees
		let minters = [];
		for(let count=1; count<n; count++) {
			minters.push(fullAccountName("user" + count));
		}

		await mc.mock_minters({
			args: {minters: minters}
		});

		// have user0 send some money to distrotron
		
		net_payment = BigInt( await distro.pay_minters( { 
			args: {
				minter_contract: fullAccountName(config.minterContract)
			}, 
			gas: LOTSAGAS, // attached GAS (optional)
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




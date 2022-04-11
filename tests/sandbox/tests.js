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

function getConfig(env) {
  switch (env) {
    case "testnet":
      return {
        networkId: "testnet",
        // nearnodeUrl: "http://23.23.23.101:3030",
        masterAccount: "mykletest.testnet",
        contractAccount: "distro_test",
				stubAccount: "stub",
				keyPath: "/Volumes/External/mykle/.near-credentials/testnet/mykletest.testnet.json",
      };
    case "sandbox":
      return {
        networkId: "sandbox",
        nearnodeUrl: "http://nearnode:3030",
        masterAccount: "test.near",
        contractAccount: "distro",
				stubAccount: "stub",
				keyPath: "/Volumes/External/mykle/tmp/near-sandbox/validator_key.json",
      };
    case "local":
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

function n2y(near) {
	return utils.format.parseNearAmount(near.toString());
}
function y2n(yocto) { 
	return utils.format.formatNearAmount(yocto);
}

function fullAccountName(prefix){
	return prefix + '.' + config.masterAccount;
}

async function connectToSandbox() {
	console.log("connecting to " + (process.env.NEAR_ENV || "sandbox"));
  config = getConfig(process.env.NEAR_ENV || "sandbox");
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
  accountPrefix, initBalance = 100
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
	Object.keys(testUsers).forEach(async function(u){ 
		testUsers[u] = await createTestUser(u, 1000);
	});
}

async function loadTestUsers(){
	userList = Object.keys(testUsers);
	userList.push(config.stubAccount);

	userList.forEach(async function(u){ 
		let accountId = fullAccountName(u);
		keyStore.setKey(config.networkId, accountId, masterKey);
		testUsers[u] = new nearAPI.Account(near.connection, accountId);
	});

	return testUsers;
}

async function deployStub() {
	const stubwasm = await fs.readFile(path.resolve(__dirname, "../../target/wasm32-unknown-unknown/release/stub.wasm"));
	const _stubAccount = await createTestUser(config.stubAccount);
	await _stubAccount.deployContract(stubwasm);

  console.log("stub deployed");

	const stubContract = new nearAPI.Contract(
		_stubAccount, // will call it
		fullAccountName(config.stubAccount), // name (string) of acct where contract is deployed
		{changeMethods: ["init","mock_minters"], 
			viewMethods: ["list_minters","be_good"]}
	);
	await stubContract.init({args:{}});

  console.log("stub initialized");

	return _stubAccount;
}

async function deployMain() {
  const contractwasm = await fs.readFile(path.resolve(__dirname, "../../target/wasm32-unknown-unknown/release/distrotron.wasm"));
	const _contractAccount = await createTestUser(config.contractAccount, 10000);
	await _contractAccount.deployContract(contractwasm);

  console.log("main contract deployed");
	return _contractAccount;
}

async function totalBalance(acct){
	b = await acct.getAccountBalance();
	return BigInt(b.total); 
}

async function testPayOut() {
	let users = await loadTestUsers();

	let balances = {
		before: {
			"alice": await totalBalance(users.alice),
			"bob": await totalBalance(users.bob),
			"carol": await totalBalance(users.carol),
		}
	};

	const distro = new nearAPI.Contract(
		users.carol, // will call it
		fullAccountName(config.contractAccount), // name (string) of acct where contract is deployed
		{changeMethods: ["pay_out", "pay_out_net"]}
	);

	// 2. have carol send some money to distrotron
	
	net_payment = BigInt( await distro.pay_out( { 
		args: {
			payees: [users.alice.accountId, users.bob.accountId]
	}, 
		gas: "300000000000000", // attached GAS (optional)
		amount: n2y(10),				// attached near
	}));

	// 3. check that it was distributed to alice and bob
	
	balances.after = {
			"alice": await totalBalance(users.alice),
			"bob": await totalBalance(users.bob),
			"carol": await totalBalance(users.carol),
	};

	console.log("Net payment: " + net_payment + " = " + y2n(net_payment) + " NEAR");
	console.log(balances);
	assert(balances.before.alice + net_payment == balances.after.alice, "alice bad balance");
	assert(balances.before.bob + net_payment == balances.after.bob, "bob bad balance");

	// 4. What did Carol pay for gas?
	console.log("gas cost: " + y2n( balances.before.carol - (balances.after.carol + (BigInt(2) * net_payment)) ) + " NEAR");

}  

async function testPayMinters() {
	let users = await loadTestUsers();

	let balances = {
		before: {
			"alice": await totalBalance(users.alice),
			"bob": await totalBalance(users.bob),
			"carol": await totalBalance(users.carol),
		}
	};

	const distro = new nearAPI.Contract(
		users.bob, // will call it
		fullAccountName(config.contractAccount), // name (string) of acct where contract is deployed
		{changeMethods: ["pay_minters"]}
	);

	const stub = new nearAPI.Contract(
		users.stub, // will call it
		fullAccountName(config.stubAccount), // name (string) of acct where contract is deployed
		{changeMethods: ["mock_minters"]}
	);

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
		amount: n2y(10),				// attached near
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

	// 4. What did Bob pay for gas?
	console.log("gas cost: " + y2n( balances.before.bob - (balances.after.bob + (BigInt(2) * net_payment)) ) + " NEAR");
}  


async function test_stub(){
	let users = await loadTestUsers();
	const stub = new nearAPI.Contract(
		users.carol, // will call it
		fullAccountName(config.stubAccount), // name (string) of acct where contract is deployed
		{changeMethods: ["init","mock_minters"], 
			viewMethods: ["list_minters","be_good"]}
	);

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
}



async function main(){

	const started = new Date();
	const myArgs = process.argv.slice(2);

  await connectToSandbox();

	switch (myArgs[0]) {
			// setup targets:
		case 'deploy_stub':
			await deployStub();
			break;

		case 'deploy_main':
			await deployMain();
			break;

		case 'make_test_users':
			await makeTestUsers();
			break;

			// test targets:
		case 'pay_out':
		case 'test_pay_out':
			await testPayOut();
			break;

		case 'pay_minters':
		case 'test_pay_minters':
			await testPayMinters();
			break;

		case 'stub':
		case 'teststub':
			await test_stub();
			break;


		default:
			await testPayOut();
	}

	const finished = new Date();
	console.log(`execution time: ${(finished - started)/1000} seconds`);
}

main();

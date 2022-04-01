const nearAPI = require("near-api-js");
const BN = require("bn.js");
const fs = require("fs").promises;
const assert = require("assert").strict;
const path = require("path");
const { utils } = nearAPI;

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
        nodeUrl: "http://23.23.23.101:3030",
        masterAccount: "mykletest.testnet",
        contractAccount: "distro_test",
				stubAccount: "stub",
				keyPath: "/Volumes/External/mykle/.near-credentials/testnet/mykletest.testnet.json",
      };
    case "sandbox":
      return {
        networkId: "sandbox",
        nodeUrl: "http://23.23.23.101:3030",
        masterAccount: "test.near",
        contractAccount: "distro",
				stubAccount: "stub",
				keyPath: "/Volumes/External/mykle/tmp/near-sandbox/validator_key.json",
      };
    case "local":
      return {
        networkId: "sandbox",
        nodeUrl: "http://localhost:3030",
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

// const contractMethods = {
//   changeMethods: ["pay_minters", "pay_out"],
// };

let config;
let masterAccount;
let masterKey;
let pubKey;
let keyStore;
let near;

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
    nodeUrl: config.nodeUrl,
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

async function createTestUsers(){
	console.log(Object.keys(testUsers));
	Object.keys(testUsers).forEach(async function(u){ 
		testUsers[u] = await createTestUser(u, 1000);
	});
}

async function loadTestUsers(){
	Object.keys(testUsers).forEach(async function(u){ 
		let accountId = fullAccountName(u);
		keyStore.setKey(config.networkId, accountId, masterKey);
		testUsers[u] = new nearAPI.Account(near.connection, accountId);
	});

	return testUsers;
}

async function initStub() {
	const stubwasm = await fs.readFile(path.resolve(__dirname, "../../target/wasm32-unknown-unknown/release/stub.wasm"));
	const _stubAccount = await createTestUser(config.stubAccount);
	await _stubAccount.deployContract(stubwasm);

  console.log("stub deployed");
	return _stubAccount;
}

async function initContract() {
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

async function test_pay_out() {
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
		{changeMethods: ["pay_out"]}
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


async function main(){

	const started = new Date();
	const myArgs = process.argv.slice(2);

  await connectToSandbox();

	switch (myArgs[0]) {
		case 'deploy_stub':
			await initStub();
			break;
		case 'deploy_main':
			await initContract();
			break;
		case 'make_test_users':
			await createTestUsers();
			break;
		case 'pay_out':
			await test_pay_out();
			break;
		case 'compliment':
			console.log(myArgs[1], 'is really cool.');
			break;
		default:
			await test_pay_out();
	}

	const finished = new Date();
	console.log(`execution time: ${(finished - started)/1000} seconds`);
}

main();

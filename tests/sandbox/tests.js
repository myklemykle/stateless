const nearAPI = require("near-api-js");
const BN = require("bn.js");
const fs = require("fs").promises;
const assert = require("assert").strict;
const path = require("path");

function getConfig(env) {
  switch (env) {
    case "sandbox":
    case "local":
      return {
        networkId: "sandbox",
        nodeUrl: "http://localhost:3030",
        masterAccount: "test.near",
        contractAccount: "distro.test.near",
        keyPath: "/tmp/near-sandbox/validator_key.json",
      };
  }
}

const contractMethods = {
  // viewMethods: ["get_status"],
  changeMethods: ["pay_minters", "pay_out"],
};
let config;
let masterAccount;
let masterKey;
let pubKey;
let keyStore;
let near;

async function initNear() {
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
  console.log("Finish init NEAR");
}

async function createUser(
  accountPrefix,
  contractAccountId,
  contractMethods
) {
  let accountId = accountPrefix + "." + config.masterAccount;
  await masterAccount.createAccount(
    accountId,
    pubKey,
    new BN(10).pow(new BN(25))
  );
  keyStore.setKey(config.networkId, accountId, masterKey);
  const account = new nearAPI.Account(near.connection, accountId);
  // const accountUseContract = new nearAPI.Contract(
  //   account,
  //   contractAccountId,
  //   contractMethods
  // );
  // return accountUseContract;
	return account;
}

async function initTest() {
  const contract = await fs.readFile(path.resolve(__dirname, "../../target/wasm32-unknown-unknown/release/distrotron.wasm"));
  const _contractAccount = await masterAccount.createAndDeployContract(
    config.contractAccount,
    pubKey,
    contract,
    new BN(10).pow(new BN(25))
  );

  const alice = await createUser(
    "alice",
    config.contractAccount,
    contractMethods
  );

  const bob = await createUser(
    "bob",
    config.contractAccount,
    contractMethods
  );

	//console.log("Finish deploy contracts and create test accounts");
  console.log("contract deployed, test accounts created");
  return { alice, bob };
}

async function test() {
  // 1. Creates testing accounts and deploys a contract
  await initNear();
  const { alice, bob } = await initTest();

  // // 2. Performs a `set_status` transaction signed by Alice and then calls `get_status` to confirm `set_status` worked
  // await alice.set_status({ args: { message: "hello" } });
  // let alice_message = await alice.get_status({
  //   account_id: "alice.test.near",
  // });
  // assert.equal(alice_message, "hello");
  //
  // // 3. Gets Bob's status and which should be `null` as Bob has not yet set status
  // let bob_message = await bob.get_status({
  //   account_id: "bob.test.near",
  // });
  // assert.equal(bob_message, null);
  //
  // // 4. Performs a `set_status` transaction signed by Bob and then calls `get_status` to show Bob's changed status and should not affect Alice's status
  // await bob.set_status({ args: { message: "world" } });
  // bob_message = await bob.get_status({
  //   account_id: "bob.test.near",
  // });
  // assert.equal(bob_message, "world");
  // alice_message = await alice.get_status({
  //   account_id: "alice.test.near",
  // });
  // assert.equal(alice_message, "hello"); 
	assert.equal(1,2); // fail!
}  

test();

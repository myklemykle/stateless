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

const nearAPI = require('near-api-js')
const BN = require('bn.js')
const fs = require('fs').promises
const assert = require('assert').strict
const path = require('path')
const { utils } = nearAPI
const homedir = require('os').homedir()

let config
let masterAccount
let masterKey
let pubKey
let keyStore
let near

const testUsers = {
  alice: '',
  bob: '',
  carol: '',
  // doug: '',
  // emily: ''
}

// this works with node v16:
async function fileExists (path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

const LOTSAGAS = '300000000000000' // ATM this is the max gas that can be attached to a transaction

async function getConfig (env = process.env.NEAR_ENV || 'sandbox') {
  // To test on testnet, we need the name of a testnet account.
  const testnet_master = process.env.NEAR_TESTNET_ACCOUNT
  let config = {}
  let keyPath = ''

  switch (env) {
    case 'testnet': // the live NEAR testnet

      if (!testnet_master) {
        console.error('please set NEAR_TESTNET_ACCOUNT to run tests on testnet')
        process.exit(1)
      }

      keyPath = homedir + '/.near-credentials/testnet/' + testnet_master + '.json'
      if (!await fileExists(keyPath)) {
        console.error("can't find near credentials at '" + keyPath + "'")
        console.error('(try logging in with near-cli)')
        process.exit(2)
      }

      config = {
        networkId: 'testnet',
        nearnodeUrl: 'http://rpc.testnet.near.org',
        masterAccount: testnet_master,
        contractAccount: 'distro_test',
        minterContract: process.env.NEAR_TESTNET_MINTER_ACCOUNT || 'stub',
        keyPath
      }
      break

    case 'sandbox': // local or remote standalone NEAR daemon
    case 'localnet':
      neard_home = process.env.NEARD_HOME || homedir + '/.near'
      keyPath = process.env.NEARD_KEY || neard_home + '/validator_key.json'
      if (!await fileExists(keyPath)) {
        console.error("can't find NEAR credentials at '" + keyPath + "'")
        process.exit(3)
      }

      config = {
        networkId: 'localnet',
        nearnodeUrl: 'http://' + (process.env.NEAR_SANDBOX_NODE || 'localhost') + ':' + (process.env.NEAR_SANDBOX_PORT || '3030'),
        masterAccount: 'test.near',
        contractAccount: 'distro',
        minterContract: 'stub',
        keyPath
      }
			// console.log('keypath = ' + config.keyPath)
      break

    default:
      console.error("please set the NEAR_ENV environment variable to 'localnet' or 'testnet'")
      process.exit(4)
  }

	// console.debug(config)
  return config
}

function n2y (near) { return utils.format.parseNearAmount(near.toString()) }
function y2n (yocto) { return utils.format.formatNearAmount(yocto) }

function fullAccountName (prefix) {
  // if prefix already has dots in it,
  // assume it's fully-qualified already and return it unchanged
  if (prefix.match(/\./)) { return prefix }

  return prefix + '.' + config.masterAccount
}

async function connectToNear () {
  config = await getConfig()
	// console.log('connecting to ' + config.networkId)  //DEBUG

  const keyFile = require(config.keyPath)
  masterKey = nearAPI.KeyPair.fromString(
    keyFile.secret_key || keyFile.private_key
  )
  pubKey = masterKey.getPublicKey()
  keyStore = new nearAPI.keyStores.InMemoryKeyStore()
  keyStore.setKey(config.networkId, config.masterAccount, masterKey)
  near = await nearAPI.connect({
    // deps: {   /// used to work, deprecated pattern i guess...
    //   keyStore,
    // },
    keyStore,
    networkId: config.networkId,
    nodeUrl: config.nearnodeUrl
  })
  masterAccount = new nearAPI.Account(near.connection, config.masterAccount)
	// console.log('connected')  //DEBUG
}

async function createTestUser (
  accountPrefix, initBalance = 10
) {
  const accountId = fullAccountName(accountPrefix)
  keyStore.setKey(config.networkId, accountId, masterKey)
  const account = new nearAPI.Account(near.connection, accountId)

  // delete it first,
  try {
    await account.deleteAccount(config.masterAccount)
		// console.log('deleted ' + accountPrefix)  // DEBUG
  } catch {
    // fails if it didn't exist
  }

  // then recreate it.
  await masterAccount.createAccount(
    accountId,
    pubKey,
    n2y(initBalance)
  )
	console.log('recreated ' + accountId)  // DEBUG
  return account
}

async function makeTestUsers () {
	// console.log(Object.keys(testUsers)) //DEBUG
  for (u of Object.keys(testUsers)) {
    testUsers[u] = await createTestUser(u, 10)
  };
}

async function makeNUsers (count) {
  for (let n = 0; n < count; n++) {
    u = 'user' + n
    testUsers[u] = await createTestUser(u, 10)
  };
  console.log('loaded ' + count + ' test users')

  testUsers[config.minterContract] = loadTestUser(config.minterContract)
  return testUsers
}

function loadTestUsers () { // also loads the stub account
  userList = Object.keys(testUsers)
  userList.push(config.minterContract)

  userList.forEach(function (u) {
    // let accountId = fullAccountName(u);
    // keyStore.setKey(config.networkId, accountId, masterKey);
    // testUsers[u] = new nearAPI.Account(near.connection, accountId);
    testUsers[u] = loadTestUser(u)
  })

  return testUsers
}

function loadTestUser (u) {
  const accountId = fullAccountName(u)
  keyStore.setKey(config.networkId, accountId, masterKey)
  return new nearAPI.Account(near.connection, accountId)
}

async function loadNUsers (count) { // also loads the stub account
  const userList = []
  for (let n = 0; n < count; n++) {
    userList.push('user' + n)
  }
  userList.push(config.minterContract)

  userList.forEach(async function (u) {
    const accountId = fullAccountName(u)
    keyStore.setKey(config.networkId, accountId, masterKey)
    testUsers[u] = new nearAPI.Account(near.connection, accountId)
  })

  console.log('loaded ' + count + ' test users')
  return testUsers
}

async function deployStub () {
  const stubwasm = await fs.readFile(path.resolve(__dirname, '../../target/wasm32-unknown-unknown/release/stub.wasm'))
  const minterContractAccount = await createTestUser(config.minterContract, 100)
  await minterContractAccount.deployContract(stubwasm)

  console.log('stub deployed')

  const stubContract = getNewMinterContract(minterContractAccount)
  await stubContract.init({ args: {} })

  console.log('stub initialized')

  return minterContractAccount
}

function getNewMinterContract (acct) {
  return new nearAPI.Contract(
    acct, // will call it
    fullAccountName(config.minterContract), // name (string) of acct where contract is deployed
    {
      changeMethods: ['init', 'mock_minters'],
      viewMethods: ['list_minters']
    }
  )
}

async function deployDistro () {
  const contractwasm = await fs.readFile(path.resolve(__dirname, '../../target/wasm32-unknown-unknown/release/distrotron.wasm'))
  const _contractAccount = await createTestUser(config.contractAccount, 100)
  await _contractAccount.deployContract(contractwasm)

  console.log('main contract deployed')
  return _contractAccount
}

function loadDistro (acct) {
  return new nearAPI.Contract(
    acct, // will call it
    fullAccountName(config.contractAccount), // name (string) of acct where contract is deployed
    { changeMethods: ['pay_minters', 'split_payment'] }
  )
}

async function totalBalance (acct) {
  b = await acct.getAccountBalance()
  return BigInt(b.total)
}

// i'm seeing some super-annoying intermittent failures, only in local sandbox,
// only when running the payment-refund test in conjunction with another
// payment test.  It appears to be a matter of the transaction not
// getting finalized before the next balance inquiry.  So I've added some delays ...
// sadly, it seems to work.  But I'd like to find a proper solution.
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

jest.setTimeout(600000)
describe('blockchain state setup (slow!)', () => {
  beforeAll(async () => {
    await connectToNear()
  })

  test('deploy distro contract', async () => {
    await deployDistro()
  })

  test('make test users', async () => {
    await makeTestUsers()
  })

  test('deploy stub contract', async () => {
    const users = loadTestUsers()
    if (config.minterContract == 'stub') {
      await deployStub()
      // mock up a minters list
      const mc = getNewMinterContract(users.stub)
      await mc.mock_minters({
        args: { minters: [users.alice.accountId, users.carol.accountId] }
      })
    } else {
      console.log('not using stub')
    }
  })
})

/// ///////
// the tests:
/// ////////

describe('payment tests', () => {
  beforeAll(async () => {
    await connectToNear()
  })

  test('stub contract works', async () => {
    if (config.minterContract != 'stub') {
      console.log('not using stub')
      return
    }

    const users = loadTestUsers()
    const stub = getNewMinterContract(users.stub)

    // call the list_minters method on the stub contract,
    // which could be any old leftover from some other test ...
    minters = await stub.list_minters()
    // mock up a minters list:

    await stub.mock_minters({
      args: {
        minters: ['alice.boop', 'bruce.beep']
      },
      gas: LOTSAGAS // attached GAS (optional)
    })

    // confirm it worked:
    minters = await stub.list_minters()
    console.log(minters)
    assert(minters[0] === 'alice.boop')
    assert(minters[1] === 'bruce.beep')
  })

  test('BOOP can pay out funds to a list of users', async () => {
    const users = loadTestUsers()

    const balances = {
      before: {
        alice: await totalBalance(users.alice),
        bob: await totalBalance(users.bob),
        carol: await totalBalance(users.carol)
      }
    }

    const distro = loadDistro(users.carol)

    // have carol send some money to distrotron

    net_payment = BigInt(await distro.split_payment({
      args: {
        payees: [users.alice.accountId, users.bob.accountId]
      },
      gas: LOTSAGAS, // attached GAS (optional)
      amount: n2y(1)				// attached near
    }))

		await delay(1000)

    // check that it was distributed to alice and bob

    balances.after = {
      alice: await totalBalance(users.alice),
      bob: await totalBalance(users.bob),
      carol: await totalBalance(users.carol)
    }

		// console.log('Net payment: ' + net_payment + ' = ' + y2n(net_payment) + ' NEAR')
		// console.log(balances)
    assert(balances.before.alice + net_payment == balances.after.alice, 'alice bad balance')
    assert(balances.before.bob + net_payment == balances.after.bob, 'bob bad balance')

    // What did Carol pay for gas?
    const gascost = balances.before.carol - (balances.after.carol + (BigInt(2) * net_payment))
		// console.log('gas cost: ' + gascost + ' yocto = ' + y2n(gascost) + ' NEAR') 
  })

  test('duplicates are removed from user list', async () => {
    const users = loadTestUsers()

    const balances = {
      before: {
        alice: await totalBalance(users.alice),
        bob: await totalBalance(users.bob),
        carol: await totalBalance(users.carol)
      }
    }

    const distro = loadDistro(users.carol)

    // have carol send some money to distrotron

    net_payment = BigInt(await distro.split_payment({
      args: {
        payees: [users.alice.accountId, users.bob.accountId, users.alice.accountId]
      },
      gas: LOTSAGAS, // attached GAS (optional)
      amount: n2y(1)				// attached near
    }))

    // check that it was distributed to alice and bob,
    // in equal amounts, because alice was only paid once.

    balances.after = {
      alice: await totalBalance(users.alice),
      bob: await totalBalance(users.bob),
      carol: await totalBalance(users.carol)
    }

    console.log('Net payment: ' + net_payment + ' = ' + y2n(net_payment) + ' NEAR')
    console.log(balances)
    assert(balances.before.alice + net_payment == balances.after.alice, 'alice bad balance')
    assert(balances.before.bob + net_payment == balances.after.bob, 'bob bad balance')

    // What did Carol pay for gas?
    const gascost = balances.before.carol - (balances.after.carol + (BigInt(2) * net_payment))
    console.log('gas cost: ' + gascost + ' yocto = ' + y2n(gascost) + ' NEAR')
  })

  test('can pay the list of minters from a contract', async () => {
    const users = loadTestUsers()

    const balances = {
      before: {
        alice: await totalBalance(users.alice),
        bob: await totalBalance(users.bob),
        carol: await totalBalance(users.carol)
      }
    }

    const distro = loadDistro(users.bob)
    const mc = getNewMinterContract(users.stub)

    // 1. mock up a minters list
    await mc.mock_minters({
      args: { minters: [users.alice.accountId, users.carol.accountId] }
    })

    // 2. have bob send some money to distrotron

    net_payment = BigInt(await distro.pay_minters({
      args: {
        minter_contract: fullAccountName(config.minterContract)
      },
      gas: LOTSAGAS, // attached GAS (optional)
      amount: n2y(1)				// attached near
    }))

		await delay(1000)

    // 3. check that it was distributed to alice and carol

    balances.after = {
      alice: await totalBalance(users.alice),
      bob: await totalBalance(users.bob),
      carol: await totalBalance(users.carol)
    }

    console.log('Net payment: ' + net_payment + ' = ' + y2n(net_payment) + ' NEAR')
    console.log(balances)
    assert(balances.before.alice + net_payment == balances.after.alice, 'alice bad balance')
    assert(balances.before.carol + net_payment == balances.after.carol, 'carol bad balance')

    // 4. what did bob pay for gas?
    const gascost = balances.before.bob - (balances.after.bob + (BigInt(2) * net_payment))
    console.log('gas cost: ' + gascost + ' yocto = ' + y2n(gascost) + ' NEAR')
  })

  test('BOOP payment to nonexistent user wont go through', async () => {
    const users = loadTestUsers()
    users.distro = loadTestUser(config.contractAccount)

    const balances = {
      before: {
        alice: await totalBalance(users.alice),
        bob: await totalBalance(users.bob),
				carol: await totalBalance(users.carol), 
				distro: await totalBalance(users.distro)
			},
			after: {},
			delta: {}
    }

    const distro = loadDistro(users.carol)

    // have carol send 3 NEAR to distrotron

		net_payment = BigInt(await distro.split_payment({
			args: {
				// two valid accounts, one bogus one.
				payees: [users.alice.accountId, 'your_mom', users.bob.accountId]
			},
			gas: LOTSAGAS, // attached GAS (optional)
			amount: n2y(0.3)				// attached near
		}))

		// But the transactions are not atomic, so the payments will go through for all good users ...

		for (u of Object.keys(balances.before)) {
			balances.after[u] = await totalBalance(users[u])
			balances.delta[u] = BigInt(balances.after[u]) - BigInt(balances.before[u])
			console.log("user " + u + " balance delta:" + y2n( BigInt(balances.delta[u])))
		};

		// check that alice and bob got paid 1 NEAR each:
		assert(balances.delta.alice == n2y(0.1), "alice was not paid");
		assert(balances.delta.bob == n2y(0.1), "bob was not paid");

		// check that Carol was only charged 2 NEAR (+ gas), because the third account was bogus
		assert(
			balances.delta.carol < n2y(-0.2) && balances.delta.carol > n2y(-0.3) 
			, "carol overpaid");

		// check that no money ended up in the distro contract
		// (except for the "NEAR tip")
		assert(balances.delta.distro < n2y(0.001), "contract was over-tipped");


  })
})

// Test against the list_minters() function of a live mintbase contract, instead of using our stub .
describe('mintbase tests', () => {
  beforeAll(async () => {
    await connectToNear()
  })

  test('can get payees from mintbase contract', async () => {
    const users = loadTestUsers()
    const balances = {
      before: {},
      after: {}
    }

    // let carol call it, since she's buying ...
    const mc = getNewMinterContract(users.carol)

    // 1) get the minters list and the balances before:
    const minters = await mc.list_minters()
    console.log("contract '" + mc.contractId + "' minters: " + minters)

    for (let i = 0; i < minters.length; i++) {
      const m = minters[i]
      users[m] = loadTestUser(m)
      balances.before[m] = await totalBalance(users[m])
    };
    balances.before.carol = await totalBalance(users.carol)

    // 2) have carol send some money to the minters:

    const distro = loadDistro(users.carol)
    net_payment = BigInt(await distro.pay_minters({
      args: {
        minter_contract: mc.contractId
      },
      gas: LOTSAGAS, // attached GAS (optional)
      amount: n2y(1)				// attached near
    }))

    // 3) get balances after.
    for (let i = 0; i < minters.length; i++) {
      const m = minters[i]
      balances.after[m] = await totalBalance(users[m])
    };
    balances.after.carol = await totalBalance(users.carol)
    console.log(balances)

    // 4) all kosher?
    for (let i = 0; i < minters.length; i++) {
      const m = minters[i]
      assert(balances.before[m] + net_payment == balances.after[m], m + ' bad balance')
    };
    assert(balances.before.carol - (BigInt(minters.length) * net_payment) > balances.after.carol, 'carol bad balance')

    // 5. what did carol pay for gas?
    const gascost = balances.before.carol - (balances.after.carol + (BigInt(minters.length) * net_payment))
    console.log('gas cost: ' + gascost + ' yocto = ' + y2n(gascost) + ' NEAR')
  })
})

// This one takes a while ...

describe('stress tests', () => {
  beforeAll(async () => {
    await connectToNear()
    jest.setTimeout(600000)
  })

  test('can pay 87 minters', async () => {
    // the real mintbase contracts don't support mock_minters() (obviously)
    // so this test will fail there.

    const n = 87
    const users = await makeNUsers(n)
    const balances = { before: {}, after: {} }

    console.log('balances before:')
    for (let count = 0; count < n; count++) {
      const u = 'user' + count
      balances.before[u] = await totalBalance(users[u])
      console.log(u + ': ' + y2n(balances.before[u]))
    }

    // user0 is the payer
    const distro = loadDistro(users.user0)
    const mc = getNewMinterContract(users.stub)

    // users 1-(n-1) are the payees
    const minters = []
    for (let count = 1; count < n; count++) {
      minters.push(fullAccountName('user' + count))
    }

    await mc.mock_minters({
      args: { minters }
    })

    // have user0 send some money to distrotron

    net_payment = BigInt(await distro.pay_minters({
      args: {
        minter_contract: fullAccountName(config.minterContract)
      },
      gas: LOTSAGAS, // attached GAS (optional)
      amount: n2y(1)				// attached near
    }))

    console.log('balances after:')
    for (let count = 0; count < n; count++) {
      const u = 'user' + count
      balances.after[u] = await totalBalance(users[u])
      console.log(u + ': ' + y2n(balances.after[u]))
    }

    console.log('Net payment: ' + net_payment + ' = ' + y2n(net_payment) + ' NEAR')

    // assert it all worked out:
    for (let count = 1; count < n; count++) {
      const u = 'user' + count
      assert(balances.before[u] + net_payment == balances.after[u], u + 'bad balance')
    }

    // what did user0 pay for gas?
    const gascost = balances.before.user0 - (balances.after.user0 + (BigInt(n - 1) * net_payment))
    console.log('gas cost: ' + gascost + ' yocto = ' + y2n(gascost) + ' NEAR')
  })
})

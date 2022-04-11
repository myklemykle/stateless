//! This contract is a test stub for the distro contract's cross-contract call;
//! it stubs the list_minters() method that we expect to see on Mintbase contracts.
//!
//! Methods: 
//!  list_minters
//!

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, ext_contract, near_bindgen, AccountId, Balance, Promise, PromiseResult};
use near_sdk::collections::Vector;
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;

near_sdk::setup_alloc!();

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Stub {
    minters: Vector<AccountId>
}

impl Default for Stub {
    fn default() -> Self {
        let mut minters = Vector::new(b"asdf".to_vec());
        minters.push(&"alice.foo".to_string());
        minters.push(&"bob.foo".to_string());
        Self {
            minters: minters
        }
    }
}

// our contract:
#[near_bindgen]
impl Stub {

    // Right after this contract is deployed, we need to initialize storage 
    // by calling either self.mock_minters() or this no-op init() method,
    // which triggers a call to self.default().
    // Otherwise, any view method call will trigger that default() method,
    // leading to an "illegal storage_write() in view method" failure.
    pub fn init (&mut self) -> bool {
        true
    }

    pub fn mock_minters(&mut self, minters: Vec<AccountId>) {
        self.minters.clear();
        self.minters.extend(minters);
    }

    pub fn list_minters(&self) -> Vec<AccountId> {
        self.minters.to_vec()
    }

    pub fn be_good(&self) -> bool {
        true
    }
    
}


// use the attribute below for unit tests
#[cfg(test)]
mod stub_tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, VMContext};

    // part of writing unit tests is setting up a mock context
    // in this example, this is only needed for env::log in the contract
    // this is also a useful list to peek at when wondering what's available in env::*
    fn get_context(input: Vec<u8>, is_view: bool) -> VMContext {
        VMContext {
            current_account_id: "alice.testnet".to_string(),
            signer_account_id: "robert.testnet".to_string(),
            signer_account_pk: vec![0, 1, 2],
            predecessor_account_id: "jane.testnet".to_string(),
            input,
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            storage_usage: 0,
            attached_deposit: 0,
            prepaid_gas: 10u64.pow(18),
            random_seed: vec![0, 1, 2],
            is_view,
            output_data_receivers: vec![],
            epoch_height: 19,
        }
    }

    fn to_ynear(near: Balance) -> Balance {
        near * 10u128.pow(24)
    }

    // fn bob() -> AccountId {
    //     "bob.testnet".to_string()
    // }
    //
    // fn carol() -> AccountId {
    //     "carol.testnet".to_string()
    // }
    //
    // fn dick() -> AccountId {
    //     "dick.testnet".to_string()
    // }
    //
    // fn eve() -> AccountId {
    //     "eve.testnet".to_string()
    // }
    //
    // fn frank() -> AccountId {
    //     "frank.testnet".to_string()
    // }
    //
    // fn grace() -> AccountId {
    //     "grace.testnet".to_string()
    // }


    #[test]
    fn list_minters_1() { 
        let mut c = get_context(vec![], false);
        c.attached_deposit = to_ynear(10);
        testing_env!(c);
        let mut contract = Stub::default();

        contract.init();
        let chumps = contract.list_minters();
        assert_eq!(chumps[0], "alice.foo");
        assert_eq!(chumps[1], "bob.foo");
    }


    #[test]
    fn mock_minters_1() {
        let mut c = get_context(vec![], false);
        c.attached_deposit = to_ynear(10);
        testing_env!(c);
        let mut contract = Stub::default();

        contract.mock_minters(["mario.testnet".to_string(), "luigi.testnet".to_string()].to_vec());

        let chumps = contract.list_minters();
        assert_eq!(chumps[0], "mario.testnet");
        assert_eq!(chumps[1], "luigi.testnet");
    }

}

//! This contract is a test stub for the distro contract's cross-contract call;
//! it stubs the list_minters() method that we expect to see on Mintbase contracts.
//!
//! Methods: 
//!  list_minters
//!

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, ext_contract, near_bindgen, AccountId, Balance, Promise, PromiseResult};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;

near_sdk::setup_alloc!();

#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct Stub {
    // TODO: array of account ids, or blank?
}
//
// // money in yocto:
// pub type AmtYocto = u128; 
// pub type AmtYoctoU128 = U128; 
//
// const LOTSAGAS: u64 = 5_000_000_000_000;
//
// // the list_minter API on a Mintbase contract:
// #[ext_contract(ext_mc)]
// trait MinterContract {
//     fn list_minters(&self) -> Vec<AccountId>;
// }
//
// #[ext_contract(ext_self)]
// trait MyContract {
//     fn list_minters_cb(&self) -> Promise;
//     fn pay_out(&self, payees: Vec<AccountId>) -> Promise;
// }


// our contract:
#[near_bindgen]
impl Stub {
    pub fn list_minters(&mut self) -> Vec<AccountId> {
        // return vector of account ids
        vec!["alice.testnet".to_string(), "bob.testnet".to_string()]
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
        let mut contract = Stub {};

        let chumps = contract.list_minters();
        assert_eq!(chumps[0], "alice.testnet");
        assert_eq!(chumps[1], "bob.testnet");
    }



}

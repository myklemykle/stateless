//! This contract is a test stub for the Distrotron contract's one cross-contract call;
//! it stubs the list_minters() method that we expect to see on Mintbase contracts.

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
//use near_sdk::{env, ext_contract, near_bindgen, AccountId, Balance, Promise, PromiseResult};
use near_sdk::collections::Vector;
use near_sdk::{near_bindgen, AccountId};

near_sdk::setup_alloc!();

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Stub {
    minters: Vector<AccountId>,
}

impl Default for Stub {
    fn default() -> Self {
        let mut minters = Vector::new(b"asdf".to_vec());
        minters.push(&"alice.foo".to_string());
        minters.push(&"bob.foo".to_string());
        Self { minters: minters }
    }
}

#[near_bindgen]
impl Stub {
    /// Stub contract initiaization.
    /// Right after this contract is deployed, we must initialize storage
    /// by calling either self.mock_minters() or this no-op init() method,
    /// which calls self.default().
    /// Otherwise, the first call to list_minters() will trigger the default() method,
    /// leading to an "illegal storage_write() in view method" failure.
    pub fn init(&mut self) -> bool {
        true
    }

    /// Mock the list of minters that our mock list_minters() method will return.
    /// Takes a list of NEAR account IDs.
    /// No return value; it just succeeds or throws an error.
    pub fn mock_minters(&mut self, minters: Vec<AccountId>) {
        self.minters.clear();
        self.minters.extend(minters);
    }

    /// Simulation of the list_minters() method from the Mintbase standard contract.
    /// Returns a list of NEAR Account IDs.
    pub fn list_minters(&self) -> Vec<AccountId> {
        self.minters.to_vec()
    }
}

#[cfg(test)]
mod stub_tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, Balance, VMContext};

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

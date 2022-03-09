//! This contract distributes incoming payments of NEAR tokens to a list of recipient accounts.
//!
//! Methods: 
//!  Main money distro: pay_out
//!  Distro list management: set_recipients, get_receipients, add_recipient, remove_recipient
//!

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, AccountId, Balance};
use near_sdk::json_types::U128;

near_sdk::setup_alloc!();

// add the following attributes to prepare your code for serialization and invocation on the blockchain
// More built-in Rust attributes here: https://doc.rust-lang.org/reference/attributes.html#built-in-attributes-index
#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct DistroList {
    // TODO: array of account ids, or blank?
}

// money in yocto:
pub type AmtYocto = u128; 
pub type AmtYoctoU128 = U128; 
pub type AccountIdSet = Vec<AccountId>;

#[near_bindgen]
impl DistroList {
    /// Returns the amount of NEAR that was paid to each recipient, in Yocto
    /// This should generate some kind of log ... although really the NEAR transaction
    /// record will hopefully be enough there, if it's legible in the Explorer.
    ///
    #[payable]
    pub fn pay_out(&mut self, payees: Vec<AccountId> ) -> AmtYoctoU128 {

        // count the recipients.  
        // u32 only goes to 4 billion, and there are 8+ billion people in the world ...
        let count: u64 = payees.len().try_into().unwrap(); 
                
        // Fail if none.
        assert!(count > 0, "Empty recipient list");

        // count the money:
        let payment: AmtYocto = env::attached_deposit();
        // Fail if none.
        assert!(payment > 0, "No payment attached");

        // parse the recipients & make sure they're not garbled?


        // estimate the gas costs:
        // 1 Tgas = 10^12 gas, docs suggest it costs .45 Tgas to send funds, so we can
        //   calculate that
        let est_gas_per_payee:u128 = 45000000000; // 0.45 Tgas (4.5^11)
        
        //   We can also do testing to get a pretty good idea of the gas cost of pay_out,
        //   and see how it expands / contracts with the distro list.
        //   Then when running I think we can maybe get some idea of the current gas cost,
        //   and estimate something that way.
        let est_gas_other:u128 = 100000000000; // 0.1 Tgas, for now.
        //   Question is, can that gas cost change during the running of this method?  I think not
        //   if it's not a cross-contract call.  I think it's all in the current block at the
        //   current price ... we'll see.
        
        // divide the yocto by the number to get the individual payouts,
        // pay each of the recipients in a loop.
        // -- we might find out a recipient does not exist!  even if they existed once before,
        // accounts can be deleted.  If that happens, we should abort with an explanation,
        // and make the stateless gods fix things.
        // Return the payout amount.
        // (The balance should be refunded automatically.)
        0.into()
    }


    // /// Return the recipient list 
    // /// (with paging option?)
    // pub fn get_recipients() -> accountIds[] {
    //     // TODO
    // }
    // /// Sets the recipient list to a list of near accounts.
    // /// Can only be called by admins!
    // /// Takes an array/list of accountIDs
    // /// Returns the list, if all went well.
    // pub fn set_recipients(accountIds recipients[] ) -> accountIds[] {
    //     // TODO
    // }
    // /// Adds a recipient to the current list.
    // /// Can only be called by admins!
    // /// If account was already on the list, no-op.
    // /// Returns the current list if all went well.
    // pub fn add_recipient(accountId recipient) -> accountIds[] {
    //     // TODO
    // }
    // /// Remove a recipient from the current list.
    // /// Can only be called by admins!
    // /// If account was not on the list, throw an error?  or no-op?
    // /// Returns the current list if all went well.
    // pub fn remove_recipient(accountId recipient) -> accountIds[] {
    //     // TODO
    // }
    
}
/*
 * the rest of this file sets up unit tests
 * to run these, the command will be:
 * cargo test --package rust-counter-tutorial -- --nocapture
 * Note: 'rust-counter-tutorial' comes from cargo.toml's 'name' key
 */

// use the attribute below for unit tests
#[cfg(test)]
mod tests {
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

    fn bob() -> AccountId {
        "bob.testnet".to_string()
    }

    fn carol() -> AccountId {
        "carol.testnet".to_string()
    }

    fn dick() -> AccountId {
        "dick.testnet".to_string()
    }

    fn eve() -> AccountId {
        "eve.testnet".to_string()
    }

    fn frank() -> AccountId {
        "frank.testnet".to_string()
    }

    fn grace() -> AccountId {
        "grace.testnet".to_string()
    }


    #[test]
    // pay_out should fail with no list of recipients:
    #[should_panic(
        expected = r#"Empty recipient list"#
    )]
    fn pay_out_1() { 
        let c = get_context(vec![], false);
        c.attached_deposit = to_ynear(10);
        testing_env!(c);
        let mut contract = DistroList {};

        let chumps = vec![];
        let cut = contract.pay_out(chumps);
    }


    #[test]
    // pay_out should fail if no payment attached
    #[should_panic(
        expected = r#"No payment attached"#
    )]
    fn pay_out_2() { 
        let c = get_context(vec![], false);
        testing_env!(c);
        let mut contract = DistroList {};

    }

    // #[test]
    // // pay_out should fail if a recipient does not exist
    // #[should_panic(
    //     expected = r#"No such account"# // or something?
    // )]
    // fn pay_out_3() { 
    //     let c = get_context(vec![], false);
    //     testing_env!(c);
        //let mut contract = DistroList {};
    //
    // }

    #[test]
    // pay_out should succeed with multiple recipients
    fn pay_out_4() { 
        let c = get_context(vec![], false);
        c.attached_deposit = to_ynear(10);
        testing_env!(c);
        let mut contract = DistroList {};

        let chumps = vec![bob(), carol(), dick(), eve()];

        // how much money does bob have before the call?  probably not much?
        let before = bob.account().unwrap().amount;
        let cut = contract.pay_out(chumps);
        let after = bob.account().unwrap().amount;
        assert_eq!(after - before, cut, "bob was ripped off!");
    }


        // should succeed with one recipient
        // should report how much was paid out to each recipient

        
}

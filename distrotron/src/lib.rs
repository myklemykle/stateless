//! This contract distributes incoming payments of NEAR tokens to a list of recipient accounts.
//!
//! Methods: 
//!  Main money distro: pay_out
//!  Distro list management: set_recipients, get_receipients, add_recipient, remove_recipient
//!

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, AccountId, Balance, Promise};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;

near_sdk::setup_alloc!();

// add the following attributes to prepare your code for serialization and invocation on the blockchain
// More built-in Rust attributes here: https://doc.rust-lang.org/reference/attributes.html#built-in-attributes-index
#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct Distrotron {
    // TODO: array of account ids, or blank?
}

// money in yocto:
pub type AmtYocto = u128; 
pub type AmtYoctoU128 = U128; 
pub type AccountIdSet = Vec<AccountId>;

#[near_bindgen]
impl Distrotron {
    /// Returns the amount of NEAR that was paid to each recipient, in Yocto
    /// This should generate some kind of log ... although really the NEAR transaction
    /// record will hopefully be enough there, if it's legible in the Explorer.
    ///
    #[payable]
    pub fn pay_out(&mut self, payees: Vec<AccountId> ) -> Promise {

        // count the recipients.  
        // u32 only goes to 4 billion, and there are 8+ billion people in the world ...
        //let count: u64 = payees.len().try_into().unwrap(); 
        let count: u128 = payees.len().try_into().unwrap();
                
        // Fail if none.
        assert!(count > 0, "Empty recipient list");

        // count the money:
        let total_payment: AmtYocto = env::attached_deposit();
        // Fail if none.
        assert!(total_payment > 0, "No payment attached");


        // Other tests:
        //
        // we'd like to parse the recipients list & make sure they're not garbled,
        // or else count on the transaction failing if it's not kosher.
        //
        // but apparently we can't test if accounts exist for some NEAR reason:
        // https://stackoverflow.com/questions/70819819/how-can-i-verify-if-a-near-address-is-valid-in-smart-contract/70820257#70820257
        //
        // We could at least check that the IDs are valid:
        // https://docs.rs/near-sdk/latest/near_sdk/env/fn.is_valid_account_id.html

        /*
        for acct_id in payees.clone().into_iter() {
            assert!( env::is_valid_account_id(acct_id.as_bytes()) ) ;
        }
        */

        // but what's the point if it can still fail?



        // estimate the gas costs:
        // 0.0001 near per Tgas seems to be the price lately.
        // that's 0.0001 near per 10^12 gas,
        // which is 0.0001 * 10^24 yoctonear per 10^12 gas,
        // so 0.0001 * 10^12 yocto per gas,
        // which is 1 * 10^9 yocto.
        let ypg = 1000000000;

        // How to truly know the gas price tho?  There's a cross-contract call you can make to see it on some other
        // recent block ...

        // 1 Tgas = 10^12 gas, docs suggest it costs .45 Tgas to send funds, so we can
        //   calculate that
        let est_gas_per_payee:u128 = 45000000000; // 0.45 Tgas (4.5^11)
        // convert to yocto
        let est_fee_per_payee:u128 = est_gas_per_payee * ypg;
        
        //   We can also do testing to get a pretty good idea of the gas cost of pay_out,
        //   and see how it expands / contracts with the distro list.
        //   Then when running I think we can maybe get some idea of the current gas cost,
        //   and estimate something that way.
        let est_gas_other:u128 = 100000000000; // 0.1 Tgas, for now.
        // convert to near
        let est_fee_other:u128 = est_gas_other * ypg;

        // and we also have to account for the final function call:
        //let est_gas_end:u128 = 100000000000; // 0.1 Tgas, for now.
        // Nope, turns out to be more ...
        let est_gas_end:u128 = 1000000000000; // 0.1 Tgas, for now.
        let est_fee_end:u128 = est_gas_end * ypg;

        //   Question is, can that gas cost change during the running of this method?  I think not
        //   if it's not a cross-contract call.  I think it's all in the current block at the
        //   current price ... we'll see.
        
        // subtract the gas costs from the yocto:
        let net_payment = ( (total_payment - est_fee_other) - (count * est_fee_per_payee) ) - est_fee_end ;
        
        // divide the remaining yocto by the number to get the individual payouts,
        // ignore the remainder; it'll just get returned at the end.

        let net_slice = net_payment / count; 

        // pay each of the recipients in a loop.
        // -- we might find out a recipient does not exist!  even if they existed once before,
        // accounts can be deleted.  If that happens, we should abort with an explanation,
        // and make the stateless gods fix things.

        let promises: Vec<Promise> = payees.into_iter().map(|p| {
            Promise::new(p.to_string()).transfer(net_slice)
        } ).collect();
        
        // boil all those promises down into a super-promise:

        //let mut big_p = promises.iter().reduce(|a, b| &a.clone().and(b.clone()) ).unwrap();
        
        let mut big_p = promises[0].clone();
        for pi in 1..promises.len() {
            big_p = big_p.and(promises[pi].clone());
        }

        let finish = Promise::new( env::current_account_id() ).function_call(b"report_payment".to_vec(), 
                                                                        json!({
                                                                            "amount": U128(net_slice)
                                                                        }).to_string().into_bytes(),
                                                                        0, // no payment 
                                                                        est_gas_end.try_into().unwrap()
                                                                        );
        big_p.then(finish)
    }

    pub fn report_payment(&self, amount: U128) -> AmtYoctoU128 { 
        // TODO: a handful of rounding and mis-estimates of gas might want to get refunded here,
        // or else this contract will slowly build up some savings.
        
        // Return the payout amount.
        amount
    }


    pub fn be_good(&self) -> bool {
        true
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
        let mut contract = Distrotron {};

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
        let mut contract = Distrotron {};

    }

    #[test]
    // pay_out should succeed with multiple recipients
    fn pay_out_4() { 
        let c = get_context(vec![], false);
        c.attached_deposit = to_ynear(10);
        testing_env!(c);
        let mut contract = Distrotron {};

        let chumps = vec![bob(), carol(), dick(), eve()];

        // how much money does bob have before the call?  probably not much?
        let before = chumps[0].account().unwrap().amount;
        let cut = contract.pay_out(chumps);
        let after = chumps[0].account().unwrap().amount;
        assert_eq!(after - before, cut, "bob was ripped off!");
    }

    // more functional tests are performed in the Simulator & Sandbox.

}

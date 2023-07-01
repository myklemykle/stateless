//! This contract distributes incoming payments of NEAR tokens to a list of recipient accounts.

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{
    env, ext_contract, log, near_bindgen, AccountId, Balance, Promise, PromiseOrValue,
    PromiseResult, PromiseResult::Failed,
};

near_sdk::setup_alloc!();

#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
#[doc(hidden)]
pub struct Distrotron {
    // no blockchain data in this contract, just a NEAR balance.
}

// near_sdk::Balance is u128, so the JSON BigInt equiv is:
pub type JsonBalance = U128;

const GGAS: u64 = 1_000_000_000;
const TGAS: u64 = 1000 * GGAS;

// Here are some generous gas estimates, for when you're working on modifications that might increase gas consumption:
//const TXFEE_GAS: u64 = 2 * TGAS;
//const LIST_MINTERS_GAS: u64 = 10 * TGAS; // should cost nothing, it's a read method!
//const PAY_MINTERS_GAS: u64  = 50 * TGAS;
//const REFUND_UNPAID_GAS: u64  = 10 * TGAS;
//const REPORT_PAYMENT_GAS: u64  = 10 * TGAS;
//
// These more tightwad measurements are actual gas costs measured from real transactions,
// specific to the date & version of this contract where I made the measurements.
// (The NEAR Explorer shows the gas cost of each part of the transaction.)
// If you modify the contract, please re-check the Explorer and update these if necessary.
//
// Also, if you are seeing the contract fail with "exceeded the prepaid gas" it may be that
// the built-in costs of the network have changed.
//
// Also in our stub contract it seems to cost more as the number of minters goes up ....
//
const TXFEE_GAS: u64 = 2 * TGAS;
const LIST_MINTERS_GAS: u64 = 10 * TGAS; // actually should not cost any gas at all for a read-only method
                                        // ... am i calling it wrong?
const PAY_MINTERS_GAS: u64 = 9 * TGAS;  // was 8 TGAS; prices went up circa June 2023.
const REFUND_UNPAID_GAS: u64 = 3 * TGAS;
const REPORT_PAYMENT_GAS: u64 = 3 * TGAS; // EST

/// The list_minters() API method on a Mintbase contract returns a list of NEAR accounts
/// who are authorized to mint with that contract instance.
/// The contract owner can modify this list in the Mintbase interface.
#[ext_contract(ext_mintbase_contract)]
#[doc(hidden)]
trait MinterContract {
    fn list_minters(&self) -> Vec<AccountId>;
}

/// Callback methods on this contract.
#[ext_contract(callbacks)]
trait MyCallbacks {
    /// This is the callback target of the remote call to list_minters()
    fn list_minters_cb(self) -> Promise;
}

/// Public methods on this contract for making payments.
trait Payments {
    fn split_payment(&mut self, payees: Vec<AccountId>) -> Promise;
    fn pay_minters(&mut self, minter_contract: AccountId) -> Promise;
    fn list_minters_cb(&mut self) -> Promise;
    fn refund_unpaid(&self, amount: JsonBalance) -> PromiseOrValue<JsonBalance>;
    fn report_payment(&self, amount: JsonBalance) -> JsonBalance;
}

// our contract:
#[near_bindgen]
impl Payments for Distrotron {
    /// Takes a list of NEAR account IDs.
    /// Divides an attached payment of NEAR evenly between those accounts.
    /// Returns a Promise that resolves to the number of YoctoNEAR paid to each recipient.
    //  __split_payment is the real function, this is just the external wrapper.
    #[payable]
    fn split_payment(&mut self, payees: Vec<AccountId>) -> Promise {
        self.__split_payment(payees)
    }

    /// Takes a Mintbase contract ID.
    /// Fetches the list of NEAR accounts from that contract's list_minters() method,
    /// then delegates to split_payment() to distribute the attached funds to those accounts.
    /// Returns a Promise that resolves to the number of YoctoNEAR paid to each recipient.
    #[payable]
    fn pay_minters(&mut self, minter_contract: AccountId) -> Promise {
        assert!(
            env::is_valid_account_id(minter_contract.as_bytes()),
            "Invalid contract ID"
        );
        ext_mintbase_contract::list_minters(&minter_contract, 0, LIST_MINTERS_GAS).then(
            callbacks::list_minters_cb(
                &env::current_account_id(),
                env::attached_deposit(),
                ////////////////////////////////
                // complicated gas accounting:
                // send along all the gas we got,
                env::prepaid_gas()
                    // except for:
                    - (
                    // what we've used so far,
                    env::used_gas()
                    // plus what we just attached to the other promise above,
                     + LIST_MINTERS_GAS
                    // plus the gas for this method
                     + PAY_MINTERS_GAS
                     // and the overhead gas cost of the entire transaction
                     + TXFEE_GAS
                    ), ////////////////////////////////
            ),
        )
    }

    /// Callback method.
    /// Takes a list of minters from a cross-contract call to list_minters()
    /// Performs safety checks, and begins the payment.
    #[payable]
    fn list_minters_cb(&mut self) -> Promise {
        // pattern from https://docs.near.org/docs/tutorials/contracts/xcc-rust-cheatsheet :
        assert_eq!(env::promise_results_count(), 1, "This is a callback method");

        match env::promise_result(0) {
            PromiseResult::NotReady => unreachable!(),
            PromiseResult::Failed => env::panic(b"minter contract failure"),
            PromiseResult::Successful(val) => {
                let payees = near_sdk::serde_json::from_slice::<Vec<AccountId>>(&val).unwrap();

                // test for length:
                assert!(payees.len() > 0, "no minters found");

                self.__split_payment(payees)
            }
        }
    }

    #[doc(hidden)]
    // If all our payments succeeded, there should be no more attached deposit.
    // But if anything failed, we need to do a refund of all remaining funds.
    // This func must be public so that it can be the target of a function_call()
    fn refund_unpaid(&self, amount: JsonBalance) -> PromiseOrValue<JsonBalance> {
        // i'm sure there's a Rust one-liner for this:
        let i = env::promise_results_count();
        let mut fails: u64 = 0;
        for p in 1..i {
            if env::promise_result(p) == Failed {
                fails += 1;
            }
        }

        if fails > 0 {
            // process a refund
            let refund = u128::from(fails) * amount.0;
            log!("{}/{} payments succeeded", (i - fails), i);
            log!("refunding {} yocto to caller", refund);
            let refund_promise = Promise::new(env::signer_account_id()).transfer(refund);
            PromiseOrValue::Promise(refund_promise)
        } else {
            // No failures, no refund needed.
            //
            log!("All {} payments succeeded", i);
            PromiseOrValue::Value(amount)
        }
    }

    #[doc(hidden)]
    /// When all payments are complete, this function returns the number of YoctoNear paid to each payee.
    // Really it just echoes back the JsonBalance passed to it.
    // This func must be public so that it can be the target of a function_call()
    fn report_payment(&self, amount: JsonBalance) -> JsonBalance {
        // Return the count of how much each payee received:
        amount
    }
}

impl Distrotron {
    /// abort if the payment or payee list are invalid
    fn test_payees(&mut self, payees: Vec<AccountId>) -> bool {
        // count the recipients.
        // u32 only goes to 4 billion, and there are 8+ billion people in the world ...
        let count: u128 = payees.len().try_into().unwrap();

        // Fail if none.
        assert!(count > 0, "Empty recipient list");

        // count the money & fail if none.
        assert!(env::attached_deposit() > 0, "No payment attached");

        // Other tests:
        //
        // We'd like to parse the recipients list & make sure they're not garbled,
        // or else count on the transaction failing if it's not kosher.
        // But apparently we can't test if accounts exist for some NEAR reason:
        // https://stackoverflow.com/questions/70819819/how-can-i-verify-if-a-near-address-is-valid-in-smart-contract/70820257#70820257

        // We could at least check that the IDs are valid format:
        // https://docs.rs/near-sdk/latest/near_sdk/env/fn.is_valid_account_id.html
        /*
        for acct_id in payees.clone().into_iter() {
            assert!( env::is_valid_account_id(acct_id.as_bytes()) ) ;
        }
        */
        // ... but what's the point if it can still fail?

        true
    }

    /// Pay out the complete attached sum to the payees, no matter the gas.
    fn __split_payment(&mut self, mut payees: Vec<AccountId>) -> Promise {
        self.test_payees(payees.clone());

        // sort and de-dup
        payees.sort();
        payees.dedup();

        let total_payment: Balance = env::attached_deposit();
        let count: u128 = payees.len().try_into().unwrap();

        // Divide the yocto by the number of payees to get the individual payouts
        //
        // NOTE: this is integer division;
        // the remainder, some integer yocto less than count, will be abandoned in this contract account.
        //
        // At time of writing, that sum is so much vastly less than one cent that I'm losing money just by thinking about it.
        //
        // But it occurs to me that this sort of leftover must exist everywhere in the universe of
        // traditional banking and blockchain.  One assumes, or hopes, that any sort of abuse or bug will be detected
        // by audits.

        // TODO: we could return it .... though i think that costs more in gas than you'd get back.

        let slice: Balance = total_payment / count;

        let refund_unpaid_promise = Promise::new(env::current_account_id()).function_call(
            b"refund_unpaid".to_vec(),
            json!({ "amount": U128(slice) }).to_string().into_bytes(),
            0, // no payment
            REFUND_UNPAID_GAS,
        );

        let report_payment_promise = Promise::new(env::current_account_id()).function_call(
            b"report_payment".to_vec(),
            json!({ "amount": U128(slice) }).to_string().into_bytes(),
            0, // no payment
            REPORT_PAYMENT_GAS,
        );

        let payment_promise = self.pay_each(payees.clone(), slice); // all of it
        payment_promise
            .then(refund_unpaid_promise)
            .then(report_payment_promise)
    }

    /// Initiate transfers to the payees, and return a single Promise that
    /// resolves once all of the transfers have completed or failed.
    fn pay_each(&self, payees: Vec<AccountId>, sum: Balance) -> Promise {
        // pay each payee in a loop
        let promises: Vec<Promise> = payees
            .into_iter()
            .map(|p| Promise::new(p.to_string()).transfer(sum))
            .collect();

        // boil all those promises down into a super-promise
        let mut big_p = promises[0].clone();
        for pi in 1..promises.len() {
            big_p = big_p.and(promises[pi].clone()); // execute in parallel
        }

        big_p
    }
}

#[cfg(test)]
mod unit_tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, VMContext};

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

    #[test]
    // split_payment should fail with no list of recipients:
    #[should_panic(expected = r#"Empty recipient list"#)]
    fn split_payment_1() {
        let mut c = get_context(vec![], false);
        c.attached_deposit = to_ynear(10);
        testing_env!(c);
        let mut contract = Distrotron {};

        let chumps = vec![];
        let _cut = contract.split_payment(chumps);
    }

    #[test]
    // split_payment should fail if no payment attached
    #[should_panic(expected = r#"No payment attached"#)]
    fn split_payment_2() {
        let c = get_context(vec![], false);
        testing_env!(c);
        let mut contract = Distrotron {};
        let chumps = vec![bob(), carol(), dick(), eve()];
        let _cut = contract.split_payment(chumps);
    }

    // pay_minters() should fail if argument is invalid
    #[test]
    #[should_panic(expected = r#"Invalid contract ID"#)]
    fn pay_minters_1() {
        let mut c = get_context(vec![], false);
        c.attached_deposit = to_ynear(10);
        testing_env!(c);
        let mut contract = Distrotron {};
        contract.pay_minters("i".to_string()); // invalid; minimum length is 2
    }

    // No unit tests are provided here for the methods that return Promises to external contract calls;
    // run sandbox tests for coverage of those.
}

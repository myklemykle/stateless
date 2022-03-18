// see https://github.com/near/near-sdk-rs/tree/master/near-sdk-sim
use near_sdk::serde_json::json;
use near_sdk_sim::{DEFAULT_GAS, init_simulator, to_yocto, STORAGE_AMOUNT, UserAccount};
use near_sdk::{env, AccountId};
use near_sdk::json_types::U128;


use crate::utils::init;

#[test]
fn new_user() {
    let (root, contract, _alice) = init();
    let bob = root.create_user("bob".parse().unwrap(), to_yocto("100"));
}

// testing the testing of tests in general:
#[test]
fn testytest(){
    let (root, contract, _alice) = init();

    let result = root.call(
        contract.account_id(),
        "be_good", 
        &json!({
        }).to_string().into_bytes(),
        DEFAULT_GAS,
        to_yocto("300"), // deposit
    );

    result.assert_success();
    //assert_eq!(result.unwrap_borsh::<bool>(), true);
    assert_eq!(result.unwrap_json::<bool>(), true);
}

// pay_out should fail with no list of recipients:
#[test]
#[should_panic(
  expected = r#"Empty recipient list"#
)]
fn pay_out_nobody() {
    let (root, contract, alice) = init();

    let result = root.call(
        contract.account_id(),
        "pay_out", 
        &json!({
          "payees": []
        }).to_string().into_bytes(),
        DEFAULT_GAS,
        to_yocto("300"), // deposit
    );

    // we don't get the panic unless we call promise_errors() apparently
    let arrrgh = result.promise_errors().first().unwrap().as_ref().unwrap().unwrap_json::<String>();
}


// pay_out should fail if no payment attached
#[test]
#[should_panic(
    expected = r#"No payment attached"#
)]
fn pay_out_nomoney() {
    let (root, contract, alice) = init();

    let bob = root.create_user("bob".parse().unwrap(), to_yocto("10"));
    let carol = root.create_user("carol".parse().unwrap(), to_yocto("10"));
    let dick = root.create_user("dick".parse().unwrap(), to_yocto("10"));

    env::log_str("calling");
    let result = root.call(
        contract.account_id(),
        "pay_out", 
        &json!({
            "payees": [bob.account_id(), carol.account_id(), dick.account_id()]
        }).to_string().into_bytes(),
        DEFAULT_GAS,
        to_yocto("0"), // deposit
    );
    env::log_str("called");

    // Fuck Rust with a spoon:
    let arrrgh = result.promise_errors().first().unwrap().as_ref().unwrap().unwrap_json::<String>();
}
    
// IMHO pay_out() should fail if any of the users don't exist.
// AND, none of the money should have moved when the dust clears!
// alas, we can't test that.
// https://stackoverflow.com/questions/70819819/how-can-i-verify-if-a-near-address-is-valid-in-smart-contract/70820257#70820257


// this one should succeed:
#[test]
fn payout_1() {
    let (root, contract, alice) = init();
    let bob = root.create_user("bob".parse().unwrap(), to_yocto("10"));
    let carol = root.create_user("carol".parse().unwrap(), to_yocto("10"));
    let dick = root.create_user("dick".parse().unwrap(), to_yocto("10"));

    assert_eq!(bob.account().unwrap().amount, to_yocto("10"));

    let result = root.call(
        contract.account_id(),
        "pay_out", 
        &json!({
            "payees": [bob.account_id(), carol.account_id(), dick.account_id()]
            //"payees": [bob.account_id()]
        }).to_string().into_bytes(),
        DEFAULT_GAS,
        to_yocto("300"), // deposit
    );

    result.assert_success();
    let retvalstr: U128 = result.unwrap_json();
    let retval: u128 = retvalstr.into();
    assert!(retval > 0, "negative payment error");
    println!("pay_out paid each user: {}", &retval);

    // assert everybody got paid:
    assert_eq!(bob.account().unwrap().amount, (to_yocto("10") + retval));
    assert_eq!(carol.account().unwrap().amount, (to_yocto("10") + retval));
    assert_eq!(dick.account().unwrap().amount, (to_yocto("10") + retval));

    // TODO: have a look at how much was returned?
}



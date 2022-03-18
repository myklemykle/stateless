near_sdk_sim::lazy_static_include::lazy_static_include_bytes! {
    // update `contract.wasm` for your contract's name
    CONTRACT_WASM_BYTES => "target/wasm32-unknown-unknown/release/distrotron.wasm",

    // if you run `cargo build` without `--release` flag:
    // CONTRACT_WASM_BYTES => "target/wasm32-unknown-unknown/debug/distrotron.wasm",
}

use near_sdk_sim::{deploy, init_simulator, to_yocto, STORAGE_AMOUNT, UserAccount};
use near_sdk::json_types::ValidAccountId;

const CONTRACT_ID: &str = "distrotron";

pub fn init() -> (UserAccount, UserAccount, UserAccount) {
    // Use `None` for default genesis configuration; more info below
    let root = init_simulator(None);

    let initial_balance = near_sdk_sim::to_yocto("1000");

    let contract = root.deploy(
        &CONTRACT_WASM_BYTES,
        CONTRACT_ID.parse().unwrap(),
        //STORAGE_AMOUNT // attached deposit
        initial_balance
    );


    let alice = root.create_user(
        "alice".parse().unwrap(),
        to_yocto("100") // initial balance
    );

    (root, contract, alice)
}


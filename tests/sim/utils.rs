near_sdk_sim::lazy_static_include::lazy_static_include_bytes! {
    // update `contract.wasm` for your contract's name
    CONTRACT_WASM_BYTES => "target/wasm32-unknown-unknown/release/distrotron.wasm",

    // if you run `cargo build` without `--release` flag:
    CONTRACT_WASM_BYTES => "target/wasm32-unknown-unknown/debug/distrotron.wasm",
}


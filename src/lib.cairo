pub mod contracts {
    pub mod synthetic_btc;
    pub mod shielded_vault;
    pub mod market_factory;
    pub mod market_logic;
    pub mod oracle_adapter;
}

pub mod interfaces {
    pub mod i_market;
    pub mod i_vault;
}

pub mod utils {
    pub mod merkle;
    pub mod pedersen;
}

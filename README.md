# StarkBet -- Bitcoin-Native Private Prediction Markets on Starknet

StarkBet is a trustless, privacy-preserving prediction market protocol built on
Starknet. Users deposit Bitcoin via the Lightning Network, which is atomically
swapped to STRK and shielded inside a Pedersen commitment-based vault. All bets,
claims, and withdrawals occur without exposing participant identity, position size,
or wallet linkage on-chain.

The protocol consists of five Cairo smart contracts deployed on Starknet Sepolia,
a Next.js frontend, and integrations with the Atomiq cross-chain swap SDK and
the Avnu DEX aggregator.

---



## 1. Architecture Overview

```
+---------------------------------------------------------------------+
|                          USER (Browser)                              |
|                                                                      |
|   Leather/UniSat           Argent X / Braavos                        |
|   (Bitcoin Wallet)         (Starknet Wallet)                         |
+--------+---------------------------+--------------------------------+
         |                           |
         | Lightning Invoice         | Starknet Transactions
         |                           |
+--------v-----------+    +----------v---------------------------------+
|                    |    |              Starknet Sepolia               |
|   Atomiq SDK       |    |                                            |
|   (Cross-chain     |    |  +---------------+    +----------------+   |
|    Swap Service)   +---->  | STRK (ERC-20) |    | SyntheticBTC   |   |
|                    |    |  | Native Token  |    | (ERC-20, sBTC) |   |
|   BTC Lightning    |    |  +-------+-------+    +----------------+   |
|   --> STRK Atomic  |    |          |                                 |
|       Swap         |    |          | approve + deposit               |
+--------------------+    |          |                                 |
                          |  +-------v---------+                       |
                          |  |                 |   record_shielded_bet |
                          |  | ShieldedVault   +----------+            |
                          |  |                 |          |            |
                          |  | - Pedersen      |   +------v---------+  |
                          |  |   Commitments   |   |                |  |
                          |  | - Merkle Tree   |   | MarketLogic    |  |
                          |  | - Nullifiers    |   |                |  |
                          |  |                 |   | - YES/NO pools |  |
                          |  +-----------------+   | - Payout calc  |  |
                          |                        |                |  |
                          |  +---------------+     +------^---------+  |
                          |  |               |            |            |
                          |  | MarketFactory +------------+            |
                          |  |               | create_market            |
                          |  +---------------+                         |
                          |                                            |
                          |  +----------------+   resolve_market       |
                          |  |                +----------+             |
                          |  | OracleAdapter  |          |             |
                          |  |                +----------+             |
                          |  | - Propose      |                        |
                          |  | - Dispute      |                        |
                          |  | - Finalize     |                        |
                          |  +----------------+                        |
                          +--------------------------------------------+
```

### Contract Interaction Graph

```
MarketFactory ----> MarketLogic.create_market()
OracleAdapter ----> MarketLogic.resolve_market()
ShieldedVault ----> MarketLogic.record_shielded_bet()
ShieldedVault ----> MarketLogic.get_winning_outcome()
ShieldedVault ----> MarketLogic.calculate_payout()
ShieldedVault ----> IERC20.transfer_from()  (deposit)
ShieldedVault ----> IERC20.transfer()       (withdraw)
SyntheticBTC  ---- standalone ERC-20, mint/burn by owner or vault
```

---

## 2. Contract System

All contracts are written in Cairo and compiled with Scarb. Tests use snforge.

### 2.1 ShieldedVault

The privacy core of the protocol. Holds all deposited collateral and manages the
commitment-based accounting system. No balances are stored per address. Instead,
funds are tracked via Pedersen commitments in an append-only Merkle tree.

**Deployed at:** `0x0450b0a20267edf8469e1b342a8b9631e1465c17baa655643cffa08d8f643509`

#### Storage

| Variable             | Type                        | Purpose                                    |
| -------------------- | --------------------------- | ------------------------------------------ |
| `owner`              | `ContractAddress`           | Admin who can configure contract addresses |
| `market_contract`    | `ContractAddress`           | Authorized MarketLogic address             |
| `token_contract`     | `ContractAddress`           | ERC-20 used as collateral (STRK)           |
| `leaves`             | `Map<u64, felt252>`         | Merkle tree leaf array                     |
| `tree_size`          | `u64`                       | Current number of leaves                   |
| `current_root`       | `felt252`                   | Latest Merkle root                         |
| `root_history`       | `Map<u64, felt252>`         | Circular buffer of 30 recent roots         |
| `root_history_index` | `u64`                       | Write cursor for root history              |
| `nullifiers`         | `Map<felt252, bool>`        | Spent nullifier registry                   |
| `commitment_amounts` | `Map<felt252, u256>`        | Balance per commitment                     |
| `bet_amounts`        | `Map<(felt252, u64), u256>` | Bet amount per (commitment, market_id)     |
| `bet_outcomes`       | `Map<(felt252, u64), u8>`   | Bet outcome per (commitment, market_id)    |
| `bet_exists`         | `Map<(felt252, u64), bool>` | Bet existence flag                         |

#### Constants

| Name                | Value | Meaning                         |
| ------------------- | ----- | ------------------------------- |
| `TREE_DEPTH`        | 20    | Supports 2^20 (~1M) commitments |
| `MAX_ROOTS_HISTORY` | 30    | Number of historical roots kept |

#### Functions

| Function              | Access     | Description                                       |
| --------------------- | ---------- | ------------------------------------------------- |
| `deposit`             | Anyone     | Pull ERC-20, store commitment, update Merkle tree |
| `withdraw`            | Anyone*    | Verify nullifier + root, transfer ERC-20 out      |
| `place_bet`           | Anyone*    | Spend commitment, record bet, notify MarketLogic  |
| `claim_winnings`      | Anyone*    | Verify winning bet, re-shield payout as new note  |
| `set_market_contract` | Owner only | Set authorized MarketLogic address                |
| `set_token_contract`  | Owner only | Set ERC-20 collateral address                     |

*Requires valid nullifier and known Merkle root.

#### Events

`Deposit`, `Withdrawal`, `BetPlaced`, `WinningsClaimed`, `NewCommitment`

---

### 2.2 MarketLogic

Manages binary (YES/NO) prediction markets with fixed-pool pricing. All bet
recording is restricted to calls from the ShieldedVault to maintain privacy
separation -- no user address touches this contract during betting.

**Deployed at:** `0x028a330aa0e604aecad4f0a6ec07267238172ec8aff6038c5d1634e6e26f3ae5`

#### Storage

| Variable         | Type               | Purpose                     |
| ---------------- | ------------------ | --------------------------- |
| `owner`          | `ContractAddress`  | Admin                       |
| `vault_address`  | `ContractAddress`  | Authorized ShieldedVault    |
| `oracle_address` | `ContractAddress`  | Authorized OracleAdapter    |
| `markets`        | `Map<u64, Market>` | All market state            |
| `market_count`   | `u64`              | Auto-incrementing market ID |

#### Market Struct

```
Market {
    id:              u64,
    question:        felt252,          // Short-string encoded (max 31 ASCII chars)
    end_time:        u64,              // Unix timestamp
    resolved:        bool,
    winning_outcome: u8,               // 0 = NO, 1 = YES, 2 = unresolved
    yes_pool:        u256,             // Total collateral bet on YES
    no_pool:         u256,             // Total collateral bet on NO
    total_liquidity: u256,             // Initial liquidity (0 for MVP)
    creator:         ContractAddress,
}
```

#### Functions

| Function              | Access          | Description                        |
| --------------------- | --------------- | ---------------------------------- |
| `create_market`       | Anyone          | Deploy a new YES/NO market         |
| `record_shielded_bet` | Vault only      | Add amount to YES or NO pool       |
| `resolve_market`      | Owner or Oracle | Set winning outcome after end_time |
| `calculate_payout`    | View            | Compute proportional winner payout |
| `set_vault_address`   | Owner only      | Configure authorized vault         |
| `set_oracle_address`  | Owner only      | Configure authorized oracle        |

#### Events

`MarketCreated`, `BetRecorded`, `MarketResolved`

---

### 2.3 MarketFactory

Single entry point for market creation. Delegates to MarketLogic and maintains
a registry of all market IDs.

**Deployed at:** `0x03cc847c07871110c31b3a100933eaa0a2e7a507a6d4d6c5d632f960e8ea134b`

#### Functions

| Function          | Access     | Description                                   |
| ----------------- | ---------- | --------------------------------------------- |
| `create_market`   | Anyone     | Calls MarketLogic.create_market, registers ID |
| `set_contracts`   | Owner only | Configure all downstream contract addresses   |
| `get_all_markets` | View       | Return array of all market IDs                |

---

### 2.4 OracleAdapter

Dispute-window oracle for market resolution. Implements a propose-dispute-finalize
pattern to allow community challenge before outcomes are committed.

**Deployed at:** `0x03ff7004b6c384c2dd99a735bb0a20a487efb1b0b5e2e7381599e0ddff58a4fc`

#### Resolution State Machine

```
                      propose_resolution()
    STATUS_NONE (0) -----------------------> STATUS_PROPOSED (1)
                                                  |
                                   +--------------+---------------+
                                   |                              |
                          dispute_resolution()         finalize_resolution()
                                   |              (after dispute window, no dispute)
                                   v                              |
                         STATUS_DISPUTED (2)                      |
                                   |                              |
                          finalize_resolution()                   |
                          (owner arbitration)                     |
                                   |                              |
                                   v                              v
                                        STATUS_FINALIZED (3)
                                               |
                                    calls MarketLogic.resolve_market()
```

| Function              | Access                                                        | Description                           |
| --------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `propose_resolution`  | Owner only                                                    | Propose outcome, start dispute window |
| `dispute_resolution`  | Anyone                                                        | Challenge within dispute window       |
| `finalize_resolution` | Owner (if disputed) / Anyone (if undisputed + window elapsed) | Commit outcome to MarketLogic         |
| `set_dispute_window`  | Owner only                                                    | Configure window duration (min 1 hr)  |

**Default dispute window:** 86400 seconds (24 hours).

#### Events

`ResolutionProposed`, `ResolutionDisputed`, `ResolutionFinalized`

---

### 2.5 SyntheticBTC

Standard ERC-20 token contract (name: "Synthetic Bitcoin", symbol: "sBTC",
decimals: 8). Provides mint and burn functions restricted to the owner or vault.
Used as the original collateral token design; the live deployment uses STRK as
collateral instead.

**Deployed at:** `0x0280887589cebb43ab74500aa0b95f34e7e989040bf03c05874a014a25d41a9f`

---

### 2.6 Utility Libraries

**`utils/pedersen.cairo`** -- Commitment primitives:

| Function             | Computation                   | Purpose               |
| -------------------- | ----------------------------- | --------------------- |
| `compute_commitment` | `pedersen(secret, amount)`    | Generate deposit note |
| `compute_nullifier`  | `pedersen(secret, 1)`         | Derive spend token    |
| `compute_leaf`       | `pedersen(commitment, index)` | Merkle leaf hash      |
| `compute_node`       | `pedersen(left, right)`       | Merkle internal node  |

**`utils/merkle.cairo`** -- Merkle proof verification:

| Function       | Description                                             |
| -------------- | ------------------------------------------------------- |
| `verify_proof` | Walk 20-level proof path using Pedersen hashing         |
| `zero_value`   | Compute empty subtree hash for sparse Merkle tree level |

---

## 3. Privacy Model

### 3.1 Pedersen Commitment Scheme

Every deposit into the vault creates a Pedersen commitment that hides both the
depositor's identity and the amount.

```
  secret    = random 248-bit value (31 bytes from crypto.getRandomValues)
  commitment = pedersen(secret, amount)
  nullifier  = pedersen(secret, 1)
```

**Properties:**

- **Hiding:** The commitment reveals nothing about `secret` or `amount` to
  an on-chain observer. Two deposits of the same amount produce different
  commitments.

- **Binding:** A commitment uniquely corresponds to one (secret, amount) pair.
  The depositor cannot later claim a different amount.

- **Deterministic nullifier:** Given a secret, the nullifier is fixed. This
  allows the contract to detect double-spends without learning which commitment
  is being spent.

- **Unlinkability:** The nullifier cannot be reversed to recover the secret,
  and observing a nullifier does not reveal which commitment it corresponds to.

```
             secret (private, off-chain)
                |
      +---------+---------+
      |                   |
      v                   v
  pedersen(s, amt)    pedersen(s, 1)
      |                   |
      v                   v
  commitment          nullifier
  (stored on-chain    (revealed on-chain
   at deposit time)    at spend time)
```

**MVP Simplification:** In the current deployment, the contract's internal
`_compute_nullifier` function is the identity function -- the nullifier passed
by the user is used directly as the commitment lookup key. The frontend passes
`commitment` as the nullifier argument. In a production ZK build, these would
be cryptographically separated via the scheme above.

---

### 3.2 Merkle Accumulator

Commitments are stored in an append-only structure with a running root hash.

```
  Deposit #0:  root_0 = pedersen(pedersen(C0, 0), 0)
  Deposit #1:  root_1 = pedersen(pedersen(C1, 1), root_0)
  Deposit #2:  root_2 = pedersen(pedersen(C2, 2), root_1)
  ...
  Deposit #n:  root_n = pedersen(pedersen(Cn, n), root_{n-1})
```

The contract maintains a circular buffer of the last 30 roots. When a user
spends a commitment, they provide a root value. The contract verifies the root
exists in the current or recent history, which proves the commitment was included
at some point without revealing which leaf index it occupies.

The `utils/merkle.cairo` library provides full 20-level Merkle proof verification
for production use.

---

### 3.3 Nullifier Double-Spend Prevention

```
  DEPOSIT                          SPEND (withdraw / bet / claim)
  -------                          -----
  User sends commitment C          User sends nullifier N
  Contract stores:                 Contract checks:
    commitment_amounts[C] = amt      nullifiers[N] == false
    leaves[i] = C                  Contract sets:
    root updated                     nullifiers[N] = true
                                     commitment_amounts[N] -= amt
```

Once a nullifier is marked as spent, any subsequent transaction presenting the
same nullifier is rejected. Since the nullifier is deterministically derived from
the secret, each commitment can only be spent once.

---

### 3.4 Note System

A "note" is the user's off-chain receipt that proves ownership of a vault
commitment. It contains:

```
  MixerNote {
    secret:     felt252,   // The random secret
    commitment: felt252,   // pedersen(secret, amount)  -- recomputed, not stored
    nullifier:  felt252,   // pedersen(secret, 1)       -- recomputed, not stored
    amount:     bigint,    // Deposit amount in wei
  }
```

**Serialization:** Notes are Base64-encoded JSON containing only `secret` and
`amount`. On deserialization, `commitment` and `nullifier` are recomputed from
the secret. This minimizes the data the user must back up.

**Storage:** Notes are persisted in the browser's `localStorage` under the key
`starkbet_notes`. They are also displayed in the Portfolio page for manual
backup. Loss of the note means permanent loss of funds -- by design, no party
(including the protocol operators) can recover vault funds without the note.

---

## 4. User Flows

### 4.1 Deposit Flow

```
  User                    Frontend                Atomiq SDK           Starknet
  ----                    --------                ----------           --------
   |                         |                        |                    |
   |  Enter BTC amount       |                        |                    |
   |------------------------>|                        |                    |
   |                         |  createLightningToStrkSwap(sats, addr)     |
   |                         |----------------------->|                    |
   |                         |  BOLT11 invoice         |                    |
   |                         |<-----------------------|                    |
   |  Pay Lightning invoice  |                        |                    |
   |  (or demo: 4s auto)     |                        |                    |
   |------------------------>|                        |                    |
   |                         |  waitForSwapCompletion()                    |
   |                         |----------------------->|                    |
   |                         |  STRK settled           |                    |
   |                         |<-----------------------|                    |
   |                         |                        |                    |
   |                         |  Generate note:         |                    |
   |                         |    secret = random()    |                    |
   |                         |    commitment =         |                    |
   |                         |      pedersen(s, amt)   |                    |
   |                         |                        |                    |
   |  Approve in wallet      |                        |                    |
   |<------------------------|                        |                    |
   |  Confirm                |                        |                    |
   |------------------------>|                        |                    |
   |                         |  TX (multicall):        |                    |
   |                         |    1. STRK.approve(vault, amount)  -------->|
   |                         |    2. Vault.deposit(commitment, amount) --->|
   |                         |                        |                    |
   |                         |                        |       Store commitment
   |                         |                        |       Update Merkle root
   |                         |                        |       Emit Deposit event
   |                         |                        |                    |
   |  Save note (backup)     |                        |                    |
   |<------------------------|                        |                    |
```

---

### 4.2 Bet Placement Flow

```
  User                    Frontend                       Starknet
  ----                    --------                       --------
   |                         |                               |
   |  Select market,         |                               |
   |  pick YES/NO,           |                               |
   |  enter BTC amount       |                               |
   |------------------------>|                               |
   |                         |                               |
   |                         |  [Lightning swap: same as     |
   |                         |   deposit flow steps 1-4]     |
   |                         |                               |
   |  Approve TX1 in wallet  |                               |
   |<------------------------|                               |
   |  Confirm                |                               |
   |------------------------>|                               |
   |                         |  TX1 (multicall):              |
   |                         |    1. STRK.approve(vault, amt)     ------>|
   |                         |    2. Vault.deposit(commitment1, amt) -->|
   |                         |                               |
   |                         |  Wait for TX1 confirmation    |
   |                         |  Read updated vault root      |
   |                         |                               |
   |                         |  Generate bet-receipt note:    |
   |                         |    secret2 = random()          |
   |                         |    commitment2 =               |
   |                         |      pedersen(s2, amount)      |
   |                         |                               |
   |  Approve TX2 in wallet  |                               |
   |<------------------------|                               |
   |  Confirm                |                               |
   |------------------------>|                               |
   |                         |  TX2:                          |
   |                         |    Vault.place_bet(            |
   |                         |      nullifier = commitment1,  |
   |                         |      root,                     |
   |                         |      market_id,                |
   |                         |      outcome,        -------->|
   |                         |      amount,                   |
   |                         |      new_commitment2           |
   |                         |    )                           |
   |                         |                               |
   |                         |           Vault internals:     |
   |                         |             Mark nullifier spent
   |                         |             Store bet record   |
   |                         |             Register remainder |
   |                         |                    |           |
   |                         |           Vault cross-call:    |
   |                         |             MarketLogic        |
   |                         |               .record_shielded_bet(
   |                         |                 market_id,     |
   |                         |                 outcome,       |
   |                         |                 amount)        |
   |                         |                    |           |
   |                         |           MarketLogic:         |
   |                         |             Update YES/NO pool |
   |                         |             Emit BetRecorded   |
   |                         |                               |
   |  Save claim note        |                               |
   |<------------------------|                               |
```

---

### 4.3 Claim Winnings Flow

```
  User                    Frontend                       Starknet
  ----                    --------                       --------
   |                         |                               |
   |  Paste claim note,      |                               |
   |  enter market ID        |                               |
   |------------------------>|                               |
   |                         |                               |
   |                         |  Deserialize note:             |
   |                         |    Recover secret, commitment, |
   |                         |    nullifier, amount           |
   |                         |                               |
   |                         |  Read vault root               |
   |                         |  Generate fresh note for       |
   |                         |    re-shielded winnings        |
   |                         |                               |
   |  Approve in wallet      |                               |
   |<------------------------|                               |
   |  Confirm                |                               |
   |------------------------>|                               |
   |                         |  TX:                           |
   |                         |    Vault.claim_winnings(       |
   |                         |      nullifier = commitment,   |
   |                         |      root,           -------->|
   |                         |      market_id,                |
   |                         |      new_commitment            |
   |                         |    )                           |
   |                         |                               |
   |                         |           Vault internals:     |
   |                         |             Verify bet exists  |
   |                         |             Verify bet won     |
   |                         |             Calculate payout   |
   |                         |             Mark nullifier spent
   |                         |             Create new commitment
   |                         |               with payout amount
   |                         |             Update Merkle tree |
   |                         |                               |
   |  Save new withdraw note |                               |
   |<------------------------|                               |
```

---

### 4.4 Withdrawal Flow

```
  User                    Frontend                       Starknet
  ----                    --------                       --------
   |                         |                               |
   |  Paste note,            |                               |
   |  confirm recipient      |                               |
   |------------------------>|                               |
   |                         |                               |
   |                         |  Deserialize note              |
   |                         |  Read vault root               |
   |                         |                               |
   |  Approve in wallet      |                               |
   |<------------------------|                               |
   |  Confirm                |                               |
   |------------------------>|                               |
   |                         |  TX:                           |
   |                         |    Vault.withdraw(             |
   |                         |      nullifier = commitment,   |
   |                         |      root,           -------->|
   |                         |      recipient,                |
   |                         |      amount                    |
   |                         |    )                           |
   |                         |                               |
   |                         |           Vault internals:     |
   |                         |             Verify nullifier   |
   |                         |             Verify root        |
   |                         |             Verify balance     |
   |                         |             Mark nullifier spent
   |                         |             Transfer ERC-20    |
   |                         |               to recipient     |
   |                         |                               |
   |  STRK arrives in        |                               |
   |  recipient wallet       |                               |
   |  (no link to deposit)   |                               |
```

---

### 4.5 Market Creation Flow

```
  User                    Frontend                       Starknet
  ----                    --------                       --------
   |                         |                               |
   |  Enter question         |                               |
   |  (max 31 ASCII chars),  |                               |
   |  set resolution date    |                               |
   |------------------------>|                               |
   |                         |                               |
   |                         |  Encode question:              |
   |                         |    shortString                 |
   |                         |      .encodeShortString()      |
   |                         |  Convert date to               |
   |                         |    unix timestamp              |
   |                         |                               |
   |  Approve in wallet      |                               |
   |<------------------------|                               |
   |  Confirm                |                               |
   |------------------------>|                               |
   |                         |  TX:                           |
   |                         |    MarketFactory               |
   |                         |      .create_market(  ------->|
   |                         |        question,               |
   |                         |        end_time)               |
   |                         |                               |
   |                         |        Factory delegates to:   |
   |                         |          MarketLogic           |
   |                         |            .create_market(     |
   |                         |              question,         |
   |                         |              end_time,         |
   |                         |              0)                |
   |                         |        Registers market_id     |
   |                         |        Emits MarketDeployed    |
   |                         |                               |
```

---

### 4.6 Market Resolution Flow

```
  Oracle Owner              OracleAdapter                MarketLogic
  ------------              -------------                -----------
       |                         |                            |
       |  propose_resolution(    |                            |
       |    market_id, outcome)  |                            |
       |------------------------>|                            |
       |                         |  Store proposal            |
       |                         |  Set STATUS_PROPOSED       |
       |                         |  Start dispute window      |
       |                         |  (default: 24 hours)       |
       |                         |                            |
       |                         |                            |
       |      --- DISPUTE WINDOW (24h) ---                    |
       |                         |                            |
       |  CASE A: No dispute     |                            |
       |  Anyone calls:          |                            |
       |  finalize_resolution()  |                            |
       |------------------------>|                            |
       |                         |  Verify window elapsed     |
       |                         |  Set STATUS_FINALIZED      |
       |                         |  resolve_market(           |
       |                         |    market_id,    --------->|
       |                         |    outcome)                |
       |                         |                  Set resolved=true
       |                         |                  Set winning_outcome
       |                         |                            |
       |  CASE B: Dispute filed  |                            |
       |  Anyone calls:          |                            |
       |  dispute_resolution()   |                            |
       |------------------------>|                            |
       |                         |  Set STATUS_DISPUTED       |
       |                         |                            |
       |  Owner arbitrates:      |                            |
       |  finalize_resolution()  |                            |
       |------------------------>|                            |
       |                         |  resolve_market() -------->|
       |                         |                            |
```

---

## 5. Cross-Chain Swap Layer

The BTC-to-STRK conversion uses the Atomiq SDK for trustless atomic swaps over
the Lightning Network.

```
  Bitcoin Lightning Network              Starknet
  -------------------------              --------

  User pays BOLT11 invoice               Atomiq releases STRK
  (sats leave user's                     (STRK arrives in user's
   Lightning wallet)                      Starknet wallet)

  +-------------------+                 +-------------------+
  |                   |   Atomic Swap   |                   |
  |  Leather / UniSat |  <----------->  |  Argent X         |
  |  (BTC wallet)     |   via Atomiq    |  (STRK wallet)    |
  |                   |                 |                   |
  +-------------------+                 +-------------------+
```

**Key functions:**

| Function                    | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `createLightningToStrkSwap` | Request BOLT11 invoice for BTC -> STRK swap |
| `waitForSwapCompletion`     | Poll swap status until STRK is settled      |
| `getSwapLimits`             | Query min/max swap amounts from Atomiq      |
| `getStrkBalance`            | Read STRK balance via RPC `balance_of` call |

**Fallback DEX integration:** The system also integrates with the Avnu DEX
aggregator on Starknet Sepolia for on-chain token swaps. This hits
`https://sepolia.api.avnu.fi/swap/v2/quotes` with 5% slippage tolerance.

In demo mode, the Lightning swap is simulated (4-second delay, fake invoice).
All on-chain operations remain real.

---

## 6. Frontend Architecture

Built with Next.js (App Router), React 19, TailwindCSS 4, starknet-react,
and starknet.js.

### Route Map

| Route        | Page      | Description                              |
| ------------ | --------- | ---------------------------------------- |
| `/`          | Home      | Landing page with protocol stats         |
| `/markets`   | Markets   | List all markets, create new ones        |
| `/portfolio` | Portfolio | Wallet balances, notes, deposit/withdraw |

### Component Tree

```
  layout.tsx
    StarknetProvider (starknet-react)
      QueryClientProvider (TanStack)
        Header
          WalletBar
            [Bitcoin wallet dropdown]
            [Starknet wallet dropdown]
        page.tsx (Home)
          [Protocol stats from on-chain reads]
        markets/page.tsx
          MarketList
            MarketCard (per market)
              [On-chain reads: get_market, get_yes_pool, get_no_pool]
              [Status: Active / Ended / Resolved]
          BetModal
            [5-step flow: quote -> pay -> confirm -> deposit -> bet]
          CreateMarketModal
            [Question input + date picker -> MarketFactory.create_market]
        portfolio/page.tsx
          [Balance cards: Wallet STRK, Shielded Collateral]
          [Action cards: Deposit, Claim, Withdraw]
          [Private Notes list from localStorage]
          DepositModal
            [Atomiq swap + vault deposit]
          ClaimModal
            [Note deserialization + claim_winnings]
          WithdrawModal
            [Note deserialization + withdraw]
```

### Wallet Integration

| Wallet   | Chain    | Connector                       | Address Type  |
| -------- | -------- | ------------------------------- | ------------- |
| Argent X | Starknet | `argent()` from starknet-react  | Starknet      |
| Braavos  | Starknet | `braavos()` from starknet-react | Starknet      |
| Leather  | Bitcoin  | `window.LeatherProvider`        | p2wpkh        |
| UniSat   | Bitcoin  | `window.unisat`                 | Native segwit |

---

## 7. Access Control Matrix

| Contract      | Function              | Caller Restriction                     |
| ------------- | --------------------- | -------------------------------------- |
| ShieldedVault | `deposit`             | Anyone                                 |
| ShieldedVault | `withdraw`            | Anyone (with valid nullifier + root)   |
| ShieldedVault | `place_bet`           | Anyone (with valid nullifier + root)   |
| ShieldedVault | `claim_winnings`      | Anyone (with valid nullifier + root)   |
| ShieldedVault | `set_market_contract` | Owner only                             |
| ShieldedVault | `set_token_contract`  | Owner only                             |
| MarketLogic   | `create_market`       | Anyone                                 |
| MarketLogic   | `record_shielded_bet` | Vault address only                     |
| MarketLogic   | `resolve_market`      | Owner or Oracle address                |
| MarketLogic   | `set_vault_address`   | Owner only                             |
| MarketLogic   | `set_oracle_address`  | Owner only                             |
| MarketFactory | `create_market`       | Anyone                                 |
| MarketFactory | `set_contracts`       | Owner only                             |
| OracleAdapter | `propose_resolution`  | Owner only                             |
| OracleAdapter | `dispute_resolution`  | Anyone (within dispute window)         |
| OracleAdapter | `finalize_resolution` | Anyone (undisputed) / Owner (disputed) |
| SyntheticBTC  | `mint` / `burn`       | Owner or Vault address                 |

---

## 8. Payout Model

StarkBet uses a fixed-pool payout model. Winners split the entire losing pool
proportionally, in addition to receiving their original stake back.

```
  payout = bet_amount + (bet_amount * losing_pool) / winning_pool
```

**Example:**

```
  YES pool: 100 STRK (total bets on YES)
  NO pool:   60 STRK (total bets on NO)

  Market resolves YES.

  A user who bet 20 STRK on YES receives:
    payout = 20 + (20 * 60) / 100
           = 20 + 12
           = 32 STRK

  Effective return: 1.6x
```

If a pool is zero (no bets on one side), all bets on the other side simply
receive their original stake back (payout = bet_amount).

---

## 9. Demo Mode

Activated by setting `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local`.

| Component               | Demo Behavior                                   | Live Behavior                   |
| ----------------------- | ----------------------------------------------- | ------------------------------- |
| Swap limits             | Permissive (1 sat to 1 BTC)                     | Queried from Atomiq             |
| Lightning invoice       | Fake BOLT11 string returned instantly           | Real invoice from Atomiq        |
| Payment confirmation    | 4-second sleep, auto-resolves                   | Polls Atomiq until STRK settles |
| STRK amount for deposit | Fixed value from `NEXT_PUBLIC_DEMO_STRK_AMOUNT` | Actual STRK received from swap  |
| On-chain approve        | Real transaction                                | Real transaction                |
| On-chain deposit        | Real transaction                                | Real transaction                |
| On-chain place_bet      | Real transaction                                | Real transaction                |
| On-chain claim_winnings | Real transaction                                | Real transaction                |
| On-chain withdraw       | Real transaction                                | Real transaction                |

**Requirement:** The connected Starknet wallet must hold at least
`DEMO_STRK_AMOUNT + 0.5 STRK` for gas fees on Sepolia.

---

## 10. Deployment

### Deployed Contracts (Starknet Sepolia)

| Contract      | Address                                                              |
| ------------- | -------------------------------------------------------------------- |
| SyntheticBTC  | `0x0280887589cebb43ab74500aa0b95f34e7e989040bf03c05874a014a25d41a9f` |
| ShieldedVault | `0x0450b0a20267edf8469e1b342a8b9631e1465c17baa655643cffa08d8f643509` |
| MarketLogic   | `0x028a330aa0e604aecad4f0a6ec07267238172ec8aff6038c5d1634e6e26f3ae5` |
| MarketFactory | `0x03cc847c07871110c31b3a100933eaa0a2e7a507a6d4d6c5d632f960e8ea134b` |
| OracleAdapter | `0x03ff7004b6c384c2dd99a735bb0a20a487efb1b0b5e2e7381599e0ddff58a4fc` |

### Build

```bash
# Contracts
cd contracts
scarb build
snforge test

# Frontend
cd frontend
npm install
npm run build
npm run dev        # development server at localhost:3000
```

### Environment Variables

| Variable                                  | Purpose                      |
| ----------------------------------------- | ---------------------------- |
| `NEXT_PUBLIC_NETWORK`                     | `sepolia` or `mainnet`       |
| `NEXT_PUBLIC_STARKNET_RPC`                | Starknet RPC endpoint        |
| `NEXT_PUBLIC_DEMO_MODE`                   | `true` to simulate Lightning |
| `NEXT_PUBLIC_DEMO_STRK_AMOUNT`            | Wei amount per demo tx       |
| `NEXT_PUBLIC_SBTC_ADDRESS`                | SyntheticBTC contract        |
| `NEXT_PUBLIC_VAULT_ADDRESS`               | ShieldedVault contract       |
| `NEXT_PUBLIC_MARKET_LOGIC_ADDRESS`        | MarketLogic contract         |
| `NEXT_PUBLIC_MARKET_FACTORY_ADDRESS`      | MarketFactory contract       |
| `NEXT_PUBLIC_ORACLE_ADDRESS`              | OracleAdapter contract       |
| `NEXT_PUBLIC_SHARED_SWAP_ACCOUNT_ADDRESS` | Atomiq swap account          |
| `SHARED_SWAP_ACCOUNT_PRIVATE_KEY`         | Swap account private key     |

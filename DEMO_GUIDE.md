# StarkBet — Demo User Guide

**Written simply, step by step. No crypto experience needed.**

---

## What Is StarkBet?

StarkBet is a betting app where you can bet on real-world questions like:

> *"Will Bitcoin reach $200,000 in 2025?"*

You bet using Bitcoin (BTC). The app secretly converts it to STRK (a different coin used on the Starknet blockchain) and places your bet **without revealing your name, wallet address, or how much you bet**. This is called **ZK-private** betting — ZK stands for Zero-Knowledge, which just means "proving something without showing everything."

---

## What Is Demo Mode?

In real life, the BTC → STRK conversion uses a service called **Atomiq** over the Bitcoin Lightning Network. On the test version of the app, that service doesn't have enough money in it to run properly.

**Demo Mode fixes this.** When Demo Mode is ON:

- The Lightning BTC payment is **fake** (skipped automatically after 4 seconds)
- Everything on the blockchain (deposits, bets, withdrawals) is **100% real** — real transactions go through on the Starknet test network (Sepolia)
- You need real testnet STRK in your wallet (free, explained below)

Think of it like a flight simulator: the cockpit controls are real, but the plane isn't actually flying.

---

## Part 1 — Setup

### What You Need

| Thing               | What It Is                                          | Where To Get It                      |
| ------------------- | --------------------------------------------------- | ------------------------------------ |
| A browser           | Chrome or Firefox work best                         | You already have it                  |
| **Argent X** wallet | A Starknet wallet (like MetaMask, but for Starknet) | Chrome Web Store → search "Argent X" |
| **Leather** wallet  | A Bitcoin wallet                                    | leatherapp.io                        |
| Testnet STRK        | Free fake money for testing                         | faucet.starknet.io                   |

---

### Step 1 — Install Argent X (Starknet Wallet)

1. Open Chrome and go to the **Chrome Web Store**
2. Search for **"Argent X"**
3. Click **Add to Chrome** → **Add Extension**
4. Click the puzzle-piece icon in your browser toolbar and pin Argent X
5. Open Argent X and click **Create a new wallet**
6. Write down your **Secret Recovery Phrase** — this is like a master password. Never share it with anyone
7. Set a password for daily use
8. Once inside Argent X, look at the top of the screen — it will say **Mainnet**. Click it and switch to **Sepolia (testnet)**

> ⚠️ **Important:** You must be on **Sepolia** (the test network), not Mainnet. Real money is on Mainnet. Sepolia is free fake money for testing.

---

### Step 2 — Get Free Testnet STRK

STRK is the coin used on Starknet. You need some to pay for transactions (like paying for stamps when sending mail).

1. Go to **https://starknet-sepolia.g.alchemy.com** (or search "Starknet Sepolia faucet")
2. Paste your Argent X wallet address (find it by clicking your wallet name at the top of Argent X — it starts with `0x`)
3. Click **Request tokens**
4. Wait about 30 seconds — you should see STRK appear in Argent X

You need at least **0.51 STRK** to use the app in demo mode (0.01 STRK for the transaction + 0.5 STRK for gas/fees).

---

### Step 3 — Install Leather (Bitcoin Wallet)

1. Go to **leatherapp.io**
2. Download the browser extension
3. Follow the setup — write down your seed phrase safely
4. You do NOT need real Bitcoin for demo mode. Leather just needs to be connected so the app knows you have a Bitcoin wallet

---

### Step 4 — Start the App

If you're running it locally:

1. Open your terminal (Mac: press `Command + Space`, type "Terminal", hit Enter)
2. Type this and press Enter:
   ```
   cd /Users/mac/Downloads/prediction_markett/frontend
   npm run dev
   ```
3. Open your browser and go to: **http://localhost:3000**

The app should load showing the **StarkBet** homepage.

---

### Step 5 — Check Demo Mode Is On

Open the file `/Users/mac/Downloads/prediction_markett/frontend/.env.local` and confirm this line is present:

```
NEXT_PUBLIC_DEMO_MODE=true
```

If it says `false`, change it to `true` and restart the app (`Ctrl+C` in terminal, then `npm run dev` again).

---

## Part 2 — Connecting Your Wallets

Every time you visit the app, you need to connect both wallets. Think of this like logging in.

### How To Connect

1. Look at the **top-right corner** of every page — you'll see two buttons: **BTC** and **SNK**
2. Click **SNK** first → a list of wallets appears → click **Argent X** → Argent X pops up asking permission → click **Connect**
3. Click **BTC** → click **Leather** → approve the connection in Leather

When both are connected, both buttons will show a short version of your wallet address (like `0x1234...5678`).

> If you click **Portfolio** or **Markets** and see a "Wallet connection required" screen, just connect both wallets using the buttons in the top-right corner.

---

## Part 3 — Creating a Market

A **market** is a question that people can bet YES or NO on.

### Steps

1. Click **Markets** in the top navigation bar
2. Click the orange **Create Market** button (top-right of the Markets page)
3. A pop-up appears. Fill in:
   - **Market Question** — type your question, max 31 characters (e.g. `BTC above $150k by Dec 2025?`)
   - **Resolution Date** — pick a date when the question gets answered
4. Click **Deploy Market**
5. Argent X will pop up asking you to approve the transaction — click **Confirm**
6. Wait a few seconds — the market will appear in the list automatically (no page reload needed)

> 💡 There are suggested questions you can click to auto-fill if you don't want to type one.

---

## Part 4 — Depositing Collateral

Before you can bet, you need to put money into the **Shielded Vault**. This is like putting chips on the table at a casino — except nobody can see how many chips you have or who you are.

### Steps

1. Click **Portfolio** in the top navigation bar
2. Click **Deposit BTC** (the orange card on the left)
3. A pop-up appears. Enter an amount in BTC (e.g. `0.001`)
4. Click **Generate Invoice and Deposit**

Now watch the progress steps at the bottom of the pop-up:

| Step                             | What's Happening                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Generating Lightning invoice** | The app is creating a payment request                                                                                      |
| **Awaiting Bitcoin payment**     | In demo mode: a 4-second countdown runs automatically. No real BTC needed                                                  |
| **Confirming STRK settlement**   | The app confirms the swap happened                                                                                         |
| **Shielding STRK in vault**      | You will see **"Approve in wallet · then waiting for confirmation on-chain…"** — open Argent X and approve the transaction |

5. Argent X pops up showing two actions: **approve STRK** and **deposit to vault** — click **Confirm** on both (they come as one grouped transaction)
6. Wait for the transaction to be confirmed (usually 10–30 seconds on Sepolia)
7. When it says **"Deposited and Shielded"** — you're done!

### ⚠️ The Most Important Part — Save Your Note

After a successful deposit, a yellow box appears with a string of random text. This is your **Private Note**.

**This note is your proof that you own the money in the vault. If you lose it, the money is gone forever.**

- Click **Copy Full Note**
- Paste it into a text file and save it somewhere safe (e.g. Notes app, a password manager)

The note is also automatically saved in your browser's local storage (so it appears in your Portfolio dashboard), but always keep a manual backup.

---

## Part 5 — Placing a Bet

Once you have deposited collateral, you can bet on any market.

### Steps

1. Click **Markets** in the top navigation bar
2. Find a market you want to bet on (e.g. "Will BTC reach $200k?")
3. Click **Place Bet**
4. A pop-up appears:
   - Click **YES** or **NO** — whichever you think is right
   - Enter a BTC amount (e.g. `0.0001`)
5. Click **Place Shielded Bet**

Now watch the progress steps:

| Step                                  | What's Happening                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generating Lightning invoice**      | Creating the payment request                                                                                                                  |
| **Awaiting Bitcoin payment**          | Demo: auto-settles in 4 seconds                                                                                                               |
| **Confirming STRK settlement**        | Confirming the swap                                                                                                                           |
| **Depositing STRK to shielded vault** | **"Approve in wallet · waiting for confirmation on-chain…"** → Approve in Argent X, then wait ~20 seconds for the deposit to confirm on-chain |
| **Placing shielded bet on-chain**     | **"Check your Starknet wallet to approve the transaction"** → Approve in Argent X again                                                       |

6. When it says **"Bet Placed"** — your bet is live!
7. Copy your **Claim Note** — this is how you collect your winnings later. Save it somewhere safe.

> 💡 Why are there two Argent X approvals? The bet has two on-chain steps: first deposit your STRK into the shielded vault, then place the actual bet. Both need your signature.

---

## Part 6 — Claiming Winnings

When a market resolves and you bet on the winning side, you can claim your winnings.

### Steps

1. Go to **Portfolio**
2. Click **Claim** (the red card in the middle)
3. A pop-up appears asking for:
   - Your **Claim Note** (the one you saved after betting — paste it in)
   - The **Market ID** (a number, visible on the Markets page next to the market)
4. Click **Claim Winnings**
5. Approve the transaction in Argent X
6. Your winnings are re-shielded as a new note — copy and save it just like before

---

## Part 7 — Withdrawing

When you want to take your STRK back out of the vault (without anyone knowing where it goes), use Withdraw.

### Steps

1. Go to **Portfolio**
2. Click **Withdraw** (the purple card on the right)
3. A pop-up appears asking for:
   - Your **Private Note** (the one you saved after depositing)
   - A **recipient address** — this is the Starknet wallet address you want the STRK sent to (can be any wallet, even a brand new one with no history)
4. Click **Withdraw**
5. Approve the transaction in Argent X
6. The STRK appears in the recipient wallet — with no on-chain link to your original deposit

---

## Part 8 — The Portfolio Dashboard

The **Portfolio** page shows you everything at a glance:

| Card                    | What It Shows                                                             |
| ----------------------- | ------------------------------------------------------------------------- |
| **Wallet STRK**         | How much STRK is in your Argent X wallet right now (available to deposit) |
| **Shielded Collateral** | Total STRK locked in the vault across all your notes                      |
| **Wallet**              | Your connected wallet addresses                                           |

Below the cards is the **Private Notes** section. Every note from every deposit and bet is listed here (saved in your browser). You can:
- **Copy** a note to paste somewhere safe
- **Remove** a note from the list (warning: only do this if you've already spent it, or you have a backup)
- Click **Refresh** to re-read your STRK balance from the blockchain

---

## Common Problems & Fixes

### "Transaction Failed" / Error message in the modal

- Make sure you are on **Sepolia testnet** in Argent X (not Mainnet)
- Make sure you have at least **0.51 STRK** in your Argent X wallet
- Click **Try Again** in the modal

### Argent X popup doesn't appear

- Check that Argent X is unlocked (click the extension icon and enter your password)
- Make sure you're on Sepolia in Argent X
- Check the browser for any blocked popups (click the address bar — there may be a popup blocker icon)

### Market doesn't appear after creating it

- Wait 5–10 seconds — the list refreshes automatically
- If still nothing, refresh the page manually

### "Connect wallets to bet" instead of a bet button

- Both BTC and SNK wallets must be connected. Check the top-right header and connect any that show "Connect"

### I lost my Private Note

- Check the **Portfolio** page — notes are saved in your browser automatically after each successful transaction
- If it's not there and you didn't save a copy elsewhere, unfortunately the funds cannot be recovered (this is by design for privacy — nobody, not even the app developers, can access vault funds without the note)

---

## Quick Reference — The Full Flow in 60 Seconds

```
SETUP
  1. Install Argent X (Starknet) + Leather (Bitcoin)
  2. Switch Argent X to Sepolia testnet
  3. Get free STRK at faucet.starknet.io
  4. Run the app: npm run dev → localhost:3000
  5. Confirm NEXT_PUBLIC_DEMO_MODE=true in .env.local

USE
  Connect wallets → top-right BTC + SNK buttons

CREATE A MARKET
  Markets → Create Market → write question → set date → Confirm in Argent X

DEPOSIT
  Portfolio → Deposit BTC → enter amount → wait 4s demo → Confirm in Argent X
  → SAVE YOUR NOTE

BET
  Markets → Place Bet → pick YES/NO → enter amount → Confirm x2 in Argent X
  → SAVE YOUR CLAIM NOTE

CLAIM WINNINGS
  Portfolio → Claim → paste claim note + market ID → Confirm in Argent X

WITHDRAW
  Portfolio → Withdraw → paste deposit note + recipient address → Confirm in Argent X
```

---

## Glossary

| Word                    | Simple Meaning                                                              |
| ----------------------- | --------------------------------------------------------------------------- |
| **STRK**                | The coin used on the Starknet blockchain. Like tokens at an arcade          |
| **Starknet Sepolia**    | The test version of Starknet. All transactions are fake/free                |
| **Shielded Vault**      | A smart contract that holds your money without revealing whose it is        |
| **Private Note**        | A secret code that proves you own money in the vault. Like a bearer cheque  |
| **Commitment**          | A secret fingerprint of your deposit stored on-chain. Reveals nothing       |
| **Nullifier**           | A one-time code you reveal when spending a note, to prevent double-spending |
| **ZK / Zero-Knowledge** | A way to prove you know something without revealing the thing itself        |
| **Lightning Network**   | A fast payment layer on top of Bitcoin. Used for the BTC → STRK swap        |
| **Demo Mode**           | Skips the real Lightning payment. Everything else is real on-chain          |
| **Gas**                 | Small fee paid in STRK to process any transaction on Starknet               |
| **Argent X**            | A browser wallet for the Starknet blockchain                                |
| **Leather**             | A browser wallet for the Bitcoin blockchain                                 |

---

*Last updated: February 2026 · StarkBet Sepolia Testnet*

# ChainSig.js Examples

This directory contains examples demonstrating how to use ChainSig.js for multi-chain transactions using NEAR's Chain Signatures (MPC).

## Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the .env file with your NEAR account credentials:**
   - Replace `ACCOUNT_ID` with your NEAR testnet account (e.g., `yourname.testnet`)
   - Replace `PRIVATE_KEY` with your actual ed25519 private key

3. **Install dependencies:**
   ```bash
   npm install
   ```

## Available Examples

### Aptos Example
```bash
npm run send-apt
```
Demonstrates sending APT tokens using NEAR Chain Signatures on Aptos testnet.

### Bitcoin Example
```bash
npm run send-btc
```
Demonstrates sending BTC using NEAR Chain Signatures on Bitcoin testnet.

### Ethereum Example
```bash
npm run send-eth
```
Demonstrates sending ETH using NEAR Chain Signatures on Ethereum Sepolia testnet.

### Solana Example
```bash
npm run send-sol
```
Demonstrates sending SOL tokens using NEAR Chain Signatures on Solana devnet.

### Sui Example
```bash
npm run send-sui
```
Demonstrates sending SUI tokens using NEAR Chain Signatures on Sui testnet.

### XRP Example
```bash
npm run send-xrp
```
Demonstrates sending XRP using NEAR Chain Signatures on XRP Ledger testnet.

### Decred Example
```bash
npm run send-dcr
```
Demonstrates sending DCR using NEAR Chain Signatures on Decred testnet.

## Important Notes

- **Funding Required**: The derived addresses need to be funded with native tokens for gas fees
- **Testnet Only**: These examples are configured for testnet networks
- **NEAR Account**: You need a NEAR testnet account with some NEAR tokens for MPC signing fees

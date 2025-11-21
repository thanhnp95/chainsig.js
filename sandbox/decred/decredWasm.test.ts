import fs from "fs"
import vm from "vm"
import path from "path"
import { fileURLToPath } from "url"
import { describe, it, expect } from "vitest"

import { Account } from "@near-js/accounts"
import { KeyPair } from "@near-js/crypto"
import { JsonRpcProvider } from "@near-js/providers"
import { KeyPairSigner } from "@near-js/signers"
import { contracts, chainAdapters } from "../../src"

// ===============================================
// Fix __dirname for ESM
// ===============================================
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===============================================
// MANUAL CONFIG (YOU MUST FILL THESE IN)
// ===============================================
const ACCOUNT_ID = "youraccount.testnet"
const PRIVATE_KEY = "ed25519:7Y...."
const CHAIN_SIGNATURE_CONTRACT_ID = "v1.signer-prod.testnet"

// Example Decred recipient
const DCR_RECEIVER = "TsoyZxpn16KJPXxhrgxsoL1yzQtp4wReq1T"

// ===============================================
// Load Go WASM runtime
// ===============================================
const wasmExecPath = path.resolve(
  __dirname,
  "../../src/chain-adapters/Decred/wasm/wasm_exec.js"
)
const wasmExecCode = fs.readFileSync(wasmExecPath, "utf8")
vm.runInThisContext(wasmExecCode) // defines global.Go

// ===============================================
// BEGIN FULL TEST
// ===============================================
describe("Decred Adapter – FULL REAL FLOW (MPC signing)", () => {
  it("runs full flow: derive → balance → build tx → MPC sign → finalize → broadcast", async () => {
    // -------------------------------------------
    // 1) Init NEAR signer
    // -------------------------------------------
    const keyPair = KeyPair.fromString(PRIVATE_KEY)
    const signer = new KeyPairSigner(keyPair)

    const provider = new JsonRpcProvider({
      url: "https://test.rpc.fastnear.com",
    })

    const nearAccount = new Account(ACCOUNT_ID, provider, signer)

    const contract = new contracts.ChainSignatureContract({
      networkId: "testnet",
      contractId: CHAIN_SIGNATURE_CONTRACT_ID,
    })

    // -------------------------------------------
    // 2) Init Decred Adapter
    // -------------------------------------------
    const derivationPath = "m/44'/42'/0'/0/0"

    // DCR UTXO + mempool adapter
    const dcrRpcAdapter = new chainAdapters.dcr.DCRRpcAdapters.Mempool(
      "https://mempool.space/testnet4/api"
    )

    const dcr = new chainAdapters.dcr.Decred({
      network: "testnet",
      contract,
      dcrRpcAdapter,
    })

    // -------------------------------------------
    // 3) Derive DCR address
    // -------------------------------------------
    const { address, publicKey } = await dcr.deriveAddressAndPublicKey(
      ACCOUNT_ID,
      derivationPath
    )

    console.log("Derived DCR Address =", address)
    expect(address.startsWith("T")).toBe(true)

    // -------------------------------------------
    // 4) Check balance
    // -------------------------------------------
    const { balance } = await dcr.getBalance(address)
    console.log("Balance atoms =", balance.toString())

    expect(typeof balance === "bigint").toBe(true)

    if (balance < 200000n) {
      console.warn("⚠ WARNING: Not enough testnet DCR to send transaction!")
    }

    // -------------------------------------------
    // 5) Build unsigned transaction
    // -------------------------------------------
    const { transaction, hashesToSign } =
      await dcr.prepareTransactionForSigning({
        publicKey,
        from: address,
        to: DCR_RECEIVER,
        value: "0.001", // DCR
      })

    console.log("Unsigned TX =", transaction.unsignedTxHex)
    console.log("Hashes To Sign =", hashesToSign)

    expect(hashesToSign.length).toBe(1)

    // -------------------------------------------
    // 6) MPC Sign via Chain Signatures
    // -------------------------------------------
    const signatures = await contract.sign({
      payloads: hashesToSign,
      path: derivationPath,
      keyType: "Ecdsa",
      signerAccount: nearAccount,
    })

    console.log("MPC Signatures =", signatures)

    // -------------------------------------------
    // 7) Finalize (apply signatures)
    // -------------------------------------------
    const signedTx = dcr.finalizeTransactionSigning({
      transaction,
      rsvSignatures: signatures,
    })

    console.log("Signed TX =", signedTx)

    expect(typeof signedTx === "string").toBe(true)

    // -------------------------------------------
    // 8) Broadcast DCR Transaction
    // -------------------------------------------
    const { hash } = await dcr.broadcastTx(signedTx)

    console.log("Broadcast TX Hash =", hash)
    console.log(`Explorer: https://mempool.space/testnet4/tx/${hash}`)

    expect(typeof hash === "string").toBe(true)
  })
})

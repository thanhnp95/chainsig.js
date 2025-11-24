// TODO: remove sandbox folder. Only for test on dev mode
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
// MANUAL CONFIG
// ===============================================
const ACCOUNT_ID = "youraccount.testnet"
const PRIVATE_KEY = "ed25519:7Y...."
const CHAIN_SIGNATURE_CONTRACT_ID = "v1.signer-prod.testnet"

// Example Decred recipient (address DCR)
const DCR_RECEIVER = "TsoyZxpn16KJPXxhrgxsoL1yzQtp4wReq1T"

// ===============================================
// Load Go WASM runtime
// ===============================================
const wasmExecPath = path.resolve(
  __dirname,
  "../../src/chain-adapters/Decred/wasm/wasm_exec.js",
)
const wasmExecCode = fs.readFileSync(wasmExecPath, "utf8")
vm.runInThisContext(wasmExecCode) // defines global.Go

// ===============================================
// BEGIN FULL TEST
// ===============================================
describe(
  "Decred Adapter – FULL REAL FLOW (MPC signing)",
  () => {
    it(
      "runs full flow: derive → balance → build tx → MPC sign → finalize → broadcast",
      async () => {
        // -------------------------------------------
        // 1) Init NEAR signer
        // -------------------------------------------
        const keyPair = KeyPair.fromString(PRIVATE_KEY)
        const signer = new KeyPairSigner(keyPair)

        const provider = new JsonRpcProvider({
          url: "https://test.rpc.fastnear.com",
        })

        const nearAccount = new Account(ACCOUNT_ID, provider, signer)
        console.log("nearAccount.accountId =", nearAccount.accountId)

        // DEBUG: verify signer key
        const signerPk = (await signer.getPublicKey()).toString()
        console.log("Signer public key =", signerPk)

        // DEBUG: verify access keys on-chain
        const accessKeyList: any = await provider.query({
          request_type: "view_access_key_list",
          finality: "final",
          account_id: ACCOUNT_ID,
        })

        console.log(
          "On-chain access keys =",
          accessKeyList.keys?.map((k: any) => k.public_key),
        )

        const contract = new contracts.ChainSignatureContract({
          networkId: "testnet",
          contractId: CHAIN_SIGNATURE_CONTRACT_ID,
          fallbackRpcUrls: ["https://test.rpc.fastnear.com"],
        })

        // -------------------------------------------
        // 2) Init Decred Adapter
        // -------------------------------------------
        const derivationPath = "m/44'/42'/0'/0/0"

        const dcrRpcAdapter = new chainAdapters.dcr.DCRRpcAdapters.Mempool(
          "https://testnet.dcrdata.org/insight/api",
        )

        const dcr = new chainAdapters.dcr.Decred({
          network: "testnet",
          contract,
          dcrRpcAdapter,
        })

        // -------------------------------------------
        // 3) Derive DCR address (MPC)
        // -------------------------------------------
        /**
         * ⚠️ NOTE:
         * dcr.deriveAddressAndPublicKey:
         *  - call ChainSignatureContract to get MPC public key
         *  - call Decred WASM to derive address from MPC pubkey
         * => address RETURN ADDRESS OF MPC KEY.
         */
        const { address, publicKey } =
          await dcr.deriveAddressAndPublicKey(ACCOUNT_ID, derivationPath)

        console.log("WASM / MPC DCR Address =", address)
        console.log("MPC publicKey (hex)   =", publicKey)

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
            publicKey,     // MPC pubkey
            from: address, // address
            to: DCR_RECEIVER,
            value: "0.5",  // DCR
          })

        console.log("Unsigned TX =", transaction.unsignedTxHex)
        console.log("Hashes To Sign =", hashesToSign)

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
        expect(typeof signedTx).toBe("string")

        // -------------------------------------------
        // 8) Broadcast DCR Transaction
        // -------------------------------------------
        const { hash } = await dcr.broadcastTx(signedTx)

        console.log("Broadcast TX Hash =", hash)
        console.log(`Explorer: https://testnet.dcrdata.org/tx/${hash}`)

        expect(typeof hash).toBe("string")
      },
      // test timeout (ms)
      30_000,
    )
  },
)

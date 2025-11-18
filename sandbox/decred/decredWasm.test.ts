// TODO: remove this test
import fs from "fs"
import vm from "vm"
import path from "path"
import { fileURLToPath } from "url"
import { describe, it, expect } from "vitest"
import { initDecredWasm } from "../../src/chain-adapters/Decred/decredWasm"

// ===============================================
// Fix __dirname for ESM (Vitest uses ESM)
// ===============================================
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===============================================
// Load Go WASM runtime (wasm_exec.js)
// ===============================================
const execPath = path.resolve(
  __dirname,
  "../../src/chain-adapters/Decred/wasm/wasm_exec.js"
)
const execCode = fs.readFileSync(execPath, "utf8")
vm.runInThisContext(execCode) // inject Go class into globalThis

// ===============================================
// TEST
// ===============================================

describe("Decred WASM Sandbox", () => {
  // -----------------------------------------------------------
  //                 TEST: deriveAddress
  // -----------------------------------------------------------
  it("deriveAddress works", async () => {
    const wasm = await initDecredWasm()

    // Valid compressed secp256k1 pubkey (33 bytes)
    const testPubKey =
      "03b10a600bf4b89f1ff8eaf0cc82222fbf919e6d1877b53699f97a6665d8485cd4"

    const res = await wasm.deriveAddress({
      pubKeyHex: testPubKey,
      network: "testnet",
    })

    console.log("Address →", res.address)

    expect(typeof res.address).toBe("string")
    expect(res.address.startsWith("Ts")).toBe(true)
  })

  // -----------------------------------------------------------
  //                 TEST: buildUnsignedTx
  // -----------------------------------------------------------
  it("buildUnsignedTx works", async () => {
    const wasm = await initDecredWasm()

    // 1) Get a valid testnet address from pubkey
    const testPubKey =
      "03b10a600bf4b89f1ff8eaf0cc82222fbf919e6d1877b53699f97a6665d8485cd4"

    const sender = await wasm.deriveAddress({
      pubKeyHex: testPubKey,
      network: "testnet",
    })

    console.log("Sender address:", sender.address)
    expect(sender.address.startsWith("Ts")).toBe(true)

    // 2) Get real scriptPubKey for that address (using wasm)
    const pk = await wasm.getPkScript({
      address: sender.address,
      network: "testnet",
    })

    expect(typeof pk.scriptPubKey).toBe("string")
    expect(pk.scriptPubKey.length).toBeGreaterThan(0)

    // 3) Build sample input
    const sampleInput = {
      txid: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      vout: 0,
      value: 100000, // atoms
      scriptPubKey: pk.scriptPubKey,
    }

    // 4) Build sample output
    const sampleOutput = {
      address: sender.address,
      value: 90000,
    }

    // 5) Build unsigned tx
    const tx = await wasm.buildUnsignedTx({
      inputs: [sampleInput],
      outputs: [sampleOutput],
      lockTime: 0,
      expiry: 0,
      network: "testnet",
    })

    console.log("Unsigned TX:", tx.unsignedTxHex)
    console.log("Hashes:", tx.hashesToSign)

    // Validate result
    expect(typeof tx.unsignedTxHex).toBe("string")
    expect(tx.unsignedTxHex.length).toBeGreaterThan(20)

    expect(Array.isArray(tx.hashesToSign)).toBe(true)
    expect(tx.hashesToSign.length).toBe(1)
    expect(tx.hashesToSign[0].length).toBe(64)
  })
})

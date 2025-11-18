// ===============================
//  Decred WASM Thin Wrapper
// ===============================
//  - Load Go WASM runtime (wasm_exec.js)
//  - Load dcr.wasm
//  - Provide typesafe wrappers
// ===============================

export interface DecredWasm {
  deriveAddress(params: {
    pubKeyHex: string
    network: 'mainnet' | 'testnet'
  }): Promise<{ address: string }>

  buildUnsignedTx(params: {
    inputs: Array<{
      txid: string
      vout: number
      value: number
      scriptPubKey: string // hex
    }>
    outputs: Array<{
      address: string
      value: number
    }>
    lockTime?: number
    expiry?: number
    network: 'mainnet' | 'testnet'
  }): Promise<{
    unsignedTxHex: string
    hashesToSign: string[]
  }>

  getPkScript(params: {
    address: string
    network: "mainnet" | "testnet"
  }): Promise<{
    scriptVersion: number
    scriptPubKey: string
  }>

  applySignatures(params: {
    unsignedTxHex: string
    signatures: string[]
  }): { signedTxHex: string }
}

let wasmReady = false
let wasmExports: any = null
declare const Go: any

// ==================================
// Init WASM
// ==================================

export async function initDecredWasm(): Promise<DecredWasm> {
  const go = new Go()

  const wasmUrl = new URL("./wasm/dcr.wasm", import.meta.url).toString()
  const execUrl = new URL("./wasm/wasm_exec.js", import.meta.url).toString()

  await loadWasmExec(execUrl)

  // -------------------------
  // Node
  // -------------------------
  if (typeof window === "undefined") {
    const fs = await import("fs")

    const filePath = wasmUrl.replace("file:///", "")
    const wasmBuffer = fs.readFileSync(filePath)

    const wasmModule = await WebAssembly.instantiate(wasmBuffer, go.importObject)
    go.run(wasmModule.instance)

    wasmExports = (global as any).decredWasm
    wasmReady = true
    return decredWasm
  }

  // -------------------------
  // Browser
  // -------------------------
  const result = await WebAssembly.instantiateStreaming(fetch(wasmUrl), go.importObject)
  go.run(result.instance)

  wasmExports = (globalThis as any).decredWasm
  wasmReady = true
  return decredWasm
}

// ==================================
// Load wasm_exec.js
// ==================================

function loadWasmExec(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Browser
    if (typeof document !== "undefined") {
      const script = document.createElement("script")
      script.src = url
      script.onload = () => resolve()
      script.onerror = () => reject(`Failed to load ${url}`)
      document.body.appendChild(script)
      return
    }

    // Node
    try {
      const filePath = url.replace("file:///", "")
      const fs = require("fs")
      const vm = require("vm")

      const code = fs.readFileSync(filePath, "utf8")
      vm.runInThisContext(code)
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

// ==================================
// Decred WASM wrapper
// ==================================

const decredWasm: DecredWasm = {
  async deriveAddress(params) {
    ensureReady()

    const result = wasmExports.deriveAddress(JSON.stringify(params))

    // unwrap js.Value (Go returns a JS object)
    const parsed = typeof result === "string" ? JSON.parse(result) : result

    if (parsed.error) throw new Error(parsed.error)
    return parsed
  },

  async buildUnsignedTx(params) {
    ensureReady()

    params.lockTime ??= 0
    params.expiry ??= 0

    const result = wasmExports.buildUnsignedTx(JSON.stringify(params))

    const parsed = typeof result === "string" ? JSON.parse(result) : result

    if (parsed.error) throw new Error(parsed.error)
    return parsed
  },

  // ==================================
  // NEW API: getPkScript
  // ==================================
  async getPkScript(params) {
    ensureReady()

    const result = wasmExports.getPkScript(JSON.stringify(params))
    const parsed = typeof result === "string" ? JSON.parse(result) : result

    if (parsed.error) throw new Error(parsed.error)
    return parsed
  },

  applySignatures(params) {
    ensureReady()
    const result = wasmExports.applySignatures(JSON.stringify(params))
    const parsed = typeof result === 'string' ? JSON.parse(result) : result
    if (parsed.error) throw new Error(parsed.error)
    return parsed
  },
}

function ensureReady() {
  if (!wasmReady) {
    throw new Error("Decred WASM not initialized. Call initDecredWasm() first.")
  }
}

export default decredWasm

import { type DCRRpcAdapter } from '@chain-adapters/Decred/DCRRpcAdapter/DCRRpcAdapter'
import type {
  DCRInput,
  DCRNetworkIds,
  DCROutput,
  DCRTransactionRequest,
  DCRUnsignedTransaction,
} from '@chain-adapters/Decred/types'
import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, RSVSignature, UncompressedPubKeySEC1 } from '@types'
import { cryptography } from '@utils'

import { initDecredWasm, type DecredWasm } from './decredWasm'

/**
 * Decred ChainAdapter implementation.
 * - Build unsigned tx + hashesToSign via Go WASM
 */
export class Decred extends ChainAdapter<
  DCRTransactionRequest,
  DCRUnsignedTransaction
> {
  private static readonly ATOMS_PER_DCR = 100_000_000

  private readonly network: DCRNetworkIds
  private readonly dcrRpcAdapter: DCRRpcAdapter
  private readonly contract: ChainSignatureContract

  private wasm?: DecredWasm
  private wasmInstance: DecredWasm | null = null

  constructor({
    network,
    contract,
    dcrRpcAdapter,
  }: {
    network: DCRNetworkIds
    contract: ChainSignatureContract
    dcrRpcAdapter: DCRRpcAdapter
  }) {
    super()
    this.initWasm()
    this.network = network
    this.dcrRpcAdapter = dcrRpcAdapter
    this.contract = contract
  }

  // -----------------------------
  // Helpers
  // -----------------------------

  static toDCR(atoms: number): number {
    return atoms / Decred.ATOMS_PER_DCR
  }

  static toAtom(dcr: number): number {
    return Math.round(dcr * Decred.ATOMS_PER_DCR)
  }

  private async getWasm(): Promise<DecredWasm> {
    if (!this.wasm) {
      this.wasm = await initDecredWasm()
    }
    return this.wasm
  }

  private async initWasm() {
    if (!this.wasmInstance) {
      this.wasmInstance = await initDecredWasm()
    }
    return this.wasmInstance
  }

  private getWasmSync(): DecredWasm {
    if (!this.wasmInstance) {
      throw new Error("WASM not initialized yet. Call prepareTransaction first.")
    }
    return this.wasmInstance
  }

  // -----------------------------
  // Balance
  // -----------------------------

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const balance = BigInt(await this.dcrRpcAdapter.getBalance(address))
    return {
      balance,
      decimals: 8,
    }
  }

  // -----------------------------
  // Derive address
  // -----------------------------

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{ address: string; publicKey: string }> {
    const wasm = await this.getWasm()

    const uncompressedPubKey = (await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })) as UncompressedPubKeySEC1 | undefined

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const compressed = cryptography.compressPubKey(uncompressedPubKey)

    const { address } = await wasm.deriveAddress({
      pubKeyHex: compressed,
      network: this.network === 'regtest' ? 'testnet' : this.network,
    })

    if (!address) {
      throw new Error('Failed to generate Decred address')
    }

    return { address, publicKey: compressed }
  }

  // -----------------------------
  // Serialization
  // -----------------------------

  serializeTransaction(transaction: DCRUnsignedTransaction): string {
    return JSON.stringify({
      unsignedTxHex: transaction.unsignedTxHex,
      publicKey: transaction.publicKey,
    })
  }

  deserializeTransaction(serialized: string): DCRUnsignedTransaction {
    const parsed = JSON.parse(serialized) as {
      unsignedTxHex: string
      publicKey: string
    }

    return {
      unsignedTxHex: parsed.unsignedTxHex,
      publicKey: parsed.publicKey,
    }
  }

  // -----------------------------
  // Build unsigned tx + hashesToSign
  // -----------------------------

  async prepareTransactionForSigning(
    transactionRequest: DCRTransactionRequest
  ): Promise<{
    transaction: DCRUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const wasm = await this.getWasm()

    // Get inputs/outputs:
    let inputs: DCRInput[]
    let outputs: DCROutput[]

    if (transactionRequest.inputs && transactionRequest.outputs) {
      ; ({ inputs, outputs } = transactionRequest)
    } else {
      if (!transactionRequest.from || !transactionRequest.to || !transactionRequest.value) {
        throw new Error(
          'Missing from/to/value for automatic UTXO selection in Decred adapter'
        )
      }

      const amount = Decred.toAtom(parseFloat(transactionRequest.value))

        ; ({ inputs, outputs } = await this.dcrRpcAdapter.selectUTXOs(
          transactionRequest.from,
          [
            {
              address: transactionRequest.to,
              value: amount,
            },
          ]
        ))
    }

    // Map inputs to format WASM
    const wasmInputs = inputs.map((input) => ({
      txid: input.txid,
      vout: input.vout,
      value: input.value,
      scriptPubKey: input.scriptPubKey.toString('hex'),
    }))

    // Map outputs to format WASM (only support address/value)
    const wasmOutputs = outputs.map((out) => {
      if ('address' in out) {
        return { address: out.address, value: out.value }
      }

      if ('script' in out) {
        throw new Error('Raw script outputs not yet supported for Decred')
      }

      // out only has { value }
      if (!('from' in transactionRequest) || !transactionRequest.from) {
        throw new Error(
          'Change output without "from" address is not supported for Decred'
        )
      }

      return {
        address: transactionRequest.from,
        value: out.value,
      }
    })

    const unsigned = await wasm.buildUnsignedTx({
      inputs: wasmInputs,
      outputs: wasmOutputs,
      lockTime: 0,
      expiry: 0,
      network: this.network === 'regtest' ? 'testnet' : this.network,
    })

    const hashesToSign: HashToSign[] = unsigned.hashesToSign.map(
      (hex): HashToSign => Array.from(Buffer.from(hex, 'hex'))
    )

    return {
      transaction: {
        unsignedTxHex: unsigned.unsignedTxHex,
        publicKey: transactionRequest.publicKey,
      },
      hashesToSign,
    }
  }

  // -----------------------------
  // Finalize: apply signatures
  // -----------------------------

  finalizeTransactionSigning({
    transaction,
    rsvSignatures,
  }: {
    transaction: DCRUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): string {

    const wasm = this.getWasmSync()

    const rawSigs = rsvSignatures.map(sig =>
      (sig.r + sig.s).padStart(128, "0")
    )

    const { signedTxHex } = wasm.applySignatures({
      unsignedTxHex: transaction.unsignedTxHex,
      signatures: rawSigs,
    })

    return signedTxHex
  }

  // -----------------------------
  // Broadcast
  // -----------------------------

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const txId = await this.dcrRpcAdapter.broadcastTransaction(txSerialized)
    return { hash: txId }
  }
}

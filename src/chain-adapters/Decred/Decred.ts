import * as bitcoin from 'bitcoinjs-lib'

import { type DCRRpcAdapter } from '@chain-adapters/Decred/DCRRpcAdapter'
import type {
  DCRInput,
  DCRNetworkIds,
  DCROutput,
  DCRTransactionRequest,
  DCRUnsignedTransaction,
} from '@chain-adapters/Decred/types'
import { parseDCRNetwork } from '@chain-adapters/Decred/utils'
import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, RSVSignature, UncompressedPubKeySEC1 } from '@types'
import { cryptography } from '@utils'

/**
 * Implementation of the ChainAdapter interface for Bitcoin network.
 * Handles interactions with both Bitcoin mainnet and testnet, supporting P2WPKH transactions.
 */
export class Decred extends ChainAdapter<
  DCRTransactionRequest,
  DCRUnsignedTransaction
> {
  private static readonly ATOMS_PER_DCR = 100_000_000

  private readonly network: DCRNetworkIds
  private readonly dcrRpcAdapter: DCRRpcAdapter
  private readonly contract: ChainSignatureContract

  /**
   * Creates a new Decred chain instance
   * @param params - Configuration parameters
   * @param params.network - Network identifier (mainnet/testnet)
   * @param params.contract - Instance of the chain signature contract for MPC operations
   * @param params.dcrRpcAdapter - Decred RPC adapter for network interactions
   */
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

    this.network = network
    this.dcrRpcAdapter = dcrRpcAdapter
    this.contract = contract
  }

  /**
   * Converts atoms to DCR
   * @param atoms - Amount in satoshis
   * @returns Amount in BTC
   */
  static toBTC(atoms: number): number {
    return atoms / Decred.ATOMS_PER_DCR
  }

  /**
   * Converts BTC to satoshis
   * @param btc - Amount in BTC
   * @returns Amount in satoshis (rounded)
   */
  static toAtom(dcr: number): number {
    return Math.round(dcr * Decred.ATOMS_PER_DCR)
  }

  private async fetchTransaction(
    transactionId: string
  ): Promise<bitcoin.Transaction> {
    const data = await this.dcrRpcAdapter.getTransaction(transactionId)
    const tx = new bitcoin.Transaction()

    data.vout.forEach((vout) => {
      const scriptPubKey = Buffer.from(vout.scriptpubkey, 'hex')
      tx.addOutput(scriptPubKey, Number(vout.value))
    })

    return tx
  }

  private static transformRSVSignature(signature: RSVSignature): Buffer {
    const r = signature.r.padStart(64, '0')
    const s = signature.s.padStart(64, '0')

    const rawSignature = Buffer.from(r + s, 'hex')

    if (rawSignature.length !== 64) {
      throw new Error('Invalid signature length.')
    }

    return rawSignature
  }

  /**
   * Creates a Partially Signed Bitcoin Transaction (PSBT)
   * @param params - Parameters for creating the PSBT
   * @param params.transactionRequest - Transaction request containing inputs and outputs
   * @returns Created PSBT instance
   */
  async createPSBT({
    transactionRequest,
  }: {
    transactionRequest: DCRTransactionRequest
  }): Promise<bitcoin.Psbt> {
    const { inputs, outputs } =
      transactionRequest.inputs && transactionRequest.outputs
        ? transactionRequest
        : await this.dcrRpcAdapter.selectUTXOs(transactionRequest.from, [
            {
              address: transactionRequest.to,
              value: parseFloat(transactionRequest.value),
            },
          ])

    const psbt = new bitcoin.Psbt({ network: parseDCRNetwork(this.network) })

    await Promise.all(
      inputs.map(async (input: DCRInput) => {
        if (!input.scriptPubKey) {
          const transaction = await this.fetchTransaction(input.txid)
          const prevOut = transaction.outs[input.vout]
          input.scriptPubKey = prevOut.script
        }

        // Prepare the input as P2WPKH
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          witnessUtxo: {
            script: input.scriptPubKey,
            value: input.value,
          },
        })
      })
    )

    outputs.forEach((out: DCROutput) => {
      if ('address' in out) {
        psbt.addOutput({
          address: out.address,
          value: out.value,
        })
      } else if ('script' in out) {
        psbt.addOutput({
          script: out.script,
          value: out.value,
        })
      } else if (transactionRequest.from !== undefined) {
        // Include change address from coinselect
        psbt.addOutput({
          value: Number(out.value),
          address: transactionRequest.from,
        })
      }
    })

    return psbt
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const balance = BigInt(await this.dcrRpcAdapter.getBalance(address))
    return {
      balance,
      decimals: 8,
    }
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{ address: string; publicKey: string }> {
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const derivedKey = cryptography.compressPubKey(
      uncompressedPubKey as UncompressedPubKeySEC1
    )
    const publicKeyBuffer = Buffer.from(derivedKey, 'hex')
    const network = parseDCRNetwork(this.network)

    const payment = bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
      network,
    })

    const { address } = payment

    if (!address) {
      throw new Error('Failed to generate Bitcoin address')
    }

    return { address, publicKey: derivedKey }
  }

  serializeTransaction(transaction: DCRUnsignedTransaction): string {
    return JSON.stringify({
      psbt: transaction.psbt.toHex(),
      publicKey: transaction.publicKey,
    })
  }

  deserializeTransaction(serialized: string): DCRUnsignedTransaction {
    const transactionJSON = JSON.parse(serialized)
    return {
      psbt: bitcoin.Psbt.fromHex(transactionJSON.psbt as string),
      publicKey: transactionJSON.publicKey,
    }
  }

  async prepareTransactionForSigning(
    transactionRequest: DCRTransactionRequest
  ): Promise<{
    transaction: DCRUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const publicKeyBuffer = Buffer.from(transactionRequest.publicKey, 'hex')
    const psbt = await this.createPSBT({
      transactionRequest,
    })
    // We can't double sign a PSBT, therefore we serialize the payload before to return it
    const psbtHex = psbt.toHex()

    const hashesToSign: HashToSign[] = []

    const mockKeyPair = (index: number): bitcoin.Signer => ({
      publicKey: publicKeyBuffer,
      sign: (hash: Buffer): Buffer => {
        hashesToSign[index] = Array.from(hash)
        // Return dummy signature to satisfy the interface
        return Buffer.alloc(64)
      },
    })

    for (let index = 0; index < psbt.inputCount; index++) {
      psbt.signInput(index, mockKeyPair(index))
    }

    return {
      transaction: {
        psbt: bitcoin.Psbt.fromHex(psbtHex),
        publicKey: transactionRequest.publicKey,
      },
      hashesToSign,
    }
  }

  finalizeTransactionSigning({
    transaction: { psbt, publicKey },
    rsvSignatures,
  }: {
    transaction: DCRUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): string {
    const publicKeyBuffer = Buffer.from(publicKey, 'hex')

    const keyPair = (index: number): bitcoin.Signer => ({
      publicKey: publicKeyBuffer,
      sign: () => {
        const mpcSignature = rsvSignatures[index]
        return Decred.transformRSVSignature(mpcSignature)
      },
    })

    for (let index = 0; index < psbt.inputCount; index++) {
      psbt.signInput(index, keyPair(index))
    }

    psbt.finalizeAllInputs()
    return psbt.extractTransaction().toHex()
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const txId = await this.dcrRpcAdapter.broadcastTransaction(txSerialized)
    return { hash: txId }
  }
}

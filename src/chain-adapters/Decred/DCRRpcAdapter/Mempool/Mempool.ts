import { DCRRpcAdapter } from '@chain-adapters/Decred/DCRRpcAdapter/DCRRpcAdapter'
import type { DCRInput, DCROutput, DCRTransaction } from '@chain-adapters/Decred/types'

// ----------------------------------
// Internal types
// ----------------------------------

interface UTXO {
  txid: string
  vout: number
  satoshis: number
  confirmations: number
  scriptPubKey: string
}

export interface DcrCoinSelectRes {
  inputs: UTXO[]
  outputs: DCROutput[]
}

export interface FeeResponse {
  [confirmationTarget: string]: number
}

export class Mempool extends DCRRpcAdapter {
  constructor(private readonly providerUrl: string) {
    super()
  }

  // fetch feerate (atoms/byte)
  private async fetchFeeRate(confirmationTarget = 2): Promise<number> {
    const res = await fetch(`${this.providerUrl}/utils/estimatefee?nbBlocks=${confirmationTarget}`)
    // get feerate (DCR/KB)
    const fee = (await res.json()) as FeeResponse
    const dcrPerKB = fee[confirmationTarget]
    const atomsPerByte = (dcrPerKB * 1e8) / 1000
    return atomsPerByte
  }

  private async fetchUTXOs(address: string): Promise<UTXO[]> {
    const res = await fetch(`${this.providerUrl}/addr/${address}/utxo`)
    return (await res.json()) as UTXO[]
  }

  // Estimate the size of a Decred transaction in bytes.
  // These values are approximate but accurate enough for fee calculation.
  private estimateDcrTxSize(inputCount: number, outputCount: number): number {
    const headerSize = 12        // version, locktime, expiry
    const inputSize = 180        // typical DCR input size
    const outputSize = 34        // P2PKH output

    return headerSize + (inputCount * inputSize) + (outputCount * outputSize)
  }

  /**
 * Decred coin selection algorithm.
 */
  private selectDcrUtxos(
    utxos: UTXO[],
    targets: DCROutput[],
    feeRateAtomsPerByte: number
  ): DcrCoinSelectRes | null {

    // Total value needed (without fee)
    const targetValue = targets.reduce((a, t) => a + t.value, 0)

    // Sort UTXO small → large
    const sorted = [...utxos].sort((a, b) => a.satoshis - b.satoshis)

    let selected: UTXO[] = []
    let totalSelectedValue = 0

    for (const utxo of sorted) {
      selected.push(utxo)
      totalSelectedValue += utxo.satoshis

      // Assuming one change output
      const estimatedTxSize = this.estimateDcrTxSize(
        selected.length,
        targets.length + 1 // change output
      )

      const fee = Math.ceil(estimatedTxSize * feeRateAtomsPerByte)

      // Check if inputs cover outputs + fee
      if (totalSelectedValue >= targetValue + fee) {
        const change = totalSelectedValue - targetValue - fee

        const outputs: DCROutput[] = [...targets]

        if (change > 0) {
          outputs.push({
            value: change,
          })
        }

        return {
          inputs: selected,
          outputs,
        }
      }
    }

    // Not enough funds
    return null
  }

  async selectUTXOs(
    from: string,
    targets: DCROutput[],
    confirmationTarget = 6
  ): Promise<{ inputs: DCRInput[]; outputs: DCROutput[] }> {
    const utxos = await this.fetchUTXOs(from)
    const feeRate = await this.fetchFeeRate(confirmationTarget)

    const ret = this.selectDcrUtxos(utxos, targets, feeRate)
    if (ret == null) {
      throw new Error('Not enough funds to create the transaction')
    }
    if (!ret.inputs || !ret.outputs) {
      throw new Error('Insufficient funds or coinselect failure')
    }
    // Convert UTXOs -> DCRInput[]
    const inputs: DCRInput[] = ret.inputs.map((u: any) => ({
      txid: u.txid,
      vout: u.vout,
      value: u.satoshis,
      scriptPubKey: Buffer.from(u.scriptPubKey, 'hex'),
    }))
    return {
      inputs,
      outputs: ret.outputs,
    }
  }

  async broadcastTransaction(transactionHex: string): Promise<string> {
    const res = await fetch(`${this.providerUrl}/tx/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rawtx: transactionHex,
      }),
    })


    if (!res.ok) {
      throw new Error(`Failed to broadcast: ${await res.text()}`)
    }

    const data = await res.json()
    return data.txid
  }

  async getBalance(address: string): Promise<number> {
    const res = await fetch(`${this.providerUrl}/addr/${address}/balance`)

    if (!res.ok) {
      throw new Error(`Failed to fetch balance: ${await res.text()}`)
    }

    // API return atoms (integer)
    const balance = await res.json()

    // ensure return number
    return typeof balance === 'number' ? balance : Number(balance)
  }

  async getTransaction(txid: string): Promise<DCRTransaction> {
    const res = await fetch(`${this.providerUrl}/tx/${txid}`)
    return (await res.json()) as DCRTransaction
  }
}

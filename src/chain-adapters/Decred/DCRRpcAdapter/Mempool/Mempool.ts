// @ts-expect-error coinselect has no types
import coinselect from 'coinselect'

import { DCRRpcAdapter } from '@chain-adapters/Decred/DCRRpcAdapter/DCRRpcAdapter'
import type { DCRInput, DCROutput, DCRTransaction } from '@chain-adapters/Decred/types'

// ----------------------------------
// Internal types
// ----------------------------------

interface UTXO {
  txid: string
  vout: number
  value: number
  status: {
    confirmed: boolean
  }
}

interface FeeResponse {
  fastestFee: number
  halfHourFee: number
  hourFee: number
  economyFee: number
}

export class Mempool extends DCRRpcAdapter {
  constructor(private readonly providerUrl: string) {
    super()
  }

  private async fetchFeeRate(confirmationTarget = 6): Promise<number> {
    const res = await fetch(`${this.providerUrl}/v1/fees/recommended`)
    const fee = (await res.json()) as FeeResponse

    if (confirmationTarget <= 1) return fee.fastestFee
    if (confirmationTarget <= 3) return fee.halfHourFee
    if (confirmationTarget <= 6) return fee.hourFee
    return fee.economyFee
  }

  private async fetchUTXOs(address: string): Promise<UTXO[]> {
    const res = await fetch(`${this.providerUrl}/address/${address}/utxo`)
    return (await res.json()) as UTXO[]
  }

  async selectUTXOs(
    from: string,
    targets: DCROutput[],
    confirmationTarget = 6
  ): Promise<{ inputs: DCRInput[]; outputs: DCROutput[] }> {
    const utxos = await this.fetchUTXOs(from)
    const feeRate = await this.fetchFeeRate(confirmationTarget)

    const ret = coinselect(utxos, targets, Math.ceil(feeRate + 1))

    if (!ret.inputs || !ret.outputs) {
      throw new Error('Insufficient funds or coinselect failure')
    }

    // Convert UTXOs -> DCRInput[]
    const inputs: DCRInput[] = ret.inputs.map((u: any) => ({
      txid: u.txid,
      vout: u.vout,
      value: u.value,
      scriptPubKey: Buffer.from('', 'hex'), // filled later by build step
    }))

    return {
      inputs,
      outputs: ret.outputs,
    }
  }

  async broadcastTransaction(transactionHex: string): Promise<string> {
    const res = await fetch(`${this.providerUrl}/tx`, {
      method: 'POST',
      body: transactionHex,
    })

    if (!res.ok) {
      throw new Error(`Failed to broadcast: ${await res.text()}`)
    }

    return await res.text()
  }

  async getBalance(address: string): Promise<number> {
    const res = await fetch(`${this.providerUrl}/address/${address}`)
    const data = await res.json()

    return data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
  }

  async getTransaction(txid: string): Promise<DCRTransaction> {
    const res = await fetch(`${this.providerUrl}/tx/${txid}`)
    return (await res.json()) as DCRTransaction
  }
}

import type * as bitcoin from 'bitcoinjs-lib'

export interface DCRTransaction {
  vout: Array<{
    scriptpubkey: string
    value: number
  }>
}

export interface DCRInput {
  txid: string
  vout: number
  value: number
  scriptPubKey: Buffer
}

export type DCROutput =
  | {
      value: number
    }
  | { address: string; value: number }
  | { script: Buffer; value: number }

export type DCRTransactionRequest = {
  publicKey: string
} & (
  | {
      inputs: DCRInput[]
      outputs: DCROutput[]
      from?: never
      to?: never
      value?: never
    }
  | {
      inputs?: never
      outputs?: never
      from: string
      to: string
      value: string
    }
)

export interface DCRUnsignedTransaction {
  psbt: bitcoin.Psbt
  publicKey: string
}

export type DCRNetworkIds = 'mainnet' | 'testnet' | 'regtest'

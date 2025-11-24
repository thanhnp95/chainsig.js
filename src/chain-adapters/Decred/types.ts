export interface DCRTransaction {
  txid: string
  vout: Array<{
    value: number
    scriptPubKey: {
      hex: string
      asm: string
      addresses?: string[]
      type: string
    }
  }>
  blockhash: string | null
  blockheight: number | null
  confirmations: number
  time: number
  valueIn: number
  valueOut: number
  size: number
}

export interface DCRInput {
  txid: string
  vout: number
  value: number
  scriptPubKey: Buffer // original UTXO scriptPubKey (hex -> Buffer)
}

export type DCROutput =
  | { address: string; value: number }
  // coinselect-style change output
  | { value: number }
  // raw script output
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
      value: string // DCR amount as string, e.g. "1.23"
    }
)

export interface DCRUnsignedTransaction {
  // Raw unsigned Decred transaction hex
  unsignedTxHex: string
  publicKey: string
}

export type DCRNetworkIds = 'mainnet' | 'testnet' | 'regtest'
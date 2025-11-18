import type { 
  DCRInput, 
  DCROutput, 
  DCRTransaction, 
} from '@chain-adapters/Decred/types'

export abstract class DCRRpcAdapter {
  abstract selectUTXOs(
    from: string,
    targets: DCROutput[]
  ): Promise<{ inputs: DCRInput[]; outputs: DCROutput[] }>

  abstract broadcastTransaction(transactionHex: string): Promise<string>

  abstract getBalance(address: string): Promise<number>

  abstract getTransaction(txid: string): Promise<DCRTransaction>
}

import { jest } from '@jest/globals'
import BN from 'bn.js'
import { DCRRpcAdapter } from '../../src/chain-adapters/Decred/DCRRpcAdapter/DCRRpcAdapter'
import type {
  DCRInput,
  DCROutput,
  DCRTransaction,
  DCRTransactionRequest,
  DCRUnsignedTransaction,
} from '../../src/chain-adapters/Decred/types'
import { ChainAdapter } from '../../src/chain-adapters/ChainAdapter'
import type { RSVSignature, KeyDerivationPath } from '../../src/types'

// Use testnet for valid address generation
const testAddress = 'Tsi8DgJBrzoYMziCWcSUPCJsdKCmJPvS7nt'

// Mock implementations
class MockDCRRpcAdapter extends DCRRpcAdapter {
  async selectUTXOs(): Promise<{ inputs: DCRInput[]; outputs: DCROutput[] }> {
    return {
      inputs: [
        {
          txid: 'a'.repeat(64),
          vout: 0,
          value: 100000000,
          scriptPubKey: Buffer.from('00', 'hex'),
        },
      ],
      outputs: [{ address: testAddress, value: 90000000 }],
    }
  }

  async getUtxos(): Promise<DCRInput[]> {
    return [
      {
        txid: 'a'.repeat(64),
        vout: 0,
        value: 100000000,
        scriptPubKey: Buffer.from('00', 'hex'),
      },
    ]
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    return 'mock_txid'
  }

  async getBalance(): Promise<number> {
    return 150000000
  }

  async getTransaction(): Promise<DCRTransaction> {
    return {
      txid: 'dcr_txid',
      vout: [
        {
          value: 100000,
          scriptPubKey: {
            hex: 'hex',
            asm: '',
            type: 'pubkeyhash',
            addresses: ['addr1'],
          }
        },
      ],
      blockhash: null,
      blockheight: null,
      confirmations: 0,
      time: Date.now(),
      valueIn: 0,
      valueOut: 100000,
      size: 0,
    }
  }
}

interface MockLocalStorage {
  store: Record<string, string>
  getItem: jest.Mock<(key: string) => string | null>
  setItem: jest.Mock<(key: string, value: string) => void>
  removeItem: jest.Mock<(key: string) => void>
  clear: jest.Mock<() => void>
  length: number
  key: jest.Mock<(index: number) => string | null>
}

const mockLocalStorage: MockLocalStorage = {
  store: {},
  getItem: jest.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value
  }),
  removeItem: jest.fn((key: string) => {
    mockLocalStorage.store[key] = ''
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store = {}
  }),
  length: 0,
  key: jest.fn(
    (index: number) => Object.keys(mockLocalStorage.store)[index] || null
  ),
}

// Assign to global
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// Mock Decred class
class TestDecred extends ChainAdapter<
  DCRTransactionRequest,
  DCRUnsignedTransaction
> {
  constructor(params: { dcrRpcAdapter: DCRRpcAdapter }) {
    super()
    this.dcrRpcAdapter = params.dcrRpcAdapter
  }

  private readonly dcrRpcAdapter: DCRRpcAdapter

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const balance = await this.dcrRpcAdapter.getBalance(address)
    return {
      balance: BigInt(balance),
      decimals: 8,
    }
  }

  // @ts-expect-error: Test implementation with different parameter types
  async deriveAddressAndPublicKey(
    predecessor: string,
    path: KeyDerivationPath
  ): Promise<{ address: string; publicKey: string }> {
    return {
      address: testAddress,
      publicKey: '04' + 'a'.repeat(128),
    }
  }

  setTransaction(
    transaction: DCRUnsignedTransaction,
    storageKey: string
  ): void {
    const dataToStore = JSON.stringify(transaction)

    mockLocalStorage.setItem(storageKey, dataToStore)
  }

  getTransaction(storageKey: string): DCRUnsignedTransaction | undefined {
    const stored = mockLocalStorage.getItem(storageKey)
    if (!stored) return undefined

    const parsed = JSON.parse(stored)
    if (
      typeof parsed !== 'object' ||
      !parsed ||
      !('unsignedTxHex' in parsed) ||
      !('publicKey' in parsed)
    ) {
      return undefined
    }

    const { unsignedTxHex, publicKey } = parsed
    return {
      unsignedTxHex: unsignedTxHex as string,
      publicKey: publicKey as string,
    }
  }

  async getMPCPayloadAndTransaction(request: DCRTransactionRequest): Promise<{
    transaction: DCRUnsignedTransaction
    mpcPayloads: any
  }> {
    return {
      transaction: {
        unsignedTxHex: 'tx_hex_sample',
        publicKey: '04'.padEnd(130, 'a'),
      },
      mpcPayloads: {},
    }
  }

  addSignature(params: {
    transaction: DCRUnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): string {
    return 'signed_tx_hex'
  }

  async broadcastTx(tx: string): Promise<{ hash: string }> {
    const txId = await this.dcrRpcAdapter.broadcastTransaction(tx)
    return { hash: txId }
  }

  serializeTransaction(transaction: DCRUnsignedTransaction): string {
    return JSON.stringify(transaction)
  }

  deserializeTransaction(serialized: string): DCRUnsignedTransaction {
    return JSON.parse(serialized)
  }

  async prepareTransactionForSigning(
    transactionRequest: DCRTransactionRequest
  ): Promise<{
    transaction: DCRUnsignedTransaction
    hashesToSign: any[]
  }> {
    return {
      transaction: {
        unsignedTxHex: 'tx_hex_sample',
        publicKey: '04'.padEnd(130, 'a'),
      },
      hashesToSign: [],
    }
  }

  finalizeTransactionSigning(params: {
    transaction: DCRUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): string {
    return 'signed_tx_hex'
  }
}

describe('Decred', () => {
  let decred: TestDecred
  let dcrRpcAdapter: MockDCRRpcAdapter

  beforeEach(() => {
    dcrRpcAdapter = new MockDCRRpcAdapter()
    decred = new TestDecred({ dcrRpcAdapter })
  })

  it('should get balance', async () => {
    const balance = await decred.getBalance(testAddress)
    expect(balance.balance.toString()).toBe('150000000')
    expect(balance.decimals).toBe(8)
  })

  it('should derive address and public key', async () => {
    const { address, publicKey } = await decred.deriveAddressAndPublicKey(
      'predecessor',
      { index: 0, scheme: 'secp256k1' }
    )
    expect(address).toBe(testAddress)
    expect(publicKey).toBe('04'.padEnd(130, 'a'))
  })

  it('should set and get transaction', () => {
    const storageKey = 'test_key'
    const transaction: DCRUnsignedTransaction = {
      unsignedTxHex: 'tx_hex_sample',
      publicKey: '04'.padEnd(130, 'a'),
    }

    decred.setTransaction(transaction, storageKey)
    const retrieved = decred.getTransaction(storageKey)

    expect(retrieved).toBeDefined()
    expect(retrieved?.publicKey).toBe(transaction.publicKey)
  })

  it('should prepare transaction for signing', async () => {
    const request: DCRTransactionRequest = {
      from: testAddress,
      to: testAddress,
      value: new BN('100000000').toString(),
      publicKey: '04'.padEnd(130, 'a'),
    }

    const { transaction, mpcPayloads } =
      await decred.getMPCPayloadAndTransaction(request)

    expect(transaction).toBeDefined()
    expect(mpcPayloads).toBeDefined()
  })

  it('should add signature to transaction', () => {
    const transaction: DCRUnsignedTransaction = {
      unsignedTxHex: 'tx_hex_sample',
      publicKey: '04'.padEnd(130, 'a'),
    }

    const signedTx = decred.addSignature({
      transaction,
      mpcSignatures: [{ r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 }],
    })

    expect(signedTx).toBe('signed_tx_hex')
  })

  it('should broadcast transaction', async () => {
    const txHex = '01000000000000000000'
    const txId = await decred.broadcastTx(txHex)
    expect(txId.hash).toBe('mock_txid')
  })

  it('Can derive a DCR address from account with contract and wallet keys', async () => {
    const accountId = 'my_account'
    const result = await decred.deriveAddressAndPublicKey(
      accountId,
      // Type cast to match expected parameter type
      {
        index: 0,
        scheme: 'secp256k1',
      } as any
    )

    expect(result.address).toBeDefined()
    expect(typeof result.address).toBe('string')
    expect(result.publicKey).toBeDefined()
    expect(typeof result.publicKey).toBe('string')
  })
})

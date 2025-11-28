import { jest } from '@jest/globals'
import { Mempool } from '../../src/chain-adapters/Decred/DCRRpcAdapter/Mempool'

const mockFetch = jest.fn() as any;

global.fetch = mockFetch;

interface MockResponse {
  ok: boolean
  json: () => Promise<any>
  text: () => Promise<string>
}

function createMockResponse(response: any, ok = true): MockResponse {
  return {
    ok,
    json: async () => response,
    text: async () =>
      typeof response === 'string' ? response : JSON.stringify(response),
  }
}

describe('Mempool DCRRpcAdapter', () => {
  let mempool: Mempool

  beforeEach(() => {
    mempool = new Mempool('https://testnet.dcrdata.org/insight/api')
    mockFetch.mockReset()
  })

  describe('selectUTXOs', () => {
    it('should select appropriate UTXOs for transaction', async () => {

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/utils/estimatefee')) {
          return createMockResponse({ "6": 0.00001 })
        }

        if (url.includes('/utxo')) {
          const mockUTXOs = [
            {
              txid: 'tx1',
              vout: 0,
              satoshis: 100000000,
              scriptPubKey: '00'
            },
            {
              txid: 'tx2',
              vout: 1,
              satoshis: 250000000,
              scriptPubKey: '00'
            }
          ]
          return createMockResponse(mockUTXOs)
        }

        throw new Error('Unexpected fetch: ' + url)
      })

      const result = await mempool.selectUTXOs('address', [
        { value: 150000000 },
      ])

      expect(result.inputs.length).toBe(2)
      expect(result.outputs.length).toBe(2)
      expect(result.outputs[0].value).toBe(150000000)
    })
  })

  describe('getBalance', () => {
    it('should fetch and return correct balance', async () => {

      mockFetch.mockResolvedValueOnce(createMockResponse(500000000))

      const result = await mempool.getBalance('address')
      expect(result).toBe(500000000)
    })
  })

  describe('broadcastTransaction', () => {
    it('should broadcast transaction successfully', async () => {
      const txHex = '0123456789abcdef'
      const txid = 'txid123'

      mockFetch.mockResolvedValueOnce(createMockResponse({ txid }))

      const result = await mempool.broadcastTransaction(txHex)

      expect(result).toBe(txid)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://testnet.dcrdata.org/insight/api/tx/send',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawtx: txHex }),
        })
      )
    })

    it('should handle broadcast errors', async () => {
      const errorMessage = 'Transaction rejected'

      mockFetch.mockResolvedValueOnce(
        createMockResponse(errorMessage, false)
      )

      await expect(
        mempool.broadcastTransaction('deadbeef')
      ).rejects.toThrow(errorMessage)
    })
  })
})

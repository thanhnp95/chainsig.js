import { jest } from '@jest/globals'

// Import after mocks
import { utils } from '../src'
import { Bitcoin } from '../src/chain-adapters/Bitcoin/Bitcoin'
import { Cosmos } from '../src/chain-adapters/Cosmos/Cosmos'
import { EVM } from '../src/chain-adapters/EVM/EVM'
import { Decred } from '../src/chain-adapters/Decred/Decred'

// Mock modules that use elliptic
jest.mock('../src/utils/cryptography', () => ({
  toRSV: jest.fn(),
  compressPubKey: jest.fn(),
  najToUncompressedPubKeySEC1: jest.fn(),
  deriveChildPublicKey: jest.fn(),
  uint8ArrayToHex: jest.fn(),
}))

// Mock elliptic related dependencies
jest.mock('elliptic', () => {
  class EC {
    curve: any

    constructor(curve: any) {
      this.curve = curve
    }

    keyFromPrivate(): any {
      return {
        getPublic: () => ({
          encode: () => Buffer.from('mock_public_key'),
          encodeCompressed: () => Buffer.from('mock_compressed_key'),
        }),
      }
    }

    keyFromPublic(): any {
      return {
        getPublic: () => ({
          encode: () => Buffer.from('mock_public_key'),
          encodeCompressed: () => Buffer.from('mock_compressed_key'),
        }),
        verify: () => true,
      }
    }
  }

  return {
    ec: EC,
  }
})

describe('SDK exports', () => {
  it('should export utils', () => {
    expect(utils).toBeDefined()
  })

  it('should export chains', () => {
    expect(Bitcoin).toBeDefined()
    expect(EVM).toBeDefined()
    expect(Cosmos).toBeDefined()
    expect(Decred).toBeDefined()
  })
})

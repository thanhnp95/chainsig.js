import { defineConfig, type Config } from 'vocs'

export default defineConfig({
  title: 'ChainSig.js',
  description:
    'Manage and use cryptographic key(s) across multiple chains or multiple contexts, with on-chain-enforced conditions',
  twoslash: {
    compilerOptions: {
      strict: true,
      paths: {
        'chainsig.js': ['./src'],
        '@chain-adapters': ['./src/chain-adapters/index.ts'],
        '@contracts': ['./src/contracts/index.ts'],
        '@utils': ['./src/utils/index.ts'],
        '@constants': ['./src/constants.ts'],
        '@types': ['./src/types.ts'],
        '@chain-adapters/*': ['./src/chain-adapters/*'],
        '@contracts/*': ['./src/contracts/*'],
        '@utils/*': ['./src/utils/*'],
      },
    },
  },
  sidebar: [
    {
      text: 'Introduction',
      items: [
        { text: 'Introduction to Chain Signatures', link: '/' },
        {
          text: 'Chainsig.js Quickstart',
        },
      ],
    },
    {
      text: 'Primitives',
      items: [
        { text: 'Contract Addresses', link: '/primitives/contract-addresses' },
        {
          text: 'Chain Adapter Interface',
          link: '/primitives/chain-adapter-interface',
        },
        {
          text: 'Chain Contract Interfaces',
          link: '/primitives/chain-contract-interface',
        },
      ],
    },
    {
      text: 'Examples',
      items: [
        { text: 'Signing an arbitrary hash', link: '/examples/arbitrary-hash' },
        {
          text: 'Use Ethereum chain signatures to securely sponsor gas fees for calling your Base smart contract',
          link: '/examples/sponsor-foreign-chain-gas',
        },
      ],
    },
    {
      text: 'API Reference',
      items: [
        {
          text: 'Chain Adapters',
          items: [
            {
              text: 'EVM Chains',
              items: [
                { text: 'Overview', link: '/chainsigjs/chain-adapters/evm' },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/chainsigjs/chain-adapters/evm/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/chainsigjs/chain-adapters/evm/finalize-transaction-signing',
                },
                {
                  text: 'prepareMessageForSigning',
                  link: '/chainsigjs/chain-adapters/evm/prepare-message-for-signing',
                },
                {
                  text: 'finalizeMessageSigning',
                  link: '/chainsigjs/chain-adapters/evm/finalize-message-signing',
                },
                {
                  text: 'prepareTypedDataForSigning',
                  link: '/chainsigjs/chain-adapters/evm/prepare-typed-data-for-signing',
                },
                {
                  text: 'finalizeTypedDataSigning',
                  link: '/chainsigjs/chain-adapters/evm/finalize-typed-data-signing',
                },
              ],
            },
            {
              text: 'Bitcoin',
              items: [
                {
                  text: 'Overview',
                  link: '/chainsigjs/chain-adapters/bitcoin',
                },
                {
                  text: 'RPC Adapter',
                  link: '/chainsigjs/chain-adapters/bitcoin/btc-rpc-adapter',
                },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/chainsigjs/chain-adapters/bitcoin/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/chainsigjs/chain-adapters/bitcoin/finalize-transaction-signing',
                },
              ],
            },
            {
              text: 'Cosmos Chains',
              items: [
                { text: 'Overview', link: '/chainsigjs/chain-adapters/cosmos' },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/chainsigjs/chain-adapters/cosmos/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/chainsigjs/chain-adapters/cosmos/finalize-transaction-signing',
                },
              ],
            },
            {
              text: 'deriveAddressAndPublicKey',
              link: '/chainsigjs/chain-adapters/derive-address-and-public-key',
            },
            {
              text: 'getBalance',
              link: '/chainsigjs/chain-adapters/get-balance',
            },
            {
              text: 'broadcastTx',
              link: '/chainsigjs/chain-adapters/broadcast-tx',
            },
          ],
        },
        {
          text: 'Contracts',
          items: [
            {
              text: 'EVM',
              items: [
                {
                  text: 'constructor',
                  link: '/chainsigjs/contracts/evm/constructor',
                },
                {
                  text: 'getCurrentSignatureDeposit',
                  link: '/chainsigjs/contracts/evm/get-current-signature-deposit',
                },
                {
                  text: 'getDerivedPublicKey',
                  link: '/chainsigjs/contracts/evm/get-derived-public-key',
                },
                {
                  text: 'getPublicKey',
                  link: '/chainsigjs/contracts/evm/get-public-key',
                },
                {
                  text: 'getLatestKeyVersion',
                  link: '/chainsigjs/contracts/evm/get-latest-key-version',
                },
                { text: 'sign', link: '/chainsigjs/contracts/evm/sign' },
              ],
            },
            {
              text: 'NEAR',
              items: [
                {
                  text: 'constructor',
                  link: '/chainsigjs/contracts/near/constructor',
                },
                {
                  text: 'getCurrentSignatureDeposit',
                  link: '/chainsigjs/contracts/near/get-current-signature-deposit',
                },
                {
                  text: 'getDerivedPublicKey',
                  link: '/chainsigjs/contracts/near/get-derived-public-key',
                },
                {
                  text: 'getPublicKey',
                  link: '/chainsigjs/contracts/near/get-public-key',
                },
                {
                  text: 'sign',
                  link: '/chainsigjs/contracts/near/sign',
                },
              ],
            },
            {
              text: 'Decred',
              items: [
                {
                  text: 'Overview',
                  link: '/chainsigjs/chain-adapters/decred',
                },
                {
                  text: 'RPC Adapter',
                  link: '/chainsigjs/chain-adapters/decred/dcr-rpc-adapter',
                },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/chainsigjs/chain-adapters/decred/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/chainsigjs/chain-adapters/decred/finalize-transaction-signing',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/sig-net',
    },
  ],
  theme: {
    accentColor: {
      light: '#00C08B',
      dark: '#00E6A6',
    },
  },
}) as Config

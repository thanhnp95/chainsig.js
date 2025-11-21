import { Account } from '@near-js/accounts'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { contracts, chainAdapters } from '../src'
import { config } from 'dotenv'

config() // Load environment variables

async function main(): Promise<void> {
  const accountId = process.env.ACCOUNT_ID // 'your-account.testnet'
  const privateKey = process.env.PRIVATE_KEY as KeyPairString // ed25519:3D4YudUahN...

  if (!accountId) throw new Error('Setup environmental variables')

  const keyPair = KeyPair.fromString(privateKey)
  const signer = new KeyPairSigner(keyPair)

  const provider = new JsonRpcProvider({
    url: 'https://test.rpc.fastnear.com',
  })

  const account = new Account(accountId, provider, signer)

  const contract = new contracts.ChainSignatureContract({
    networkId: 'testnet',
    contractId:
      process.env.NEXT_PUBLIC_NEAR_CHAIN_SIGNATURE_CONTRACT ||
      'v1.signer-prod.testnet',
  })

  const derivationPath = "m/44'/42'/0'/0/0"

  const dcrRpcAdapter = new chainAdapters.dcr.DCRRpcAdapters.Mempool(
    // TODO: add adapter api here
    'decred mempool api'
  )

  const dcrChain = new chainAdapters.dcr.Decred({
    network: 'testnet',
    contract,
    dcrRpcAdapter,
  })

  // Derive address and public key
  const { address, publicKey } = await dcrChain.deriveAddressAndPublicKey(
    accountId,
    derivationPath
  )

  console.log('address', address)

  // Check balance
  const { balance, decimals } = await dcrChain.getBalance(address)

  console.log('balance', balance)

  // Create and sign transaction
  const { transaction, hashesToSign } =
    await dcrChain.prepareTransactionForSigning({
      publicKey,
      from: address,
      to: 'TsoyZxpn16KJPXxhrgxsoL1yzQtp4wReq1T',
      value: BigInt(100_000).toString(),
    })

  // Sign with MPC
  const signature = await contract.sign({
    payloads: hashesToSign,
    path: derivationPath,
    keyType: 'Ecdsa',
    signerAccount: account,
  })

  // Add signature
  const signedTx = dcrChain.finalizeTransactionSigning({
    transaction,
    rsvSignatures: signature,
  })

  // Broadcast transaction
  const { hash: txHash } = await dcrChain.broadcastTx(signedTx)

  // TODO: Print link to transaction on BTC Explorer
}

main().catch(console.error)

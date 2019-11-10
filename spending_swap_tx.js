const bitcoin = require('bitcoinjs-lib')
const { alice, bob } = require('./wallets.json')
const network = bitcoin.networks.regtest
const hashType = bitcoin.Transaction.SIGHASH_ALL
const bip65 = require('bip65')

const IS_CLAIM = (process.argv[2].toLowerCase() === 'claim')
const IS_ONCHAIN_TO_OFFCHAIN = (process.argv[3].toLowerCase() === 'on2off')
const TX_ID = process.argv[4].toLowerCase()
const TX_VOUT =  Number(process.argv[5])
const WITNESS_SCRIPT = process.argv[6].toLowerCase()
const TIMELOCK = Number(process.argv[7])
const PREIMAGE = Buffer.from(process.argv[8].toLowerCase(), 'hex')

const argMessage = 'Arguments must be: [claim/refund] [on2off/off2on] TX_ID TX_VOUT WITNESS_SCRIPT TIMELOCK [PREIMAGE] \n\nThis script will generate a transaction which spends from a lighting submarine swap.'

if (IS_CLAIM === undefined || process.argv[2].toLowerCase() !== 'refund' && process.argv[2].toLowerCase() !== 'claim') {
  console.log('You must specify whether this is a refund or a claim')
  console.log(argMessage)
  return
}

if (IS_CLAIM && process.argv.length !== 9) {
  console.log(`Incorrect number of arguments. Supplied: ${process.argv.length - 2}, required: 6`)
  console.log(argMessage)
  return
} else if (!IS_CLAIM && process.argv.length !== 8) {
  console.log(`Incorrect number of arguments. Supplied: ${process.argv.length - 2}, required: 5`)
  console.log(argMessage)
  return
}

if (IS_ONCHAIN_TO_OFFCHAIN === undefined || process.argv[3].toLowerCase() !== 'on2off' && process.argv[3].toLowerCase() !== 'off2on') {
  console.log('You must specify whether this is an on-chain to off-chain or off-chain to on-chain swap')
  console.log(argMessage)
  return
}

// Signers
const keyPairSwapProvider = bitcoin.ECPair.fromWIF(alice[1].wif, network)
const keyPairUser = bitcoin.ECPair.fromWIF(bob[1].wif, network)

// Recipient
const p2wpkhSwapProvider = bitcoin.payments.p2wpkh({pubkey: keyPairSwapProvider.publicKey, network})

// Build spending from swap transaction
const txb = new bitcoin.TransactionBuilder(network)

const timelock = bip65.encode({ blocks: TIMELOCK })
console.log('Block height timelock  ', timelock)
txb.setLockTime(timelock)

// txb.addInput(prevTx, vout, sequence, prevTxScript)
txb.addInput(TX_ID, TX_VOUT, 0xfffffffe)

// 0.00001 BTC  -- 1000 sats
txb.addOutput(p2wpkhSwapProvider.address, 1e3)
console.log('Swap provider redeem address: ', p2wpkhSwapProvider.address)

// 1200 - 1000 = 200 satoshis goes in mining fees

const tx = txb.buildIncomplete()

// hashForWitnessV0(inIndex, prevOutScript, value, hashType)
// Funding transaction amount: 0.000012 -- 1200 sats
const witnessScript = Buffer.from(WITNESS_SCRIPT, 'hex')
const signatureHash = tx.hashForWitnessV0(0, witnessScript, 12e2, hashType)
console.log('Signature hash: ', signatureHash.toString('hex'))

if (IS_CLAIM) {
  let input

  if (IS_ONCHAIN_TO_OFFCHAIN) {
    // The swap provider signs and claims his money
    input = bitcoin.script.compile([
      bitcoin.script.signature.encode(keyPairSwapProvider.sign(signatureHash), hashType),
      PREIMAGE
    ])
  } else {
    // The user signs and claims his money
    input = bitcoin.script.compile([
      bitcoin.script.signature.encode(keyPairUser.sign(signatureHash), hashType),
      PREIMAGE
    ])
  }

  // Scenario 1
  // Happy case: Swap Provider is able to spend the P2WSH
  const witnessStackClaimBranch = bitcoin.payments.p2wsh({
    redeem: {
      input,
      output: witnessScript
    }
  }).witness

  console.log('First branch witness stack  ', witnessStackClaimBranch.map(x => x.toString('hex')))

  tx.setWitness(0, witnessStackClaimBranch)
  console.log('Claim transaction:')
} else {
  // Scenario 2
  // Failure case: User is able to get a refund after the timelock has expired
  const witnessStackRefundBranch = bitcoin.payments.p2wsh({
    redeem: {
      input: bitcoin.script.compile([
        bitcoin.script.signature.encode(keyPairUser.sign(signatureHash), hashType),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
      ]),
      output: witnessScript
    }
  }).witness

  console.log('Second branch witness stack  ', witnessStackRefundBranch.map(x => x.toString('hex')))

  tx.setWitness(0, witnessStackRefundBranch)
  console.log('Refund transaction:')
}

// Print
console.log(tx.toHex())
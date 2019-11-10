#!/usr/bin/env node

const bitcoin = require('bitcoinjs-lib')
const { alice, bob } = require('./wallets.json')
const network = bitcoin.networks.regtest
const hashType = bitcoin.Transaction.SIGHASH_ALL
const bip65 = require('bip65')
const argv = require('yargs')
    .usage('Usage: spending_swap_tx --forward [boolean] --claim [boolean] --txid [string] --vout [num] --witness [string] --locktime [num] --preimage [string]')
    .boolean('forward')
    .boolean('claim')
    .alias('t', 'txid')
    .alias('l', 'locktime')
    .alias('f', 'forward')
    .alias('c', 'claim')
    .alias('o', 'vout')
    .alias('w', 'witness')
    .alias('p', 'preimage')
    .demand(['forward', 'claim', 'txid', 'vout', 'witness'])
    .argv

const IS_CLAIM = argv.claim
const IS_ONCHAIN_TO_OFFCHAIN = argv.forward
const TX_ID = argv.txid
const TX_VOUT = argv.vout
const WITNESS_SCRIPT = Buffer.from(argv.witness, 'hex')
const TIMELOCK = argv.locktime
const PREIMAGE = argv.preimage ? Buffer.from(argv.preimage, 'hex') : null
let signatureHash = null

// if (IS_CLAIM && !(process.argv.length >= 7)) {
//   console.log(`Incorrect number of arguments. Supplied: ${process.argv.length - 2}, required at least 5`)
//   console.log(argMessage)
//   return
// } else if (!IS_CLAIM && process.argv.length !== 8) {
//   console.log(`Incorrect number of arguments. Supplied: ${process.argv.length - 2}, required: 5`)
//   console.log(argMessage)
//   return
// }

// Signers
const keyPairSwapProvider = bitcoin.ECPair.fromWIF(alice[1].wif, network)
const keyPairUser = bitcoin.ECPair.fromWIF(bob[1].wif, network)

// Recipient
const p2wpkhSwapProvider = bitcoin.payments.p2wpkh({pubkey: keyPairSwapProvider.publicKey, network})
const p2wpkhUser = bitcoin.payments.p2wpkh({pubkey: keyPairUser.publicKey, network})

// Build spending from swap transaction
const txb = new bitcoin.TransactionBuilder(network)

const timelock = bip65.encode({ blocks: TIMELOCK })
console.log('Block height timelock: ', timelock)
txb.setLockTime(timelock)

// txb.addInput(prevTx, vout, sequence, prevTxScript)
console.log(TX_ID)
txb.addInput(TX_ID, TX_VOUT, 0xfffffffe)

// 0.00001 BTC  -- 1000 sats
if (IS_ONCHAIN_TO_OFFCHAIN && IS_CLAIM) {
  txb.addOutput(p2wpkhSwapProvider.address, 1e3)
  console.log('Swap provider redeem address: ', p2wpkhSwapProvider.address)
} else if (IS_ONCHAIN_TO_OFFCHAIN && !IS_CLAIM) {
  txb.addOutput(p2wpkhUser.address, 1e3)
  console.log('Swap provider redeem address: ', p2wpkhUser.address)
} else if (!IS_ONCHAIN_TO_OFFCHAIN && IS_CLAIM) {
  txb.addOutput(p2wpkhUser.address, 1e3)
  console.log('Swap provider redeem address: ', p2wpkhUser.address)
} else if (!IS_ONCHAIN_TO_OFFCHAIN && !IS_CLAIM) {
  txb.addOutput(p2wpkhSwapProvider.address, 1e3)
  console.log('Swap provider redeem address: ', p2wpkhSwapProvider.address)
}

const tx = txb.buildIncomplete()

if (IS_ONCHAIN_TO_OFFCHAIN) {
  // Funding transaction amount: 0.000012 -- 1200 sats
  // 1200 - 1000 = 200 satoshis goes in mining fees
  signatureHash = tx.hashForWitnessV0(0, WITNESS_SCRIPT, 12e2, hashType)
} else {
  // Funding transaction amount: 0.00001 -- 1000 sats
  // 1000 - 800 = 200 satoshis goes in mining fees
  signatureHash = tx.hashForWitnessV0(0, WITNESS_SCRIPT, 1e3, hashType)
}
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
      output: WITNESS_SCRIPT
    }
  }).witness

  console.log('First branch witness stack  ', witnessStackClaimBranch.map(x => x.toString('hex')))

  tx.setWitness(0, witnessStackClaimBranch)
  console.log('Claim transaction:')
} else {
  let input
  if (IS_ONCHAIN_TO_OFFCHAIN) {
    input = bitcoin.script.compile([
      bitcoin.script.signature.encode(keyPairUser.sign(signatureHash), hashType),
      Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
    ])
  } else {
    input = bitcoin.script.compile([
      bitcoin.script.signature.encode(keyPairSwapProvider.sign(signatureHash), hashType),
      Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
    ])
  }

  // Scenario 2
  // Failure case: User is able to get a refund after the timelock has expired
  const witnessStackRefundBranch = bitcoin.payments.p2wsh({
    redeem: {
      input,
      output: WITNESS_SCRIPT
    }
  }).witness

  console.log('Second branch witness stack  ', witnessStackRefundBranch.map(x => x.toString('hex')))

  tx.setWitness(0, witnessStackRefundBranch)
  console.log('Refund transaction:')
}

// Print
console.log(tx.toHex())
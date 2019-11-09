const bitcoin = require('bitcoinjs-lib')
const { alice, bob } = require('./wallets.json')
const network = bitcoin.networks.regtest
const hashType = bitcoin.Transaction.SIGHASH_ALL
const bip65 = require('bip65')

/**
 * To Change
 *
 * TX_ID
 * TX_VOUT
 * preimage
 * witnessScript
 * timelock
 */

let IS_CLAIM = null
let TX_ID = null
let TX_VOUT = null
let PREIMAGE = null
let WITNESS_SCRIPT = null
let TIMELOCK = null

const argMessage = 'Arguments must be: [CLAIM/REFUND] TX_ID TX_VOUT WITNESS_SCRIPT TIMELOCK [PREIMAGE] \n\nThis script will generate a transaction which spends from a lighting atomic swap.';

if (process.argv[2] === undefined || process.argv[2].toLowerCase() !== 'refund' && process.argv[2].toLowerCase() !== 'claim') {
  console.log('You must specify whether this is a refund or a claim')
  console.log(argMessage)
  return
}

IS_CLAIM = process.argv[2].toLowerCase() === 'claim';

if (IS_CLAIM && process.argv.length !== 8) {
  console.log(`Incorrect number of arguments. Supplied: ${process.argv.length - 2}, required: 6`)
  console.log(argMessage)
  return
} else if (!IS_CLAIM && process.argv.length !== 7) {
  console.log(`Incorrect number of arguments. Supplied: ${process.argv.length - 2}, required: 5`)
  console.log(argMessage)
  return
}

process.argv.forEach((value, index) => {
  switch (index) {
    case 3:
      TX_ID = value
      break
    case 4:
      TX_VOUT = Number(value)
      break
    case 5:
      WITNESS_SCRIPT = value
      break
    case 6:
      TIMELOCK = Number(value)
      break
    case 7:
      PREIMAGE = value
      break
  }
})

// Signers
const keyPairSwapProvider = bitcoin.ECPair.fromWIF(alice[1].wif, network)
const keyPairUser = bitcoin.ECPair.fromWIF(bob[1].wif, network)

// Recipient
const p2wpkhSwapProvider = bitcoin.payments.p2wpkh({pubkey: keyPairSwapProvider.publicKey, network})

// Build spending transaction
const txb = new bitcoin.TransactionBuilder(network)

const timelock = bip65.encode({ blocks: TIMELOCK })
// console.log('timelock  ', timelock)
txb.setLockTime(timelock)

// txb.addInput(prevTx, vout, sequence, prevTxScript)
txb.addInput(TX_ID, TX_VOUT, 0xfffffffe)

// 0.000008 BTC  -- 800 sats
txb.addOutput(p2wpkhSwapProvider.address, 8e2)
console.log('Swap provider redeem address', p2wpkhSwapProvider.address)

const tx = txb.buildIncomplete()

// hashForWitnessV0(inIndex, prevOutScript, value, hashType)
// amount: 0.00001 -- 1000 sats
const witnessScript = Buffer.from(WITNESS_SCRIPT, 'hex')
const signatureHash = tx.hashForWitnessV0(0, witnessScript, 1e3, hashType)
console.log('signature hash: ', signatureHash.toString('hex'))

if (IS_CLAIM) {
  const preimage = Buffer.from(PREIMAGE, 'hex')

  // Scenario 1
  // Happy case: Swap Provider is able to spend the P2WSH
  const witnessStackClaimBranch = bitcoin.payments.p2wsh({
    redeem: {
      input: bitcoin.script.compile([
        bitcoin.script.signature.encode(keyPairSwapProvider.sign(signatureHash), hashType),
        preimage
      ]),
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

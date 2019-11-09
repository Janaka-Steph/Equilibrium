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

let TX_ID = null
let TX_VOUT = null
let PREIMAGE = null
let WITNESS_SCRIPT = null
let TIMELOCK = null

if (process.argv.length !== 7) {
  console.log('Incorrect number of arguments')
  console.log('Arguments must be: TX_ID  TX_VOUT  PREIMAGE  WITNESS_SCRIPT  TIMELOCK')
  return
}

process.argv.forEach((value, index) => {
  switch (index) {
    case 2:
      TX_ID = value
      break
    case 3:
      TX_VOUT = Number(value)
      break
    case 4:
      PREIMAGE = value
      break
    case 5:
      WITNESS_SCRIPT = value
      break
    case 6:
      TIMELOCK =  Number(value)
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
console.log('timelock  ', timelock)
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

const preimage = Buffer.from(PREIMAGE, 'hex')

// Scenario 1
// Happy case: Swap Provider is able to spend the P2WSH
const witnessStackFirstBranch = bitcoin.payments.p2wsh({
  redeem: {
    input: bitcoin.script.compile([
      bitcoin.script.signature.encode(keyPairSwapProvider.sign(signatureHash), hashType),
      preimage
    ]),
    output: witnessScript
  }
}).witness

console.log('First branch witness stack  ', witnessStackFirstBranch.map(x => x.toString('hex')))

// Scenario 2
// Failure case: User is able to get a refund after the timelock has expired
const witnessStackSecondBranch = bitcoin.payments.p2wsh({
  redeem: {
    input: bitcoin.script.compile([
      bitcoin.script.signature.encode(keyPairUser.sign(signatureHash), hashType),
      Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
    ]),
    output: witnessScript
  }
}).witness

console.log('Second branch witness stack  ', witnessStackSecondBranch.map(x => x.toString('hex')))

// Choose a scenario and set the witness stack
tx.setWitness(0, witnessStackFirstBranch)
//tx.setWitness(0, witnessStackSecondBranch)


// Print
console.log('tx.toHex  ', tx.toHex())
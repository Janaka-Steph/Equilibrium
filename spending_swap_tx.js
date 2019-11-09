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
 * timelock
 * witnessScript
 * preimage
 */

// Signers
const keyPairSwapProvider = bitcoin.ECPair.fromWIF(alice[1].wif, network)
const keyPairUser = bitcoin.ECPair.fromWIF(bob[1].wif, network)

// Recipient
const p2wpkhSwapProvider = bitcoin.payments.p2wpkh({pubkey: keyPairSwapProvider.publicKey, network})

// Build spending transaction
const txb = new bitcoin.TransactionBuilder(network)

const timelock = bip65.encode({ blocks: 105 })
console.log('timelock  ', timelock)
txb.setLockTime(timelock)

// txb.addInput(prevTx, vout, sequence, prevTxScript)
txb.addInput('TX_ID', TX_VOUT, 0xfffffffe)

// 0.099 BTC
txb.addOutput(p2wpkhSwapProvider.address, 99e5)

const tx = txb.buildIncomplete()

// hashForWitnessV0(inIndex, prevOutScript, value, hashType)
const witnessScript = Buffer.from('WITNESS_SCRIPT', 'hex')
const signatureHash = tx.hashForWitnessV0(0, witnessScript, 1e7, hashType)
console.log('signature hash: ', signatureHash.toString('hex'))

const preimage = Buffer.from('PREIMAGE', 'hex')

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
      bitcoin.script.signature.encode(keyPairSwapProvider.sign(signatureHash), hashType),
      bitcoin.script.signature.encode(keyPairUser.sign(signatureHash), hashType),
      bitcoin.opcodes.OP_FALSE
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
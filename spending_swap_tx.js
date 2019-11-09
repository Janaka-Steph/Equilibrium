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

const timelock = bip65.encode({ blocks: 950 })
console.log('timelock  ', timelock)
txb.setLockTime(timelock)

// txb.addInput(prevTx, vout, sequence, prevTxScript)
txb.addInput('f81841b8acabdef2a85392804c33a2206fe3cce302e3b91f1aa9652161df388f', 1, 0xfffffffe)

// 0.099 BTC
txb.addOutput(p2wpkhSwapProvider.address, 99e5)

const tx = txb.buildIncomplete()

// hashForWitnessV0(inIndex, prevOutScript, value, hashType)
const witnessScript = Buffer.from('a91420195b5a3d650c17f0f29f91c33f8f6335193d0787632103745c9aceb84dcdeddf2c3cdc1edb0b0b5af2f9bf85612d73fa6394758eaee35d6702b603b17521027efbabf425077cdbceb73f6681c7ebe2ade74a65ea57ebcf0c42364d3822c59068ac', 'hex')
const signatureHash = tx.hashForWitnessV0(0, witnessScript, 1e8, hashType)
console.log('signature hash: ', signatureHash.toString('hex'))

const preimage = Buffer.from('0000000000000000000000000000000000000000000000000000000000000008', 'hex')

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
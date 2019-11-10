#!/usr/bin/env node

const swapScript = require('./swap_script')
const bitcoin = require('bitcoinjs-lib')
const { alice, bob } = require('./wallets.json')
const network = bitcoin.networks.regtest
const bip65 = require('bip65')
const argv = require('yargs')
    .usage('Usage: swap_p2wsh --forward [boolean] --rhash [string] --timelock [num] -preimage')
    .boolean('forward')
    .alias('r', 'rhash')
    .alias('l', 'locktime')
    .alias('f', 'forward')
    .demand(['forward', 'rhash', 'timelock'])
    .argv

let IS_ONCHAIN_TO_OFFCHAIN = argv.forward
let PAYMENT_HASH = argv.rhash
let TIMELOCK = argv.locktime
let PREIMAGE = argv.preimage

// The LN invoice secret given in return for payment
//console.log('Preimage:')
//console.log(PREIMAGE.toString('hex'))
//const preimageSha256 = bitcoin.crypto.sha256(PREIMAGE)
//console.log('preimageSha256 ', preimageSha256.toString('hex'))

// The HASH160 on the blockchain
//const preimageHash160 = bitcoin.crypto.hash160(preimage)
//console.log('Preimage HASH160:')
//console.log(preimageHash160.toString('hex'))

// Payment hash extracted from the invoice
// Must match preimageSha256
console.log('Payment Hash:')
console.log(PAYMENT_HASH.toString('hex'))

// Signers
const keyPairSwapProvider = bitcoin.ECPair.fromWIF(alice[1].wif, network)
const keyPairUser = bitcoin.ECPair.fromWIF(bob[1].wif, network)

// Set CLTV block height
const timelock = bip65.encode({ blocks: TIMELOCK })
console.log('Block height timelock  ', timelock)

// Generate witness script
let witnessScript

if (IS_ONCHAIN_TO_OFFCHAIN) {
    witnessScript =  swapScript(keyPairSwapProvider, keyPairUser, PAYMENT_HASH, timelock)
} else {
    witnessScript =  swapScript(keyPairUser, keyPairSwapProvider, PAYMENT_HASH, timelock)
}
console.log('Witness script:')
console.log(witnessScript.toString('hex'))

// Get P2WSH address
const p2wsh = bitcoin.payments.p2wsh({redeem: {output: witnessScript, network}, network})
console.log('P2WSH swap smart contract address:')
console.log(p2wsh.address)
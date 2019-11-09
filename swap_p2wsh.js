const swapScript = require('./swap_script')
const bitcoin = require('bitcoinjs-lib')
const { alice, bob } = require('./wallets.json')
const network = bitcoin.networks.regtest
const bip65 = require('bip65')
/**
 * To Change
 *
 * preimage
 * paymentHash
 * timelock
 */

// The LN invoice secret
// Given in return for payment
//const preimage = Buffer.from('PREIMAGE', 'hex')
//console.log('preimage ', preimage.toString('hex'))
//const preimageSha256 = bitcoin.crypto.sha256(preimage)
//console.log('preimageSha256 ', preimageSha256.toString('hex'))

// Original payment hash extracted from the invoice
// Must match preimageSha256
const paymentHash = Buffer.from('PAYMENT_HASH', 'hex')
console.log('original paymentHash ', paymentHash.toString('hex'))

// The HASH160 on the blockchain
const preimageHash160 = bitcoin.crypto.hash160(preimage)
console.log('preimageHash160 ', preimageHash160.toString('hex'))

//
const keyPairSwapProvider = bitcoin.ECPair.fromWIF(alice[1].wif, network)
const keyPairUser = bitcoin.ECPair.fromWIF(bob[1].wif, network)

// Set CLTV block height
const timelock = bip65.encode({ blocks: 105 })
console.log('timelock  ', timelock)

// Generate witness script
const witnessScript = swapScript(keyPairSwapProvider, keyPairUser, paymentHash, timelock)
console.log('witnessScript  ', witnessScript.toString('hex'))

// Get P2WSH address
const p2wsh = bitcoin.payments.p2wsh({redeem: {output: witnessScript, network}, network})
console.log('P2WSH address  ', p2wsh.address)
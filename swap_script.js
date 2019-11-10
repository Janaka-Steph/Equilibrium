const bitcoin = require('bitcoinjs-lib')

const swapScript = function(claimPublicKey, refundPublicKey, preimageHash, cltv) {
  return bitcoin.script.compile([
    bitcoin.opcodes.OP_HASH160,
    bitcoin.crypto.ripemd160(preimageHash), // HASH160 of invoice payment hash
    bitcoin.opcodes.OP_EQUAL,
    bitcoin.opcodes.OP_IF,
    claimPublicKey.publicKey,
    bitcoin.opcodes.OP_ELSE,
    bitcoin.script.number.encode(cltv),
    bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
    bitcoin.opcodes.OP_DROP,
    refundPublicKey.publicKey,
    bitcoin.opcodes.OP_ENDIF,
    bitcoin.opcodes.OP_CHECKSIG,
  ])
}

module.exports = swapScript
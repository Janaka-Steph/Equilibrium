# Equilibrium

A bitcoin user (bob1) would like to receive funds on his off-chain Lightning wallet. 
In order to do that the user will generate a Lightning invoice and show it the to Swap Provider (alice1).
The Swap Provider will prompt the user to pay an on-chain address (the P2WSH swap smart contract).
Once the swap has been paid and confirmed, the Swap Provider is able to redeem the funds to his wallet and can pay the 
Lightning invoice of the user. 


## Requirements

- NodeJS >= 10.x
- JQ (JSON parser)
- Bitcoin Core >= 18.x

You need a work environment with Bitcoin Core on regtest and two LND nodes connected to it. 
One LND is the Swap Provider, the other is the Bitcoin user.
For simplicity we create a direct channel between them.

$ npm install  
$ npm run wallets
> It will generate a bunch of testing wallets and import the private keys in your running Bitcoin Core


## Swapping Process

### 1. User generates a LN invoice asking for 1000 satoshis  
$ lncli-user addinvoice 1000 [PREIMAGE]  
returns <payment_request>

### 2. User shows the invoice to the Swap Provider

### 3. Swap Provider extract the payment hash - sha256(preimage)
$ lncli-sp decodepayreq <payment_request>

### 4. Swap Provider generates the P2WSH address from the swap witness script
$ node swap_p2wsh.js PAYMENT_HASH  TIMELOCK  [PREIMAGE]

### 5. User sends 1200 satoshis to the P2WSH swap smart contract address
> He pays 200 satoshis more to compensate for the mining fees that the Swap Provider will have to pay to redeem the funds

$ sendtoaddress <p2wsh_addr> 0.000012

### 5. Swap Provider must pay the invoice in order to get the preimage that allows him to redeem the on-chain funds
$ lncli-sp payinvoice <payment_request>

### 6. Swap Provider redeem the funds locked in P2WSH swap smart contract
> bitcoin-cli _gettransaction_ or _getrawtransaction_ to get the output index (TX_VOUT)
   
$ node spending_swap_tx.js TX_ID  TX_VOUT  PREIMAGE  WITNESS_SCRIPT  TIMELOCK

$ sendrawtransaction <TX_HEX>
$ getrawtransaction <TX_ID>

### 7. Mine a block
$ bitcoin-cli getnewaddress
$ bitcoin-cli generatetoaddress 1 ADDR

### 8. Check that the Swap Provider received his money on-chain
> Swap Provider redeem address is alice1 p2wpkh address

$ bitcoin-cli scantxoutset start '["addr(bcrt1qlwyzpu67l7s9gwv4gzuv4psypkxa4fx4ggs05g)"]'

### 9. Check that the user received his money off-chain
$ lncli-user channelbalance
# Equilibrium

A bitcoin user (bob1) would like to receive funds on his off-chain Lightning wallet. 
In order to do that the user will generate a Lightning invoice and show it the to Swap Provider (alice1).
The Swap Provider will prompt the user to pay an on-chain address (the P2WSH swap smart contract).
Once the swap has been paid and confirmed, the Swap Provider is able to redeem the funds to his wallet and can pay the 
Lightning invoice of the user. 

To learn more about how submarine swaps works you can read this [nice article from Boltz exchange](https://medium.com/boltzhq/submarine-swaps-c509ce0fb1db).
For more info regarding the swap smart contract can be found in [Alex Bosworth's submarineswaps repository](https://github.com/submarineswaps/swaps-service/blob/master/docs/chain_swap_script.md#simple-case). 

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


## Swapping Process: On-Chain To Off-Chain

#### 1. User generates a LN invoice asking for 1000 satoshis 
``` 
$ lncli-user addinvoice 1000 [PREIMAGE]  
returns <payment_request>
```

#### 2. User shows the invoice to the Swap Provider

#### 3. Swap Provider extract the payment hash - sha256(preimage)
```
$ lncli-sp decodepayreq <payment_request>
```

#### 4. Swap Provider generates the P2WSH address from the swap witness script
```
$ node swap_p2wsh.js on2off PAYMENT_HASH  TIMELOCK  [PREIMAGE]
```

#### 5. User sends 1200 satoshis to the P2WSH swap smart contract address
> He pays 200 satoshis more to compensate for the mining fees that the Swap Provider will have to pay to redeem the funds
```
$ sendtoaddress <p2wsh_addr> 0.000012
```

#### 6. Swap Provider must pay the invoice in order to get the preimage that allows him to redeem the on-chain funds
```
$ lncli-sp payinvoice <payment_request>
```

#### 7. Happy case: swap provider redeems the funds locked in the P2WSH swap smart contract
> bitcoin-cli _gettransaction_ or _getrawtransaction_ to get the output index (TX_VOUT)
```
$ node spending_swap_tx.js claim on2off TX_ID TX_VOUT  WITNESS_SCRIPT  TIMELOCK  PREIMAGE
$ sendrawtransaction <TX_HEX>
$ getrawtransaction <TX_ID>
```

#### 7 bis. Failure case: user redeems the funds locked in P2WSH swap smart contract
> bitcoin-cli _gettransaction_ or _getrawtransaction_ to get the output index (TX_VOUT)
```
$ node spending_swap_tx.js refund on2off TX_ID TX_VOUT  WITNESS_SCRIPT  TIMELOCK   
$ sendrawtransaction <TX_HEX>
$ getrawtransaction <TX_ID>
```

#### 8. Mine a block
```
$ bitcoin-cli getnewaddress
$ bitcoin-cli generatetoaddress 1 ADDR
```

#### 9. Check that the Swap Provider received his money on-chain
> Swap Provider redeem address is alice1 p2wpkh address
```
$ bitcoin-cli scantxoutset start '["addr(bcrt1qlwyzpu67l7s9gwv4gzuv4psypkxa4fx4ggs05g)"]'
```

#### 10. Check that the user received his money off-chain
```
$ lncli-user channelbalance
```


## Swapping Process: Off-Chain To On-Chain

#### 1. Swap Provider generates a LN invoice asking for 1000 satoshis 
``` 
$ lncli-sp addinvoice 1000 [PREIMAGE]  
returns <payment_request>
```

#### 2. Swap Provider generates the P2WSH address from the swap witness script
```
$ node swap_p2wsh.js off2on PAYMENT_HASH  TIMELOCK  [PREIMAGE]
```

#### 3. Swap provider sends 1200 satoshis to the P2WSH swap smart contract address
```
$ sendtoaddress <p2wsh_addr> 0.000012
```

#### 4. Swap provider shows the invoice to the user

#### 5. User must pay the invoice in order to get the preimage that allows him to redeem the on-chain funds
```
$ lncli-user payinvoice <payment_request>
```

#### 6. Happy case: user redeems the funds locked in the P2WSH swap smart contract
> bitcoin-cli _gettransaction_ or _getrawtransaction_ to get the output index (TX_VOUT)
```
$ node spending_swap_tx.js claim off2on TX_ID TX_VOUT  WITNESS_SCRIPT  TIMELOCK  PREIMAGE
$ sendrawtransaction <TX_HEX>
$ getrawtransaction <TX_ID>
```

#### 6 bis. Failure case: swap provider redeems the funds locked in the P2WSH swap smart contract
> bitcoin-cli _gettransaction_ or _getrawtransaction_ to get the output index (TX_VOUT)
```
$ node spending_swap_tx.js refund off2on TX_ID TX_VOUT  WITNESS_SCRIPT  TIMELOCK
$ sendrawtransaction <TX_HEX>
$ getrawtransaction <TX_ID>
```

#### 7. Mine a block
```
$ bitcoin-cli getnewaddress
$ bitcoin-cli generatetoaddress 1 ADDR
```

#### 8. Check that the user received his money on-chain
> User redeem address is bob1 p2wpkh address
```
$ bitcoin-cli scantxoutset start '["addr(bcrt1qlwyzpu67l7s9gwv4gzuv4psypkxa4fx4ggs05g)"]'
```

#### 9. Check that the swap provider received his money off-chain
```
$ lncli-sp channelbalance
```
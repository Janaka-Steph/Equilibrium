# Equilibrium

A user wants off-chain funds by paying a swap provider on chain. 

### 1. User generates a LN invoice   
$ lncli addinvoice 1000 [<chosen_preimage>]  
<pay_req>

### 2. User gives the invoice to the Swap Provider

### 3. Swap Provider extract the payment hash - sha256(preimage)
$ lncli decodepayreq <pay_req>

### 4. Swap Provider generates the P2WSH address from swap redeem script
$ node swap_p2wsh.js

### 5. User send funds to the P2WSH address
$ sendtoaddress <p2wsh_addr> 1

### 5. Swap Provider pays the invoice in order to get the preimage 
$ lncli payinvoice <pay_req>

### 6. Swap Provider spends the P2WSH
$ node spending_swap_tx.js
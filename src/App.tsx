import React, {useEffect, useState} from 'react';
import logo from './logo.svg';
import './App.css';
import { ImmutableX, Config, createStarkSigner, StarkSigner, TokenAmount, FeeEntry, IMXError } from "@imtbl/core-sdk";
import * as ethers from 'ethers'
import {generateStarkWallet} from "./starkKey";
import {sign} from "crypto";

declare global {
  interface Window {
    ethereum: any
  }
}

export const imx = new ImmutableX(Config.SANDBOX);


function App() {

  const [starkSigner, setStarkSigner] = useState<StarkSigner>()
  const [signer, setSigner] = useState<ethers.Signer>()
  const [amountInEther, setAmountInEther] = useState<number>()

  const connectToMetamask = async () => {
    if(window.ethereum){
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = provider.getSigner()

      const starkWallet = await generateStarkWallet(signer);
      const starkSigner = createStarkSigner(starkWallet.starkKeyPair.getPrivate("hex"));

      await imx.registerOffchain({
        starkSigner: starkSigner,
        ethSigner: signer
      })

      setSigner(signer);
      setStarkSigner(starkSigner)
    }
  }

  const deposit = async () => {
    try {
      if(amountInEther && starkSigner && signer){
        const amountInWei = ethers.utils.parseEther(`${amountInEther}`).toString()

        const deposit = await imx.deposit(signer, {
          type: 'ETH',
          amount: amountInWei
        })
        console.log('this is the deposit', deposit)
      }
    } catch (e) {
      console.log(e)
    }
  }


  const transfer = async () => {
    try {
      if(amountInEther && starkSigner && signer){
        const amountInWei = ethers.utils.parseEther(`${amountInEther}`).toString()

        const deposit = await imx.transfer({
          starkSigner: starkSigner,
          ethSigner: signer
        }, {
          type: 'ETH',
          amount: amountInWei,
          receiver: '0xe62e5368191f202bceac876d5048da0880aa7624'
        })
        console.log('this is the deposit', deposit)
      }
    } catch (e) {
      console.log(e)
    }
  }


  useEffect(() => {
    (async () => {
      const address = await signer?.getAddress()
      if(address){
        const balances = await imx.listBalances({
          owner: address
        })

        console.log('balances', ethers.utils.formatEther(balances.result[0].balance).toString())
      }

    })()
  }, [signer, starkSigner])



  return (
    <div className="App">
      <header className="App-header">
        {
          signer && starkSigner ? (
              <div>
                <input
                  type="text"
                  placeholder="Enter amount"
                  onChange={(e) => setAmountInEther(+e.target.value)}
                />
                <button onClick={deposit}>Deposit</button>
                <button onClick={transfer}>transfer</button>
              </div>
          ) : (
            <button onClick={connectToMetamask}>Connect</button>
          )
        }


      </header>
    </div>
  );
}

export default App;

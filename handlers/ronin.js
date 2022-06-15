const Web3 = require('web3')
const got = require('got')
const bip39 = require('bip39')
const { hdkey } = require('ethereumjs-wallet')
const dayjs = require('dayjs')
const async = require('async')

const SLP_CONTRACT = '0xa8754b9fa15fc18bb59458815510e40a12cd2014'
const AXS_CONTRACT = '0x97a9107c1793bc407d6f527b77e7fff4d812bece'
const AXIE_CONTRACT = '0x32950db2a7164ae833121501c797d79e7b79d74c'
const WETH_CONTRACT = '0xc99a6a985ed2cac1ef41640596c5a5f9f4e19ef5'
const RON_CONTRACT = '0xe514d9deb7966c8be0ca922de8a064264ea6bcd4'
const RONIN_PROVIDER_FREE = 'https://proxy.roninchain.com/free-gas-rpc'
const RONIN_PROVIDER = 'https://api.roninchain.com/rpc'
const abi = [
  {
    constant: false,
    inputs: [
      {
        internalType: 'address',
        name: '_owner',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: '_createdAt',
        type: 'uint256'
      },
      {
        internalType: 'bytes',
        name: '_signature',
        type: 'bytes'
      }
    ],
    name: 'checkpoint',
    outputs: [
      {
        internalType: 'uint256',
        name: '_balance',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      {
        internalType: 'address',
        name: '_to',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: '_value',
        type: 'uint256'
      }
    ],
    name: 'transfer',
    outputs: [
      {
        internalType: 'bool',
        name: '_success',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  }
]

const sleep = (time) => {
  return new Promise((resolve) => setTimeout(resolve, time))
}

exports.get_key = (mnemonic, index) => {
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const hdwallet = hdkey.fromMasterSeed(seed)
  const wallet_hdpath = "m/44'/60'/0'/0/"
  const wallet = hdwallet.derivePath(wallet_hdpath + index).getWallet()
  const address = '0x' + wallet.getAddress().toString('hex')
  const privateKey = '0x' + wallet.getPrivateKey().toString('hex')
  return { address: address, privateKey: privateKey }
}

const get_balance = async (address, token = 'slp') => {
  const result = await async
    .forever(async () => {
      let contract_address = ''
      if (token === 'slp') {
        contract_address = SLP_CONTRACT
      } else if (token === 'axs') {
        contract_address = AXS_CONTRACT
      } else if (token === 'axie') {
        contract_address = AXIE_CONTRACT
      } else if (token === 'weth') {
        contract_address = WETH_CONTRACT
      } else if (token === 'ron') {
        contract_address = RON_CONTRACT
      }
      const web3 = new Web3(new Web3.providers.HttpProvider(RONIN_PROVIDER))
      const contract = new web3.eth.Contract(abi, web3.utils.toChecksumAddress(contract_address))
      let balance = await contract.methods
        .balanceOf(web3.utils.toChecksumAddress(address))
        .call()
        .catch((err) => {
          console.log(err.message)
          return { err: true }
        })
      if (token === 'weth') {
        balance = Math.round(web3.utils.fromWei(balance, 'ether') * 1000) / 1000
      }
      if (balance && !balance.err) {
        return Promise.reject(balance)
      }
      console.log('sleep 200')
      await sleep(200)
    })
    .catch((result) => {
      return result.message
    })
  return Number(result)
}
exports.get_balance = get_balance

exports.has_claimable_slp = async (address) => {
  const options = {
    method: 'GET',
    url: `https://game-api-pre.skymavis.com/v1/players/${address}/items/1`,
    responseType: 'json',
    resolveBodyOnly: true
  }
  const slp_in_game = await got(options).catch((err) => {
    console.log('log2', err)
    return Promise.reject(err)
  })
  const slp_in_wallet = await get_balance(address, 'slp').catch((err) => {
    console.log('log1', err)
    return Promise.reject(err)
  })
  if (
    dayjs.unix(slp_in_game.lastClaimedItemAt).add(14, 'day').isBefore(dayjs()) &&
    slp_in_wallet === 0 &&
    slp_in_game.rawTotal > slp_in_game.rawClaimableTotal
  ) {
    return slp_in_game.rawTotal - slp_in_game.rawClaimableTotal
  }
  if (
    slp_in_wallet === 0 &&
    slp_in_game.blockchainRelated.signature &&
    slp_in_game.blockchainRelated.signature.amount > slp_in_game.blockchainRelated.checkpoint
  ) {
    return slp_in_game.blockchainRelated.signature.amount - slp_in_game.blockchainRelated.checkpoint
  }
  return 0
  // {
  //   "clientID": "0x445aaa7c84d6811494f2e5571599d622e4de601e",
  //   "itemID": 1,
  //   "name": "Breeding Potion",
  //   "description": "Breeding Potion",
  //   "imageUrl": "",
  //   "total": 1039,
  //   "blockchainRelated": {
  //     "signature": {
  //       "signature": "0x01668a7b8efe8ce5a8b7cf174e3f4c985e30c3b5003440d2db2b7fb3295838e51c48b3f9d436466bb8e2c6b795ddb2390ee7bb2c8b249c267bb9b95b6e04bed9b72c",
  //       "amount": 100,
  //       "timestamp": 1649664080
  //     },
  //     "balance": 1000,
  //     "checkpoint": 70,
  //     "blockNumber": 1256
  //   },
  //   "claimableTotal": 1039,
  //   "lastClaimedItemAt": 1649664080,
  //   "rawTotal": 109,
  //   "rawClaimableTotal": 100
  // }
}

const get_random_msg = async () => {
  const options = {
    method: 'POST',
    url: 'https://graphql-gateway.axieinfinity.com/graphql',
    json: {
      operationName: 'CreateRandomMessage',
      variables: {},
      query: 'mutation CreateRandomMessage{createRandomMessage}'
    },
    responseType: 'json',
    resolveBodyOnly: true
  }
  const result = await got(options)
  return result.data.createRandomMessage
  // {
  //   data: {
  //     createRandomMessage: 'Lunacia Kingdom\n' +
  //       '\n' +
  //       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXNzYWdlIjoiNDcyZjA3NzJkMWJkMTExZjA1YTM5OWQwNzhmNjI3NDcyNTdlNTEwNiIsImlhdCI6MTY0MDI1MTUwOCwiZXhwIjoxNjQwMjUyNDA4LCJpc3MiOiJBeGllSW5maW5pdHkifQ.4lY4DdkTLSPMaN0GyUuQIq64YsWmNCURZZpS_8zq1mk'
  //   }
  // }
}
exports.get_random_msg = get_random_msg

const get_jwt = async (address, private_key) => {
  const msg = await get_random_msg()
  const web3 = new Web3()
  const sign_result = web3.eth.accounts.sign(msg, private_key)
  const options = {
    method: 'POST',
    url: 'https://graphql-gateway.axieinfinity.com/graphql',
    json: {
      operationName: 'CreateAccessTokenWithSignature',
      variables: {
        input: {
          mainnet: 'ronin',
          owner: address,
          message: msg,
          signature: sign_result.signature
        }
      },
      query:
        'mutation CreateAccessTokenWithSignature($input: SignatureInput!)' +
        '{createAccessTokenWithSignature(input: $input) ' +
        '{newAccount result accessToken __typename}}'
    },
    responseType: 'json',
    resolveBodyOnly: true
  }
  const result = await got(options)
  return result.data.createAccessTokenWithSignature.accessToken
  // {
  //   data: {
  //     createAccessTokenWithSignature: {
  //       newAccount: false,
  //       result: true,
  //       accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjg4NjkyNywiYWN0aXZhdGVkIjp0cnVlLCJyb25pbkFkZHJlc3MiOiIweGJlOWJhZGE2MDNiZWIwMzNmZWZjYWJlNDRmNzEyNDZiMzE1MjI4M2YiLCJldGhBZGRyZXNzIjoiMHg4Yzk2MzlkZDkxMGFlMTY2ZGZmYWY3ZmRhZWEwZjJiNGQ5MjA1OGQ4IiwiaWF0IjoxNjQwMjUxNTc2LCJleHAiOjE2NDA4NTYzNzYsImlzcyI6IkF4aWVJbmZpbml0eSJ9.p1ADsYHnEp5Q-Pej832HMUiIZU4YecmYD5dSD3BL0p8',
  //       __typename: 'CreateAccessTokenWithSignatureResult'
  //     }
  //   }
  // }
}
exports.get_jwt = get_jwt

const get_nonce = (address) => {
  const web3 = new Web3(new Web3.providers.HttpProvider(RONIN_PROVIDER))
  const nonce = web3.eth.getTransactionCount(web3.utils.toChecksumAddress(address))
  return nonce
}
exports.get_nonce = get_nonce

const apply_claim = async (address, private_key) => {
  const jwt = await get_jwt(address, private_key)
  const options = {
    method: 'POST',
    url: `https://game-api-pre.skymavis.com/v1/players/me/items/1/claim`,
    headers: {
      authorization: `Bearer ${jwt}`
    },
    json: {},
    responseType: 'json',
    resolveBodyOnly: true
  }
  const result = await got(options)
  return result.blockchainRelated.signature
  // {
  //   "clientID": "0x445aaa7c84d6811494f2e5571599d622e4de601e",
  //   "itemID": 1,
  //   "name": "Breeding Potion",
  //   "description": "Breeding Potion",
  //   "imageUrl": "",
  //   "total": 1039,
  //   "blockchainRelated": {
  //     "signature": {
  //       "signature": "0x01668a7b8efe8ce5a8b7cf174e3f4c985e30c3b5003440d2db2b7fb3295838e51c48b3f9d436466bb8e2c6b795ddb2390ee7bb2c8b249c267bb9b95b6e04bed9b71b",
  //       "amount": 109,
  //       "timestamp": 1651046488
  //     },
  //     "balance": 1000,
  //     "checkpoint": 70,
  //     "blockNumber": 1256
  //   },
  //   "claimableTotal": 1039,
  //   "lastClaimedItemAt": 1651046488,
  //   "rawTotal": 109,
  //   "rawClaimableTotal": 109
  // }
}
exports.apply_claim = apply_claim

exports.send_claim = async (address, private_key) => {
  await async
    .forever(async () => {
      try {
        const signature = await apply_claim(address, private_key)
        const web3 = new Web3(new Web3.providers.HttpProvider(RONIN_PROVIDER))
        const contract = new web3.eth.Contract(abi, web3.utils.toChecksumAddress(SLP_CONTRACT))
        const nonce = await get_nonce(address)
        const encodeABI = await contract.methods
          .checkpoint(web3.utils.toChecksumAddress(address), signature.amount, signature.timestamp, signature.signature)
          .encodeABI()
        const signed_claim = await web3.eth.accounts.signTransaction(
          {
            nonce: nonce,
            to: web3.utils.toChecksumAddress(SLP_CONTRACT),
            data: encodeABI,
            gasPrice: web3.utils.toWei('1', 'gwei'),
            gas: 492874
          },
          private_key
        )
        const send_claim = await web3.eth.sendSignedTransaction(signed_claim.rawTransaction)
        return Promise.reject(JSON.stringify(send_claim))
      } catch (error) {
        console.log('log: ' + error.message)
        if (!error.message.includes('Invalid JSON RPC response') && !error.message.includes('Failed to check')) {
          return Promise.reject(JSON.stringify(error))
        }
      }
      console.log('send_claim sleep 200')
      await sleep(200)
    })
    .catch((result) => {
      return JSON.parse(result.message)
    })

  // {
  //   blockHash: '0xef58c47b6352920020eb5df9fce60d2ff513c2126fe169a3cc87de03197f4e9c',
  //   blockNumber: 9582200,
  //   contractAddress: null,
  //   cumulativeGasUsed: 4807354,
  //   from: '0xbe9bada603beb033fefcabe44f71246b3152283f',
  //   gasUsed: 74908,
  //   logs: [ [Object], [Object] ],
  //   logsBloom: '0x00040000000000000000000000000000000000000000000000000000000000000000100000000000000040000000000000000000000000000000000000000000000000000000000000000008000000000000000000000200000000000000000000000000020000000000000000000800000000000000000000000010000000000000000000000000000000000000000000000000000000400000000100000000000000000000000000000400000000000000000000000000000000020000000000000002000000000000000000000000010000000002000000020000000020000000000000001000000000000000000000000000000000000000000000000000',
  //   status: true,
  //   to: '0xa8754b9fa15fc18bb59458815510e40a12cd2014',
  //   transactionHash: '0xfba57d602f1c3bc84d515b2221eef141c28cd9254ff74d79f1c0003c1ef100c4',
  //   transactionIndex: 36,
  //   type: '0x0'
  // }
}

exports.get_receipt = async (hash) => {
  const web3 = new Web3(new Web3.providers.HttpProvider(RONIN_PROVIDER))
  const receipt = await web3.eth.getTransactionReceipt(hash)
  return receipt
}

exports.transfer_slp = async (from_address, private_key, to_address, amount) => {
  await async
    .forever(async () => {
      try {
        const web3 = new Web3(new Web3.providers.HttpProvider(RONIN_PROVIDER))
        const contract = new web3.eth.Contract(abi, web3.utils.toChecksumAddress(SLP_CONTRACT))
        const nonce = await get_nonce(from_address)
        const encodeABI = await contract.methods.transfer(web3.utils.toChecksumAddress(to_address), amount).encodeABI()
        const signed_claim = await web3.eth.accounts.signTransaction(
          {
            nonce: nonce,
            chainId: 2020,
            to: web3.utils.toChecksumAddress(SLP_CONTRACT),
            data: encodeABI,
            gasPrice: web3.utils.toWei('1', 'gwei'),
            gas: 246437
          },
          private_key
        )
        const send_claim = await web3.eth.sendSignedTransaction(signed_claim.rawTransaction)
        return Promise.reject(JSON.stringify(send_claim))
      } catch (error) {
        console.log(error.message)
        if (error.message !== 'Invalid JSON RPC response: "free gas request times is exceeded"') {
          return Promise.reject(JSON.stringify(error))
        }
      }
      console.log('transfer_slp sleep 200')
      await sleep(200)
    })
    .catch((result) => {
      return JSON.parse(result.message)
    })
}

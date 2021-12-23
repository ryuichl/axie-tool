const Web3 = require('web3')
const got = require('got')
const bip39 = require('bip39')
const { hdkey } = require('ethereumjs-wallet')

const SLP_CONTRACT = '0xa8754b9fa15fc18bb59458815510e40a12cd2014'
const AXS_CONTRACT = '0x97a9107c1793bc407d6f527b77e7fff4d812bece'
const AXIE_CONTRACT = '0x32950db2a7164ae833121501c797d79e7b79d74c'
const WETH_CONTRACT = '0xc99a6a985ed2cac1ef41640596c5a5f9f4e19ef5'
const RONIN_PROVIDER_FREE = 'https://proxy.roninchain.com/free-gas-rpc'
const RONIN_PROVIDER = 'https://api.roninchain.com/rpc'
const abi = [
  {
    constant: false,
    inputs: [
      {
        internalType: 'address',
        name: '_from',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '_to',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256'
      }
    ],
    name: 'safeTransferFrom',
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
  },
  {
    constant: false,
    inputs: [
      {
        internalType: 'uint256',
        name: '_sireId',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: '_matronId',
        type: 'uint256'
      }
    ],
    name: 'breedAxies',
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
    constant: true,
    inputs: [
      {
        internalType: 'address',
        name: '_owner',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: '_index',
        type: 'uint256'
      }
    ],
    name: 'tokenOfOwnerByIndex',
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
  }
]

exports.get_key = (mnemonic, index) => {
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const hdwallet = hdkey.fromMasterSeed(seed)
  const wallet_hdpath = "m/44'/60'/0'/0/"
  const wallet = hdwallet.derivePath(wallet_hdpath + index).getWallet()
  const address = '0x' + wallet.getAddress().toString('hex')
  const privateKey = '0x' + wallet.getPrivateKey().toString('hex')
  return { address: address, privateKey: privateKey }
}

exports.get_balance = async (address, token = 'slp') => {
  let contract_address = ''
  if (token === 'slp') {
    contract_address = SLP_CONTRACT
  } else if (token === 'axs') {
    contract_address = AXS_CONTRACT
  } else if (token === 'axie') {
    contract_address = AXIE_CONTRACT
  } else if (token === 'weth') {
    contract_address = WETH_CONTRACT
  }
  const web3 = new Web3(new Web3.providers.HttpProvider(RONIN_PROVIDER))
  const contract = new web3.eth.Contract(abi, web3.utils.toChecksumAddress(contract_address))
  let balance = await contract.methods.balanceOf(web3.utils.toChecksumAddress(address)).call()
  if (token === 'weth') {
    balance = Math.round(web3.utils.fromWei(balance, 'ether') * 1000) / 1000
  }
  return Number(balance)
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
  return result
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
  const msg = await ronin_handler.get_random_msg()
  const web3 = new Web3()
  const sign_result = web3.eth.accounts.sign(msg.data.createRandomMessage, private_key)
  const options = {
    method: 'POST',
    url: 'https://graphql-gateway.axieinfinity.com/graphql',
    json: {
      operationName: 'CreateAccessTokenWithSignature',
      variables: {
        input: {
          mainnet: 'ronin',
          owner: address,
          message: msg.data.createRandomMessage,
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
  return result
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

;(async function () {
  try {
    require('dotenv').config()
    const argv = require('yargs').argv
    const Promise = require('bluebird')
    const fs = require('fs-extra')

    const ronin_handler = require('./handlers/ronin')

    const mnemonic = process.env.mnemonic
    const skip = 2
    const total = 75
    const main_wallet = ronin_handler.get_key(mnemonic, 1)

    if (argv.job === 'record') {
      const record = await Promise.mapSeries([...Array(total)], async (e, i) => {
        const wallet = ronin_handler.get_key(mnemonic, i + skip)
        const slp = await ronin_handler.has_claimable_slp(wallet.address)
        console.log({ i: i + 1, slp })
        return { i: i + 1, slp }
      })
      await fs.writeJSON('./db/record.json', record)
      return process.exit(0)
    }
    if (argv.job === 'claim') {
      const record = await Promise.mapSeries([...Array(total)], async (e, i) => {
        const wallet = ronin_handler.get_key(mnemonic, i + skip)
        const slp = await ronin_handler.has_claimable_slp(wallet.address)
        console.log({ i: i + 1, slp })
        if (slp === 0) {
          return { i: i + 1, slp }
        }
        await ronin_handler.send_claim(wallet.address, wallet.privateKey)
        const balance = await ronin_handler.get_balance(wallet.address, 'slp')
        return { i: i + 1, slp: balance }
      })
      await fs.writeJSON('./db/claim.json', record)
      return process.exit(0)
    }
    if (argv.job === 'collect') {
      const record = await Promise.mapSeries([...Array(total)], async (e, i) => {
        const wallet = ronin_handler.get_key(mnemonic, i + skip)
        const balance = await ronin_handler.get_balance(wallet.address, 'slp')
        console.log({ i: i + 1, slp: balance })
        if (balance === 0) {
          return { i: i + 1, slp: 2 }
        }
        await ronin_handler.transfer_slp(wallet.address, wallet.privateKey, main_wallet.address, balance)
        return { i: i + 1, slp: balance }
      })
      await fs.writeJSON('./db/collect.json', record)
      return process.exit(0)
    }
    if (argv.job === 'pay') {
      const collect = await fs.readJSON('./db/collect.json')
      const scholar_info = await fs.readJSON('./db/info.json')
      const record = await Promise.mapSeries(collect, async (e) => {
        console.log({ i: e.i, slp: Math.round(e.slp / 2) })
        if (e.slp === 0) {
          return { i: e.i, slp: 0 }
        }
        if (!scholar_info[e.i - 1].address && !scholar_info[e.i - 1].leader) {
          return { i: e.i, slp: 0 }
        }
        const scholar_address = scholar_info[e.i - 1].address || scholar_info[scholar_info[e.i - 1].leader - 1].address
        const amount = Math.round(e.slp / 2)
        await ronin_handler.transfer_slp(main_wallet.address, main_wallet.privateKey, scholar_address, amount)
        return { i: e.i, slp: amount, address: scholar_address }
      })
      await fs.writeJSON('./db/pay.json', record)
      return process.exit(0)
    }
  } catch (err) {
    console.log(err)
  }
  return process.exit(0)
})()

;(async function () {
  try {
    require('dotenv').config()
    const argv = require('yargs').argv
    const Promise = require('bluebird')
    const fs = require('fs-extra')

    const ronin_handler = require('./handlers/ronin')

    const mnemonic = process.env.mnemonic
    const skip = 2
    const total = 82
    const main_wallet = ronin_handler.get_key(mnemonic, 1)

    if (argv.job === 'record') {
      const record = await Promise.map(
        [...Array(total)],
        async (e, i) => {
          const wallet = ronin_handler.get_key(mnemonic, i + skip)
          const slp = await ronin_handler.has_claimable_slp(wallet.address)
          console.log({ i: i + 1, slp })
          return { i: i + 1, slp }
        },
        { concurrency: 3 }
      )
      await fs.outputJson('./db/record.json', record)
      return process.exit(0)
    } else if (argv.job === 'claim') {
      const record = await Promise.map(
        [...Array(total)],
        async (e, i) => {
          const wallet = ronin_handler.get_key(mnemonic, i + skip)
          const slp = await ronin_handler.has_claimable_slp(wallet.address)
          console.log({ i: i + 1, slp })
          if (slp === 0) {
            return { i: i + 1, slp }
          }
          await ronin_handler.send_claim(wallet.address, wallet.privateKey)
          const balance = await ronin_handler.get_balance(wallet.address, 'slp')
          return { i: i + 1, slp: balance }
        },
        { concurrency: 3 }
      )
      await fs.outputJson('./db/claim.json', record)
      return process.exit(0)
    } else if (argv.job === 'collect') {
      const record = await Promise.map(
        [...Array(total)],
        async (e, i) => {
          const wallet = ronin_handler.get_key(mnemonic, i + skip)
          const balance = await ronin_handler.get_balance(wallet.address, 'slp')
          console.log({ i: i + 1, slp: balance })
          if (balance === 0) {
            return { i: i + 1, slp: 0, pay: 0 }
          }
          await ronin_handler.transfer_slp(wallet.address, wallet.privateKey, main_wallet.address, balance)
          return { i: i + 1, slp: balance }
        },
        { concurrency: 3 }
      )
      await fs.outputJson('./db/collect.json', record)
      return process.exit(0)
    } else if (argv.job === 'calcu') {
      const scholar_info = await fs.readJSON('./db/info.json')
      const collect = await fs.readJSON('./db/collect.json')
      const result = collect.map((data, i) => {
        console.log(data, i, scholar_info[i])
        data.address = scholar_info[i].address
        if (scholar_info[i].extra === true) {
          data.extra = true
          data.event = Math.round(data.slp * 0.5)
        } else {
          data.event = data.slp
        }
        if (scholar_info[i].extra === true && data.slp >= 5600) {
          data.pay = Math.round(data.slp * 0.7)
          data.share = 0.7
        } else if (scholar_info[i].extra === true && data.slp >= 4480) {
          data.pay = Math.round(data.slp * 0.6)
          data.share = 0.6
        } else if (!scholar_info[i].extra && data.slp >= 2800) {
          data.pay = Math.round(data.slp * 0.7)
          data.share = 0.7
        } else if (!scholar_info[i].extra && data.slp >= 2240) {
          data.pay = Math.round(data.slp * 0.6)
          data.share = 0.6
        } else if (data.slp >= 1680) {
          data.pay = Math.round(data.slp * 0.5)
          data.share = 0.5
        } else if (data.slp >= 840) {
          data.pay = data.slp - 840
          data.share = 0
        } else {
          data.pay = 0
          data.share = 0
        }
        return data
      })
      result.sort((a, b) => {
        return b.event - a.event
      })
      ;[1000, 700, 500, 400, 400].map((award, i) => {
        result[i].rank = i + 1
        result[i].award = award
        console.log(result[i])
      })
      result.sort((a, b) => {
        return a.i - b.i
      })
      result.map((data) => {
        delete data.event
        return data
      })
      await fs.outputJson('./db/calcu.json', result)
      return process.exit(0)
    } else if (argv.job === 'count') {
      const collect = await fs.readJSON('./db/collect.json')
      const count = collect.reduce(
        (count, e) => {
          count[0] += e.slp
          count[1] += e.pay
          count[1] += e.award || 0
          return count
        },
        [0, 0]
      )
      console.log({ total: count[0], manager: count[0] - count[1], scholar: count[1] })
      return process.exit(0)
    } else if (argv.job === 'pay') {
      const collect = await fs.readJSON('./db/collect.json')
      const scholar_info = await fs.readJSON('./db/info.json')
      await Promise.mapSeries(collect, async (e) => {
        if (e.pay === 0) {
          return { i: e.i, slp: 0 }
        }
        if (!scholar_info[e.i - 1].address) {
          return { i: e.i, slp: 0 }
        }
        const scholar_address = e.address.includes('ronin:')
          ? e.address.replace('ronin:', '0x')
          : scholar_info[e.address - 1].address.replace('ronin:', '0x')
        const pay_total = e.pay + (e.award || 0)
        await ronin_handler.transfer_slp(main_wallet.address, main_wallet.privateKey, scholar_address, pay_total)
      })
      return process.exit(0)
    }
  } catch (err) {
    console.log(err)
  }
  return process.exit(0)
})()

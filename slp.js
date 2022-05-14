;(async function () {
  try {
    require('dotenv').config()
    const argv = require('yargs').argv
    const Promise = require('bluebird')
    const fs = require('fs-extra')

    const ronin_handler = require('./handlers/ronin')

    const mnemonic = process.env.mnemonic
    const skip = 2
    const total = 87
    const main_wallet = ronin_handler.get_key(mnemonic, 1)

    const sleep = (time) => {
      return new Promise((resolve) => setTimeout(resolve, time))
    }
    if (argv.job === 'csv') {
      let info = await fs.readJSON('./db/info.json')
      let scholar = await fs.readFile('./db/scholar.txt', 'utf8')
      scholar.split('\n').map((e, index) => {
        if (!info[index]) {
          info[index] = { i: index + 1, address: '' }
        }
        e = e.split('\t')
        const name = e[0]
        const extra = e[1]
        const address = e[2]
        const reduce = Number(e[3]) || undefined
        if (!address) {
          info[index] = { i: index + 1, address: '' }
        } else if (address.includes('ronin:')) {
          info[index].name = name
          if (extra === 'x') {
            info[index].energy = 40
          } else if (extra === 'xx') {
            info[index].energy = 60
          } else {
            delete info[index].energy
          }
          info[index].address = address
          info[index].reduce = reduce
        } else {
          const number = address.split(',')[0]
          info[index].name = name
          if (extra === 'x') {
            info[index].energy = 40
          } else if (extra === 'xx') {
            info[index].energy = 60
          }
          info[index].address = info[number - 1].address
          info[index].reduce = reduce
        }
      })
      await fs.writeJSON('./db/info.json', info)
      return process.exit(0)
    } else if (argv.job === 'record') {
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
      // await fs.outputJson('./db/claim.json', record)
      return process.exit(0)
    } else if (argv.job === 'collect') {
      const record = await Promise.map(
        [...Array(total)],
        async (e, i) => {
          const wallet = ronin_handler.get_key(mnemonic, i + skip)
          const balance = await ronin_handler.get_balance(wallet.address, 'slp')
          console.log({ i: i + 1, slp: balance })
          if (balance === 0) {
            return { i: i + 1, slp: 0 }
          }
          await ronin_handler.transfer_slp(wallet.address, wallet.privateKey, main_wallet.address, balance)
          await sleep(200)
          return { i: i + 1, slp: balance }
        },
        { concurrency: 3 }
      )
      // await fs.outputJson('./db/collect.json', record)
      return process.exit(0)
    } else if (argv.job === 'calcu') {
      const scholar_info = await fs.readJSON('./db/info.json')
      const collect = await fs.readJSON('./db/collect.json')
      const result = collect.map((data, i) => {
        data.address = scholar_info[i].address
        data.energy = scholar_info[i].energy
        if (scholar_info[i].energy === 60 && data.slp >= 1050) {
          data.pay = data.slp - 1050
        } else if (scholar_info[i].energy === 60 && data.slp < 1050) {
          data.pay = 0
        } else if (scholar_info[i].energy === 40 && data.slp >= 700) {
          data.pay = data.slp - 700
        } else if (scholar_info[i].energy === 40 && data.slp < 700) {
          data.pay = 0
        } else if (data.slp >= 350) {
          data.pay = data.slp - 350
        } else if (data.slp < 350) {
          data.pay = 0
        } else {
          data.pay = 0
        }
        if (scholar_info[i].reduce && data.slp > 25 * scholar_info[i].reduce) {
          data.new_pay = data.slp - 25 * scholar_info[i].reduce
        }
        return data
      })
      await fs.outputJson('./db/calcu.json', result)
      return process.exit(0)
    } else if (argv.job === 'scatter') {
      const calcu = await fs.readJSON('./db/calcu.json')
      const result = calcu.reduce((s, e) => {
        if (!e.address || (e.pay === 0 && !e.new_pay)) {
          return s
        }
        return s + `${e.address},${e.new_pay ? e.new_pay : e.pay}\n`
      }, '')
      await fs.writeFile('./db/scatter.txt', result)
    } else if (argv.job === 'count') {
      const collect = await fs.readJSON('./db/calcu.json')
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
      const collect = await fs.readJSON('./db/calcu.json')
      const scholar_info = await fs.readJSON('./db/info.json')
      await Promise.map(
        collect,
        async (e, i) => {
          // if (e.pay === 0) {
          //   return { i: e.i, slp: 0 }
          // }
          // if (!scholar_info[e.i - 1].address) {
          //   return { i: e.i, slp: 0 }
          // }
          const wallet = ronin_handler.get_key(mnemonic, i + skip)
          const balance = await ronin_handler.get_balance(wallet.address, 'slp')
          if (balance === 0) {
            return true
          }
          const scholar_address = e.address.replace('ronin:', '0x')
          // const pay_total = e.pay + (e.award || 0)
          console.log(i, scholar_address, e.pay)
          await ronin_handler.transfer_slp(wallet.address, wallet.privateKey, main_wallet.address, balance)
          // await ronin_handler.transfer_slp(wallet.address, wallet.privateKey, scholar_address, e.pay)
          // await ronin_handler.transfer_slp(main_wallet.address, main_wallet.privateKey, scholar_address, pay_total)
        },
        { concurrency: 3 }
      )
      return process.exit(0)
    } else if (argv.job === 'ron') {
      const result = [...Array(total)].reduce((s, e, i) => {
        const wallet = ronin_handler.get_key(mnemonic, i + skip)
        return s + `${wallet.address.replace('0x', 'ronin:')},0.1\n`
      }, '')
      await fs.writeFile('./db/ron.txt', result)
      return process.exit(0)
    }
  } catch (err) {
    console.log(err)
  }
  return process.exit(0)
})()

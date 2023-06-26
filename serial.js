"use strict";

import { SerialPort } from 'serialport'

export class TrackingModes {
  static Off     = 0
  static AltAzm  = 1
  static EqNorth = 2
  static EqSouth = 3
}

export class EquatorialSystems {
  static Other = 0
  static JNow  = 1
  static J2000 = 2
  static J2050 = 3
  static B1950 = 4
}

export class AlignmentModes {
  static AltAzm = 0
  static Polar  = 1
  static German = 2
}

class Port {
  async send_command(cmd) {
    throw new Error('Not implemented')
  }
  
  async close() {
    throw new Error('Not implemented')
  }
}

class Commands {
  static End = 0x23
  static Ok = Buffer.from([Commands.End])
}

class SimulatorPort extends Port {

  constructor() {
    super()
  }

  async send_command(cmd) {
    if (typeof cmd === 'string')
      cmd = Buffer.from(cmd)

    console.log(cmd)

    switch (cmd[0]) {
      case 0x45: // getRaDec
        return Buffer.from('AAAA,AAAA#')

      case 0x5A: // getAltAzm
        return Buffer.from('AAAA,AAAA#')

      case 0x50: //slew
        return Commands.Ok

      case 0x54: //setTrackingMode
        return Commands.Ok

      case 0x74: //getTrackingMode
        return Buffer.from([TrackingModes.EqNorth, Commands.End])
    }

    return Buffer.alloc(0)
  }
  
  async close() {
  }
}

class TelescopePort extends Port {
  constructor({ path, baudRate }) {
    super()
    this.port = new SerialPort({path, baudRate});
    this.buffer = Buffer.alloc(0)

    this.port.on('data', data => {
      this.buffer = Buffer.concat([this.buffer, data])

      const length = this.buffer.length

      //if (length > 0 && this.buffer[length - 1] === 0x23) {
      if (length > 0 && this.buffer.indexOf(0x23) !== -1) {
        clearTimeout(this.timeout_id)
        this.timeout_id = undefined

        this.resolve_command(this.buffer)
        console.log('Response', this.buffer, this.buffer.toString())

        this.buffer = Buffer.alloc(0)

        this.resolve_command = undefined
        this.reject_command = undefined
      }
    })
  }

  async send_command(cmd) {
    if (this.timeout_id)
      return Promise.reject(new Error('Telescope is busy'))

    return new Promise((resolve, reject) => {
      this.resolve_command = resolve
      this.reject_command = reject
      this.port.write(cmd)
      console.log('Command', cmd, cmd.toString())

      this.timeout_id = setTimeout(start => {
        if (this.reject_command) {
          this.reject_command(new Error(`Command ${cmd} timed out after ${Date.now() - start} ms`))
          this.reject_command = undefined
        }
      }, 3500, Date.now())
    })
  }

  async close() {
    this.port.close()
  }
}

export class CelestronAVX {
  constructor({ path, baudRate, simulator } = { path: '/dev/ttyUSB0', baudRate: 9600, simulator: false }) {
    if (simulator) {
      this.port = new SimulatorPort()
    } else {
      this.port = new TelescopePort({ path, baudRate })
    }
  }

  async close() {
    await this.port.close()
  }

  async version() {
    const buffer = await this.port.send_command('V')

    if (buffer.length !== 3) throw new Error('Invalid size')

    const major = buffer[0]
    const minor = buffer[1]

    return `${major}.${minor}`
  }

  async model() {
    const buffer = await this.port.send_command('m')

    if (buffer.length !== 2) throw new Error('Invalid size')

    if (buffer[0] === 1) return 'GPS Series'
    if (buffer[0] === 3) return 'i-Series'
    if (buffer[0] === 4) return 'i-Series SE'
    if (buffer[0] === 5) return 'CGE'
    if (buffer[0] === 6) return 'Advanced GT'
    if (buffer[0] === 7) return 'SLT'
    if (buffer[0] === 9) return 'CPC'
    if (buffer[0] === 10) return 'GT'
    if (buffer[0] === 11) return '4/5 SE'
    if (buffer[0] === 12) return '6/8 SE'
    if (buffer[0] === 13) return 'GCE Pro'
    if (buffer[0] === 14) return 'CGEM DX'
    if (buffer[0] === 15) return 'LCM'
    if (buffer[0] === 16) return 'Sky Prodigy'
    if (buffer[0] === 17) return 'CPC Deluxe'
    if (buffer[0] === 18) return 'GT 16'
    if (buffer[0] === 19) return 'StarSeeker'
    if (buffer[0] === 20) return 'Advanced VX'
    if (buffer[0] === 21) return 'Cosmos'
    if (buffer[0] === 22) return 'Evolution'
    if (buffer[0] === 23) return 'CGX'
    if (buffer[0] === 24) return 'CGXL'
    if (buffer[0] === 25) return 'Astrofi'
    if (buffer[0] === 26) return 'SkyWatcher'

    return 'Unknown model'
  }

  async getRaDec() {
    const buffer = await this.port.send_command('E')

    if (buffer.length !== 10) throw new Error('Invalid size')

    const ra = parseInt(buffer.slice(0, 4), 16) / 0xffff
    const dec = parseInt(buffer.slice(5, 9), 16) / 0xffff

    return [ ra * 24, dec * 360 ]
  }

  async getPreciseRaDec() {
    const buffer = await this.port.send_command('e')

    if (buffer.length !== 18) throw new Error('Invalid size')

    const ra = parseInt(buffer.slice(0, 8), 16) / 0xffffffff
    const dec = parseInt(buffer.slice(9, 17), 16) / 0xffffffff

    return [ ra * 24, dec * 360 ]
  }

  async getAltAzm() {
    const buffer = await this.port.send_command('Z')

    if (buffer.length !== 10) throw new Error('Invalid size')

    const azm = parseInt(buffer.slice(0, 4), 16) / 0xffff
    const alt = parseInt(buffer.slice(5, 9), 16) / 0xffff

    return [ alt, azm ]
  }

  async getPreciseAltAzm() {
    const buffer = await this.port.send_command('z')

    if (buffer.length !== 18) throw new Error('Invalid size')

    const azm = parseInt(buffer.slice(0, 8), 16) / 0xffffffff
    const alt = parseInt(buffer.slice(9, 17), 16) / 0xffffffff

    return [ alt, azm ]
  }

  numberToHex(number, padding) {
    return Math.trunc(number).toString(16).toUpperCase().padStart(padding, '0')
  }

  async gotoRaDec(ra, dec) {
    const raStr = this.numberToHex(ra / 24 * 0xffff, 4)
    const decStr = this.numberToHex(dec / 360 * 0xffff, 4)

    const buffer = await this.port.send_command(`R${raStr},${decStr}`)

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async gotoPreciseRaDec(ra, dec) {
    const raStr = this.numberToHex(ra / 24 * 0xffffffff, 8)
    const decStr = this.numberToHex(dec / 360 * 0xffffffff, 8)

    const buffer = await this.port.send_command(`r${raStr},${decStr}`)

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async gotoAltAzm(alt, azm) {
    const altStr = this.numberToHex(alt * 0xffff, 4)
    const azmStr = this.numberToHex(azm * 0xffff, 4)

    const buffer = await this.port.send_command(`B${azmStr},${altStr}`)

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async gotoPreciseAltAzm(alt, azm) {
    const altStr = this.numberToHex(alt * 0xffffffff, 8)
    const azmStr = this.numberToHex(azm * 0xffffffff, 8)

    const buffer = await this.port.send_command(`b${azmStr},${altStr}`)

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async syncRaDec(ra, dec) {
    const raStr = this.numberToHex(ra * 0xffff, 4)
    const decStr = this.numberToHex(dec * 0xffff, 4)

    const buffer = await this.port.send_command(`S${raStr},${decStr}`)

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async syncPreciseRaDec(ra, dec) {
    const raStr = this.numberToHex(ra * 0xffffffff, 8)
    const decStr = this.numberToHex(dec * 0xffffffff, 8)

    const buffer = await this.port.send_command(`s${raStr},${decStr}`)

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async slewVariable(axis, rate) {
    const rateAbs = Math.abs(rate * 60 * 60) //arcseconds/second
    const rateHigh = Math.trunc((rateAbs * 4) / 256)
    const rateLow = Math.trunc((rateAbs * 4) % 256)
    const direction = rate >= 0 ? 6 : 7
    const axisOp = axis === 0 ? 16 : 17

    console.log('MoveAzm', rate, rateAbs, rateHigh, rateLow)

    const buffer = await this.port.send_command(Buffer.from([
      0x50, 3, axisOp, direction, rateHigh, rateLow, 0, 0
    ]))

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async getTrackingMode() {
    const buffer = await this.port.send_command('t')

    if (buffer.length !== 2) throw new Error('Invalid size')

    return buffer[0]
  }

  async setTrackingMode(mode) {
    const buffer = await this.port.send_command(Buffer.from([0x54, mode]))

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async isAlignComplete() {
    const buffer = await this.port.send_command('J')

    if (buffer.length !== 2) throw new Error('Invalid size')

    return buffer[0] === 1
  }

  async isGotoInProgress() {
    const buffer = await this.port.send_command('L')

    if (buffer.length !== 2) throw new Error('Invalid size')

    // 0x30 = '0'
    // 0x31 = '1'
    return buffer[0] === 0x31
  }

  async cancelGoto() {
    const buffer = await this.port.send_command('M')

    if (buffer.length !== 1) throw new Error('Invalid size')
  }

  async echo(ch) {
    const buffer = await this.port.send_command(`K${ch}`)

    if (buffer.length !== 2) throw new Error('Invalid size')

    return String.fromCharCode(buffer[0]);
  }
}

/*
(async () => {
  const telescope = new CelestronAVX()

  console.log(await telescope.version())
  //console.log(await telescope.model())
  console.log(await telescope.echo('x'))
  console.log(await telescope.isAlignComplete())
  console.log(await telescope.isGotoInProgress())

  await telescope.close()
})()
*/

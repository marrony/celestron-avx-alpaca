"use strict";

import { SerialPort } from 'serialport';

export class CelestronAVX {
  constructor() {
    this.port = new SerialPort({path: '/dev/ttyUSB0', baudRate: 9600});
    this.buffer = Buffer.alloc(0)

    this.port.on('data', data => {
      this.buffer = Buffer.concat([this.buffer, data])

      const length = this.buffer.length

      //if (length > 0 && this.buffer[length - 1] === 0x23) {
      if (length > 0 && this.buffer.indexOf(0x23) !== -1) {
        this.resolve_command(this.buffer)

        this.buffer = Buffer.alloc(0)

        this.resolve_command = undefined
        this.reject_command = undefined
      }
    })
  }

  async send_command(cmd) {
    if (this.resolve_command || this.reject_command)
      return Promise.reject(new Error('Telescope is busy'))

    return new Promise((resolve, reject) => {
      this.resolve_command = resolve
      this.reject_command = reject
      this.port.write(cmd)

      setTimeout(() => {
        if (this.reject_command) {
          console.error('Command timeout: device did not respond')
	  this.reject_command(new Error('Command timeout'))
        }
      }, 3500)
    })
  }

  async close() {
    this.port.close()
  }
}

/*
(async () => {
  const telescope = new CelestronAVX()

  console.log('send command V:', await telescope.send_command('V'))
  console.log('send command J:', await telescope.send_command('J'))
  console.log('send command L:', await telescope.send_command('L'))

  await telescope.close()
})()
*/

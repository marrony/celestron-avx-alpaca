"use strict";

import express from 'express'
import {
  CelestronAVX,
  TrackingModes,
  EquatorialSystems,
  AlignmentModes
} from './serial.js'

const app = express()
const port = 3000

const celestron = new CelestronAVX({simulator: true})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

//GET /management/apiversions?ClientID=4030&ClientTransactionID=3
app.get('/management/apiversions', (req, res) => {
  res.status(200).json({
    Value: [
      1, 2, 3, 4
    ],
    ClientTransactionID: parseInt(req.query.ClientTransactionID),
    ServerTransactionID: parseInt(req.query.ClientTransactionID)
  })
})

//GET /management/v1/description?ClientID=4030&ClientTransactionID=3
app.get('/management/v1/description', (req, res) => {
  res.status(200).json({
    Value: {
      ServerName: 'my server',
      Manufacturer: 'Marrony',
      ManufacturerVersion: '0.0.1',
      Location: 'US'
    },
    ClientTransactionID: parseInt(req.query.ClientTransactionID),
    ServerTransactionID: parseInt(req.query.ClientTransactionID)
  })
})

//GET /management/v1/configureddevices?ClientID=4030&ClientTransactionID=28
app.get('/management/v1/configureddevices', async (req, res) => {
  const model = await celestron.model()

  res.status(200).json({
    Value: [
      {
        DeviceName: model,
        DeviceType: 'telescope',
        DeviceNumber: 0,
        UniqueID: 'fb9472c8-6217-4140-9ebe-67d9ca0754c1' //crypto.randomUUID()
      }
    ],
    ClientTransactionID: parseInt(req.query.ClientTransactionID),
    ServerTransactionID: parseInt(req.query.ClientTransactionID)
  })
})

const telescope = {
  connected: {
    value: false,
    get: function (req) {
      return this.connected.value
    },
    set: function (req) {
      this.connected.value = req.body.Connected === 'true'
    }
  },

  slewing: {
    value: false,
    get: async function (req) {
      return this.slewing.value
    },
    set: async function (req) {
      throw new Error("slewing property is read-only")
    }
  },

  tracking: {
    value: undefined,
    get: async function (req) {
      if (this.tracking.value === undefined) {
        const trackingMode = await celestron.getTrackingMode()
        this.tracking.value = trackingMode !== TrackingModes.Off
      }

      return this.tracking.value
    },
    set: async function (req) {
      if (req.body.Tracking === 'true') {
        await celestron.setTrackingMode(TrackingModes.EqNorth)
        this.tracking.value = true
      } else {
        await celestron.setTrackingMode(TrackingModes.Off)
        this.tracking.value = false
      }
    }
  },

  rightascension: {
    value: 0,
    get: async function (req) {
      const [ra, dec] = await celestron.getRaDec()
      this.rightascension.value = ra
      this.declination.value = dec

      const raH = Math.trunc(ra)
      const raM = Math.trunc((ra - raH) * 60)
      const raS = Math.trunc(((ra - raH) * 60 - raM) * 60 * 100) / 100

      const decG = Math.trunc(dec)
      const decM = Math.trunc((dec - decG) * 60)
      const decS = Math.trunc(((dec - decG) * 60 - decM) * 60 * 100) / 100

      console.log(`RA: ${raH}h ${raM}m ${raS}s`)
      console.log(`Dec: ${decG} ${decM}' ${decS}"`)

      return ra
    },
    set: async function (req) {}
  },

  declination: {
    value: 0,
    get: async function (req) {
      //const [_, dec] = await celestron.getRaDec()
      //return dec
      return this.declination.value
    },
    set: async function (req) {}
  },

  // methods
  slewtocoordinatesasync: {
    get: async function (req) { },
    set: async function (req) {
      const ra = parseFloat(req.body.RightAscension)
      const dec = parseFloat(req.body.Declination)
      await celestron.gotoRaDec(ra, dec)
    }
  },

  synctocoordinates: {
    get: async function (req) {},
    set: async function (req) {
      const ra = parseFloat(req.body.RightAscension)
      const dec = parseFloat(req.body.Declination)
      await celestron.gotoRaDec(ra, dec)
    }
  },

  abortslew: {
    get: async function (req) {},
    set: async function (req) {
      this.slewing.value = false
      this.tracking.value = true
    }
  },

  moveaxis: {
    get: async function (req) {},
    set: async function (req) {
      if (req.body.Axis === undefined) {
        throw new Error("Axis is required")
      }

      if (req.body.Rate === undefined) {
        throw new Error("Rate is required")
      }

      const axis = parseInt(req.body.Axis)
      const rate = parseFloat(req.body.Rate)

      if (axis === null || isNaN(axis)) {
        throw new Error("Invalid axis")
      }

      if (rate === null || isNaN(rate)) {
        throw new Error("Invalid rate")
      }

      if (rate !== 0) {
        await celestron.setTrackingMode(TrackingModes.Off)
      }

      if (axis === 0 || axis === 1) {
        await celestron.slewVariable(axis, rate)
      }

      this.slewing.value = rate !== 0
      this.tracking.value = rate === 0

      if (rate === 0) {
        await celestron.setTrackingMode(TrackingModes.EqNorth)
      }
    }
  },

  // features
  canslew: {
    get: function (req) {
      return false
    },
    set: function (req) {}
  },

  canslewasync: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  canslewaltaz: {
    get: function (req) {
      return false
    },
    set: function (req) {}
  },

  canslewaltazasync: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  cansync: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  cansyncaltaz: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  canpark: {
    get: function (req) {
      return false
    },
    set: function (req) {}
  },

  cansettracking: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  cansetrightascensionrate: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  cansetdeclinationrate: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  cansetguiderates: {
    get: function (req) {
      return false
    },
    set: function (req) {}
  },

  cansetpark: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  cansetpierside: {
    get: function (req) {
      return false
    },
    set: function (req) {}
  },

  canmoveaxis: {
    get: function (req) {
      return true
    },
    set: function (req) {}
  },

  name: {
    get: function (req) {
      return 'Telescope'
    },
    set: function (req) {
    }
  },

  interfaceversion: {
    get: function (req) {
      return 0
    },
    set: function (req) {
    }
  },

  driverinfo: {
    get: function (req) {
      return 'Telescope'
    },
    set: function (req) {
    }
  },

  driverversion: {
    get: function (req) {
      return '0.0.1'
    },
    set: function (req) {
    }
  },

  description: {
    get: function (req) {
      return 'Telescope'
    },
    set: function (req) {
    }
  },

  supportedactions: {
    get: function (req) {
      return []
    },
    set: function (req) {
    }
  },

  axisrates: {
    get: function (req) {
      const axis = parseInt(req.query.Axis)
      //360/(23*60*60 + 56*60) = 0.004178272981
      //361/(24*60*60)         = 0.004178240741

      const siderealRate = 361 / (24*60*60)

      return [
        {
          Minimum: 2*siderealRate,
          Maximum: 2*siderealRate
        },
        {
          Minimum: 4*siderealRate,
          Maximum: 4*siderealRate
        },
        {
          Minimum: 8*siderealRate,
          Maximum: 8*siderealRate
        },
        {
          Minimum: 16*siderealRate,
          Maximum: 16*siderealRate
        },
        {
          Minimum: 32*siderealRate,
          Maximum: 32*siderealRate
        },
        {
          Minimum: 0.3,
          Maximum: 0.3
        },
        {
          Minimum: 1,
          Maximum: 1
        },
        {
          Minimum: 2,
          Maximum: 2
        },
        {
          Minimum: 4,
          Maximum: 4
        },
      ]
    },
    set: function (req) {}
  },

  equatorialsystem: {
    get: function (req) {
      return EquatorialSystems.JNow
    },
    set: function (req) {}
  },

  alignmentmode: {
    get: function(req) {
      return AlignmentModes.German
    },
    set: function (req) {}
  },
}

app.all('/api/v1/:device_type/:device_number/:property', async (req, res) => {
  //console.log(req.method, req.url)
  //console.log(req.query)

  if (req.params.device_type !== 'telescope') {
    return res.status(400).send('Invalid device type')
  }

  if (req.params.device_number !== '0') {
    return res.status(400).send('Invalid device number')
  }

  if (!(req.method === 'GET' || req.method === 'PUT')) {
    return res.status(405).send('Method not allowed')
  }

  const property = telescope[req.params.property]

  if (!property) {
    console.log(req.method, req.url)
    console.log('Not implemented')
    return res.status(405).send('Not implemented')
  }

  var data = {
    ErrorNumber: 0,
    ErrorMessage: '',
    Value: ''
  }

  const fixCase = (obj) => {
    Object.keys(obj).forEach(k => {
      const lower = k.toLowerCase()

      if (lower === 'clienttransactionid' || lower === 'clientid') {
        obj[lower] = obj[k]
      }
    })
  }

  fixCase(req.query)
  fixCase(req.body)

  if (req.method === 'GET') {

    const clientid = parseInt(req.query.clientid)
    if (clientid === null || isNaN(clientid) || clientid < 0) {
      return res.status(400).send('Invalid ClientID')
    }

		data.ClientTransactionID = parseInt(req.query.clienttransactionid)
		if (data.ClientTransactionID === null ||
				isNaN(data.ClientTransactionID) ||
				data.ClientTransactionID < 0) {
			return res.status(400).send('Invalid ClientTransactionID')
    }

    data.ServerTransactionID = parseInt(req.query.clienttransactionid)

    data.Value = await property.get.call(telescope, req)
    console.log(req.method, req.url, data.Value)
  } else if (req.method === 'PUT') {
    console.log(req.method, req.url, req.body)

    //todo: check why I should return 0 on case issues
    if (req.body.ClientTransactionID === undefined) {
      data.ClientTransactionID = 0
    } else {
			data.ClientTransactionID = parseInt(req.body.clienttransactionid)
			if (data.ClientTransactionID === null ||
					isNaN(data.ClientTransactionID) ||
					data.ClientTransactionID < 0) {
				return res.status(400).send('Invalid ClientTransactionID')
			}
    }
    
    const clientid = parseInt(req.body.clientid)
    if (clientid === null || isNaN(clientid) || clientid < 0) {
      return res.status(400).send('Invalid ClientID')
    }

    data.ServerTransactionID = parseInt(req.body.clienttransactionid)

    try {
      await property.set.call(telescope, req)
    } catch (e) {
			return res.status(400).send('Bad parameter')
    }
  }

  //console.log(data)
  res.status(200).json(data)
})

app.all('*', (req, res) => {
  console.log(req.method, req.url)
  console.log(req.method, req.query)
  console.log('Endpoint not registered')
  res.status(500).send('Endpoint not registered')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})



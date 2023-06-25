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

const celestron = new CelestronAVX()

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
    get: async function (req) {
      return await celestron.isGotoInProgress()
    },
    set: async function (req) {}
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

  moveaxis: {
    get: async function (req) {},
    set: async function (req) {
      const axis = parseInt(req.body.Axis)
      const rate = parseFloat(req.body.Rate)

      if (axis === 0) {
        await celestron.slewAzmVariable(rate)
      }

      //if (this.tracking.value) {
      //  await celestron.setTrackingMode(TrackingModes.Off)
      //  this.tracking.value = false
      //}
    }
  },

  // features
  canslew: {
    get: function (req) {
      return true
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
      return true
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

  canmoveaxis: {
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

  axisrates: {
    get: function (req) {
      const axis = parseInt(req.query.Axis)
      return [
        {
          Minimum: 1,
          Maxinum: 1
        }
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

app.all('/api/v1/telescope/0/:property', async (req, res) => {
  console.log(req.method, req.url)
  //console.log(req.query)

  const property = telescope[req.params.property]

  if (!property || !(req.method === 'GET' || req.method === 'PUT')) {
    console.log('Not implemented')
    return res.status(500).send('Not implemented')
  }

  var data = {
    ErrorNumber: 0,
    ErrorMessage: '',
    Value: ''
  }

  if (req.method === 'GET') {
    data.Value = await property.get.call(telescope, req)
    data.ClientTransactionID = parseInt(req.query.ClientTransactionID)
    data.ServerTransactionID = parseInt(req.query.ClientTransactionID)
  } else if (req.method === 'PUT') {
    console.log(req.body)
    await property.set.call(telescope, req)
    data.ClientTransactionID = parseInt(req.body.ClientTransactionID)
    data.ServerTransactionID = parseInt(req.body.ClientTransactionID)
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



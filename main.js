"use strict";

import express from 'express'
import { CelestronAVX } from './serial.js'

console.log(CelestronAVX)

const app = express()
const port = 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

//GET /management/apiversions?ClientID=4030&ClientTransactionID=3
app.get('/management/apiversions', (req, res) => {
  console.log('GET', req.url)
  console.log(req.query)
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
  console.log('GET', req.url)
  console.log(req.query)
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
app.get('/management/v1/configureddevices', (req, res) => {
  console.log('GET', req.url)
  console.log(req.query)
  res.status(200).json({
    Value: [
      {
        DeviceName: 'Celestron AVX',
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
    get: function(req) {
      return this.connected.value
    },
    set: function(req) {
      this.connected.value = req.body.Connected === 'true'
    }
  },

  slewing: {
    value: false,
    get: function(req) {
      return this.slewing.value
    },
    set: function(req) {}
  },

  tracking: {
    value: false,
    get: function(req) {
      return this.tracking.value
    },
    set: function(req) {
      this.tracking.value = req.body.Tracking === 'true'
    }
  },

  rightascension: {
    value: 0,
    get: function(req) {
      return this.rightascension.value
    },
    set: function(req) {}
  },

  declination: {
    value: 0,
    get: function(req) {
      return this.declination.value
    },
    set: function (req) {}
  },

  // methods
  slewtocoordinatesasync: {
    get: function(req) {},
    set: function(req) {
      this.rightascension.value = parseFloat(req.body.RightAscension)
      this.declination.value = parseFloat(req.body.Declination)
    }
  },

  synctocoordinates: {
    get: function(req) {},
    set: function(req) {
      this.rightascension.value = parseFloat(req.body.RightAscension)
      this.declination.value = parseFloat(req.body.Declination)
    }
  },

  // features
  canslewasync: {
    get: function(req) {
      return true
    },
    set: function (req) {}
  },

  canslewaltazasync: {
    get: function(req) {
      return true
    },
    set: function (req) {}
  },

  cansync: {
    get: function(req) {
      return true
    },
    set: function (req) {}
  },

  cansyncaltaz: {
    get: function(req) {
      return true
    },
    set: function (req) {}
  },

  canpark: {
    get: function(req) {
      return false
    },
    set: function (req) {}
  },

  cansettracking: {
    get: function(req) {
      return true
    },
    set: function (req) {}
  },

  canmoveaxis: {
    get: function(req) {
      return false
    },
    set: function (req) {}
  },

//Other	0	Custom or unknown equinox and/or reference frame.
//Topocentric	1	Topocentric coordinates.Coordinates of the object at the current date having allowed for annual aberration, precession and nutation.This is the most common coordinate type for amateur telescopes.
//J2000	2	J2000 equator/equinox.Coordinates of the object at mid-day on 1st January 2000, ICRS reference frame.
//J2050	3	J2050 equator/equinox, ICRS reference frame.
//B1950	4	B1950 equinox, FK4 reference frame.
  equatorialsystem: {
    get: function(req) {
      return 1
    },
    set: function (req) {}
  },

//AltAz	0	Altitude-Azimuth alignment.
//Polar	1	Polar(equatorial) mount other than German equatorial.
//GermanPolar	2	German equatorial mount.
  alignmentmode: {
    get: function(req) {
      return 1
    },
    set: function (req) {}
  },
}

app.all('/api/v1/telescope/0/:property', (req, res) => {
  console.log(req.method, req.url)
  console.log(req.query)
  console.log(req.params)

  const property = telescope[req.params.property]
  console.log('property', property)

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
    data.Value = property.get.call(telescope, req)
    data.ClientTransactionID = parseInt(req.query.ClientTransactionID)
    data.ServerTransactionID = parseInt(req.query.ClientTransactionID)
  } else if (req.method === 'PUT') {
    console.log(req.body)

    property.set.call(telescope, req)
    data.ClientTransactionID = parseInt(req.body.ClientTransactionID)
    data.ServerTransactionID = parseInt(req.body.ClientTransactionID)
  }

  console.log(data)
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



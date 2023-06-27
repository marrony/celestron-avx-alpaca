import express from "express";

import {
  CelestronAVX,
  TrackingModes,
  EquatorialSystems,
  AlignmentModes,
} from "./serial.js";

const app = express();
const port = 3000;

const celestron = new CelestronAVX({ simulator: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

type Transaction = {
  ClientID: string;
  ClientTransactionID: string;
  [key: string]: string;
};

interface TypedRequest<T = {}> extends express.Request {
  query: Transaction & T;
  body: Transaction & T;
}

interface AlpacaResponse {
  ErrorNumber: number;
  ErrorMessage: string;
  Value: any;
  ServerTransactionID: number;
  ClientTransactionID: number;
}

interface TypedResponse extends express.Response<AlpacaResponse | string> {}

//GET /management/apiversions?ClientID=4030&ClientTransactionID=3
app.get("/management/apiversions", (req: TypedRequest, res: TypedResponse) => {
  res.status(200).json({
    Value: [1, 2, 3, 4],
    ClientTransactionID: parseInt(req.query.ClientTransactionID!),
    ServerTransactionID: parseInt(req.query.ClientTransactionID!),
    ErrorNumber: 0,
    ErrorMessage: "",
  });
});

//GET /management/v1/description?ClientID=4030&ClientTransactionID=3
app.get(
  "/management/v1/description",
  (req: TypedRequest, res: TypedResponse) => {
    res.status(200).json({
      Value: {
        ServerName: "my server",
        Manufacturer: "Marrony",
        ManufacturerVersion: "0.0.1",
        Location: "US",
      },
      ClientTransactionID: parseInt(req.query.ClientTransactionID),
      ServerTransactionID: parseInt(req.query.ClientTransactionID),
      ErrorNumber: 0,
      ErrorMessage: "",
    });
  }
);

//GET /management/v1/configureddevices?ClientID=4030&ClientTransactionID=28
app.get(
  "/management/v1/configureddevices",
  async (req: TypedRequest, res: TypedResponse) => {
    const model = await celestron.model();

    res.status(200).json({
      Value: [
        {
          DeviceName: model,
          DeviceType: "telescope",
          DeviceNumber: 0,
          UniqueID: "fb9472c8-6217-4140-9ebe-67d9ca0754c1", //crypto.randomUUID()
        },
      ],
      ClientTransactionID: parseInt(req.query.ClientTransactionID),
      ServerTransactionID: parseInt(req.query.ClientTransactionID),
      ErrorNumber: 0,
      ErrorMessage: "",
    });
  }
);

const telescope: Record<string, any> = {
  connected: {
    value: false,
    get: function (req: TypedRequest) {
      return this.connected.value;
    },
    set: function (req: TypedRequest<{ Connected?: string }>) {
      if (req.body.Connected === undefined) {
        throw new Error("Connected is required");
      }

      const connected = req.body.Connected.toLowerCase();

      if (connected === "true" || connected === "false") {
        this.connected.value = connected === "true";
      } else {
        throw new Error("Invalid connected value");
      }
    },
  },

  slewing: {
    value: false,
    get: async function (req: TypedRequest) {
      return this.slewing.value;
    },
  },

  ispulseguiding: {
    value: false,
    get: async function (req: TypedRequest) {
      return this.ispulseguiding.value;
    },
  },

  tracking: {
    value: undefined,
    get: async function (req: TypedRequest) {
      if (this.tracking.value === undefined) {
        const trackingMode = await celestron.getTrackingMode();
        this.tracking.value = trackingMode !== TrackingModes.Off;
      }

      return this.tracking.value;
    },
    set: async function (req: TypedRequest<{ Tracking?: string }>) {
      if (req.body.Tracking === undefined) {
        throw new Error("Tracking is required");
      }

      const tracking = req.body.Tracking.toLowerCase();

      if (tracking === "true" || tracking === "false") {
        if (tracking === "true") {
          await celestron.setTrackingMode(TrackingModes.EqNorth);
          this.tracking.value = true;
        } else {
          await celestron.setTrackingMode(TrackingModes.Off);
          this.tracking.value = false;
        }
      } else {
        throw new Error("Invalid tracking value");
      }
    },
  },

  rightascensionrate: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.rightascensionrate.value;
    },
    set: async function (req: TypedRequest) {},
  },

  declinationrate: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.declinationrate.value;
    },
    set: async function (req: TypedRequest) {},
  },

  doesrefraction: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.doesrefraction.value;
    },
    set: async function (req: TypedRequest) {},
  },

  guideratedeclination: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.guideratedeclination.value;
    },
    set: async function (req: TypedRequest) {},
  },

  guideraterightascension: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.guideratedeclination.value;
    },
    set: async function (req: TypedRequest) {},
  },

  sideofpier: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.sideofpier.value;
    },
    set: async function (req: TypedRequest) {},
  },

  siteelevation: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.siteelevation.value;
    },
    set: async function (req: TypedRequest) {},
  },

  sitelatitude: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.sitelatitude.value;
    },
    set: async function (req: TypedRequest) {},
  },

  sitelongitude: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.sitelongitude.value;
    },
    set: async function (req: TypedRequest) {},
  },

  slewsettletime: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.slewsettletime.value;
    },
    set: async function (req: TypedRequest) {},
  },

  targetdeclination: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.targetdeclination.value;
    },
    set: async function (req: TypedRequest) {},
  },

  targetrightascension: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.targetrightascension.value;
    },
    set: async function (req: TypedRequest) {},
  },

  trackingrate: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.trackingrate.value;
    },
    set: async function (req: TypedRequest) {},
  },

  utcdate: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.utcdate.value;
    },
    set: async function (req: TypedRequest) {},
  },

  siderealtime: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.sideofpier.value;
    },
    //set: async function (req: TypedRequest) {}
  },

  rightascension: {
    value: 0,
    get: async function (req: TypedRequest) {
      const [ra, dec] = await celestron.getRaDec();
      this.rightascension.value = ra;
      this.declination.value = dec;

      const raH = Math.trunc(ra);
      const raM = Math.trunc((ra - raH) * 60);
      const raS = Math.trunc(((ra - raH) * 60 - raM) * 60 * 100) / 100;

      const decG = Math.trunc(dec);
      const decM = Math.trunc((dec - decG) * 60);
      const decS = Math.trunc(((dec - decG) * 60 - decM) * 60 * 100) / 100;

      console.log(`RA: ${raH}h ${raM}m ${raS}s`);
      console.log(`Dec: ${decG} ${decM}' ${decS}"`);

      return ra;
    },
  },

  declination: {
    value: 0,
    get: async function (req: TypedRequest) {
      //const [_, dec] = await celestron.getRaDec()
      //return dec
      return this.declination.value;
    },
  },

  altitude: {
    value: 0,
    get: async function (req: TypedRequest) {
      const [alt, azm] = await celestron.getAltAzm();

      this.altitude.value = alt;
      this.azimuth.value = azm;

      return alt;
    },
  },

  azimuth: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.azimuth.value;
    },
  },

  destinationsideofpier: {
    value: 0,
    get: async function (req: TypedRequest) {
      return this.destinationsideofpier.value;
    },
  },

  ////////////////////////////////////////////////////////////////////

  // methods
  slewtocoordinatesasync: {
    set: async function (
      req: TypedRequest<{ RightAscension?: string; Declination?: string }>
    ) {
      const ra = parseFloat(req.body.RightAscension ?? "0");
      const dec = parseFloat(req.body.Declination ?? "0");
      await celestron.gotoRaDec(ra, dec);
    },
  },

  slewtocoordinates: {
    set: async function (
      req: TypedRequest<{ RightAscension?: string; Declination?: string }>
    ) {
      const ra = parseFloat(req.body.RightAscension ?? "0");
      const dec = parseFloat(req.body.Declination ?? "0");
      await celestron.gotoRaDec(ra, dec);
    },
  },

  synctocoordinates: {
    set: async function (
      req: TypedRequest<{ RightAscension?: string; Declination?: string }>
    ) {
      const ra = parseFloat(req.body.RightAscension ?? "0");
      const dec = parseFloat(req.body.Declination ?? "0");
      await celestron.gotoRaDec(ra, dec);
    },
  },

  synctoaltaz: {
    set: async function (req: TypedRequest) {},
  },

  synctotarget: {
    set: async function (req: TypedRequest) {},
  },

  slewtoaltazasync: {
    set: async function (req: TypedRequest) {},
  },

  slewtoaltaz: {
    set: async function (req: TypedRequest) {},
  },

  slewtotarget: {
    set: async function (req: TypedRequest) {},
  },

  slewtotargetasync: {
    set: async function (req: TypedRequest) {},
  },

  abortslew: {
    set: async function (req: TypedRequest) {
      this.slewing.value = false;
      this.tracking.value = true;
    },
  },

  moveaxis: {
    set: async function (req: TypedRequest<{ Axis?: string; Rate?: string }>) {
      if (req.body.Axis === undefined) {
        throw new Error("Axis is required");
      }

      if (req.body.Rate === undefined) {
        throw new Error("Rate is required");
      }

      const axis = parseInt(req.body.Axis);
      const rate = parseFloat(req.body.Rate);

      if (axis === null || isNaN(axis)) {
        throw new Error("Invalid axis");
      }

      if (rate === null || isNaN(rate)) {
        throw new Error("Invalid rate");
      }

      if (rate !== 0) {
        await celestron.setTrackingMode(TrackingModes.Off);
      }

      if (axis === 0 || axis === 1) {
        await celestron.slewVariable(axis, rate);
      }

      this.slewing.value = rate !== 0;
      this.tracking.value = rate === 0;

      if (rate === 0) {
        await celestron.setTrackingMode(TrackingModes.EqNorth);
      }
    },
  },

  pulseguide: {
    set: function (req: TypedRequest) {
      this.ispulseguiding.value = false;
    },
  },

  park: {
    set: function (req: TypedRequest) {},
  },

  unpark: {
    set: function (req: TypedRequest) {},
  },

  setpark: {
    set: function (req: TypedRequest) {},
  },

  findhome: {
    set: function (req: TypedRequest) {},
  },

  ////////////////////////////////////////////////////////////////////

  // features
  canslew: {
    get: function (req: TypedRequest) {
      return false;
    },
  },

  canslewasync: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  canslewaltaz: {
    get: function (req: TypedRequest) {
      return false;
    },
  },

  canslewaltazasync: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  cansync: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  cansyncaltaz: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  canpark: {
    get: function (req: TypedRequest) {
      return false;
    },
  },

  canunpark: {
    get: function (req: TypedRequest) {
      return false;
    },
  },

  cansettracking: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  cansetrightascensionrate: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  cansetdeclinationrate: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  cansetguiderates: {
    get: function (req: TypedRequest) {
      return false;
    },
  },

  cansetpark: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  cansetpierside: {
    get: function (req: TypedRequest) {
      return false;
    },
  },

  canmoveaxis: {
    get: function (req: TypedRequest) {
      return true;
    },
  },

  canpulseguide: {
    get: function (req: TypedRequest) {
      return false;
    },
  },

  name: {
    get: function (req: TypedRequest) {
      return "Telescope";
    },
  },

  interfaceversion: {
    get: function (req: TypedRequest) {
      return 0;
    },
  },

  driverinfo: {
    get: function (req: TypedRequest) {
      return "Telescope";
    },
  },

  driverversion: {
    get: function (req: TypedRequest) {
      return "0.0.1";
    },
  },

  description: {
    get: function (req: TypedRequest) {
      return "Telescope";
    },
  },

  supportedactions: {
    get: function (req: TypedRequest) {
      return [];
    },
  },

  axisrates: {
    get: async function (req: TypedRequest<{ Axis?: string }>): Promise<any> {
      if (req.query.Axis === undefined) {
        throw new Error("Axis is required");
      }

      const axis = parseInt(req.query.Axis);

      if (axis === null || isNaN(axis)) {
        throw new Error("Invalid axis");
      }

      //360/(23*60*60 + 56*60) = 0.004178272981
      //361/(24*60*60)         = 0.004178240741

      const siderealRate = 361 / (24 * 60 * 60);

      return [
        {
          Minimum: 2 * siderealRate,
          Maximum: 2 * siderealRate,
        },
        {
          Minimum: 4 * siderealRate,
          Maximum: 4 * siderealRate,
        },
        {
          Minimum: 8 * siderealRate,
          Maximum: 8 * siderealRate,
        },
        {
          Minimum: 16 * siderealRate,
          Maximum: 16 * siderealRate,
        },
        {
          Minimum: 32 * siderealRate,
          Maximum: 32 * siderealRate,
        },
        {
          Minimum: 0.3,
          Maximum: 0.3,
        },
        {
          Minimum: 1,
          Maximum: 1,
        },
        {
          Minimum: 2,
          Maximum: 2,
        },
        {
          Minimum: 4,
          Maximum: 4,
        },
      ];
    },
  },

  equatorialsystem: {
    get: function (req: TypedRequest) {
      return EquatorialSystems.JNow;
    },
  },

  alignmentmode: {
    get: function (req: TypedRequest) {
      return AlignmentModes.German;
    },
  },

  aperturearea: {
    get: function (req: TypedRequest) {
      return 0;
    },
  },

  aperturediameter: {
    get: function (req: TypedRequest) {
      return 0;
    },
  },

  focallength: {
    get: function (req: TypedRequest) {
      return 0;
    },
  },

  athome: {
    get: function (req: TypedRequest) {
      return false;
    },
  },

  atpark: {
    get: function (req: TypedRequest) {
      return false;
    },
  },
};

app.all(
  "/api/v1/:device_type/:device_number/:operation",
  async (req: TypedRequest, res: TypedResponse) => {
    const fixCase = (obj: Transaction) => {
      Object.keys(obj).forEach((k) => {
        const lower = k.toLowerCase();

        if (lower === "clienttransactionid") obj.ClientTransactionID = obj[k];
        if (lower === "clientid") obj.ClientID = obj[k];
      });
    };

    //console.log(req.method, req.url)
    //console.log(req.query)

    if (req.params.device_type !== "telescope") {
      return res.status(400).send("Invalid device type");
    }

    if (req.params.device_number !== "0") {
      return res.status(400).send("Invalid device number");
    }

    if (!(req.method === "GET" || req.method === "PUT")) {
      return res.status(405).send("Method not allowed");
    }

    const operation = telescope[req.params.operation];

    if (!operation) {
      console.log(req.method, req.url);
      console.log("Not implemented");
      return res.status(405).send("Not implemented");
    }

    const data: AlpacaResponse = {
      ErrorNumber: 0,
      ErrorMessage: "",
      Value: "",
      ClientTransactionID: 0,
      ServerTransactionID: 0,
    };

    if (req.method === "GET") {
      fixCase(req.query);

      const clientID = parseInt(req.query.ClientID);
      if (clientID === null || isNaN(clientID) || clientID < 0) {
        return res.status(400).send("Invalid ClientID");
      }

      data.ClientTransactionID = parseInt(req.query.ClientTransactionID);
      if (
        data.ClientTransactionID === null ||
        isNaN(data.ClientTransactionID) ||
        data.ClientTransactionID < 0
      ) {
        return res.status(400).send("Invalid ClientTransactionID");
      }

      data.ServerTransactionID = parseInt(req.query.ClientTransactionID);

      try {
        data.Value = await operation.get.call(telescope, req);
        console.log(req.method, req.url, data.Value);
      } catch (e) {
        return res.status(400).send("Bad parameter");
      }
    } else if (req.method === "PUT") {
      if (req.body.ClientTransactionID === undefined) {
        data.ClientTransactionID = 0;
        data.ServerTransactionID = 1;
      } else {
        data.ClientTransactionID = parseInt(req.body.ClientTransactionID);
      }

      console.log(req.method, req.url, req.body);

      fixCase(req.body);

      if (
        data.ClientTransactionID === null ||
        isNaN(data.ClientTransactionID) ||
        data.ClientTransactionID < 0
      ) {
        return res.status(400).send("Invalid ClientTransactionID");
      }

      const clientID = parseInt(req.body.ClientID);
      if (clientID === null || isNaN(clientID) || clientID < 0) {
        return res.status(400).send("Invalid ClientID");
      }

      data.ServerTransactionID = 1;

      try {
        await operation.set.call(telescope, req);
      } catch (e) {
        return res.status(400).send("Bad parameter");
      }
    }

    //console.log(data)
    res.status(200).json(data);
  }
);

app.all("*", (req: TypedRequest, res: TypedResponse) => {
  console.log(req.method, req.url);
  console.log(req.method, req.query);
  console.log("Endpoint not registered");
  res.status(500).send("Endpoint not registered");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

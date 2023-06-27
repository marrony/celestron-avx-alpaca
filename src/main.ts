import express from "express";
import { program, InvalidArgumentError } from "commander";
import {
  CelestronAVX,
  TrackingModes,
  EquatorialSystems,
  AlignmentModes,
} from "./serial.js";

function parseIntOption(value: string) {
  const parsedValue = parseInt(value, 10);

  if (isNaN(parsedValue)) {
    throw new InvalidArgumentError("Not a number.");
  }

  return parsedValue;
}

const pkg = require("../package.json");

program.name(pkg.name).description(pkg.description).version(pkg.version);

program.option("-d, --device <string>", "USB device", "/dev/ttyUSB0");

program.option("-b, --baud <number>", "Baud rate", parseIntOption, 9600);

program.option("-p, --port <number>", "Port to listen", parseIntOption, 11111);

program.option("-s, --simulator", "Runs the simulator", false);

program.parse();

const options = program.opts();
const app = express();

const port = options.port;
const path = options.device;
const baudRate = options.baud;
const simulator = options.simulator;

const celestron = new CelestronAVX({ path, baudRate, simulator });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const caseInsensitive = (obj: Record<string, any>) => {
  return new Proxy(obj, {
    get: (target, name) => {
      const prop = Object.keys(target).find(
        (key) => key.toLowerCase() === name.toString().toLowerCase()
      );
      return prop ? target[prop] : undefined;
    },
  });
};

app.use((req, res, next) => {
  req.query = caseInsensitive(req.query);
  next();
});

type AlpacaRequest<T = {}> = {
  ClientID: string;
  ClientTransactionID: string;
} & T;

type AlpacaResponse<T = any> = {
  ErrorNumber: number;
  ErrorMessage: string;
  Value: T;
  ServerTransactionID: number;
  ClientTransactionID: number;
};

type AlpacaOperation<T = any> = {
  get?: (req: AlpacaRequest) => Promise<T>;
  set?: (req: AlpacaRequest) => Promise<void>;
};

type AlpacaProperty<T> = AlpacaOperation<T> & {
  value: T;
};

type AlpacaReadOnlyProperty<T> = AlpacaProperty<T> & {
  get: (req: AlpacaRequest) => Promise<T>;
};

type AlpacaReadWriteProperty<T> = AlpacaProperty<T> & {
  get: (req: AlpacaRequest) => Promise<T>;
  set: (req: AlpacaRequest) => Promise<void>;
};

type AlpacaConstant<T> = AlpacaOperation<T> & {
  get: (req: AlpacaRequest) => Promise<T>;
};

type AlpacaMethod = AlpacaOperation & {
  set: (req: AlpacaRequest) => Promise<void>;
};

interface TypedRequest<T = {}> extends express.Request {
  query: AlpacaRequest<T>;
  body: AlpacaRequest<T>;
}

interface TypedResponse extends express.Response<AlpacaResponse | string> {}

app.get("/management/apiversions", (req: TypedRequest, res: TypedResponse) => {
  res.status(200).json({
    Value: [1, 2, 3, 4],
    ClientTransactionID: parseInt(req.query.ClientTransactionID!),
    ServerTransactionID: parseInt(req.query.ClientTransactionID!),
    ErrorNumber: 0,
    ErrorMessage: "",
  });
});

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

class TelescopeEndpoint {
  [key: string]: AlpacaOperation;

  connected: AlpacaReadWriteProperty<boolean> = {
    value: false,
    get: async (req: AlpacaRequest) => {
      return this.connected.value;
    },
    set: async (req: AlpacaRequest<{ Connected?: string }>) => {
      if (req.Connected === undefined) {
        throw new Error("Connected is required");
      }

      const connected = req.Connected.toLowerCase();

      if (connected === "true" || connected === "false") {
        this.connected.value = connected === "true";
      } else {
        throw new Error("Invalid connected value");
      }
    },
  };

  tracking: AlpacaReadWriteProperty<boolean | undefined> = {
    value: undefined,
    get: async (req: AlpacaRequest) => {
      if (this.tracking.value === undefined) {
        const trackingMode = await celestron.getTrackingMode();
        this.tracking.value = trackingMode !== TrackingModes.Off;
      }

      return this.tracking.value;
    },
    set: async (req: AlpacaRequest<{ Tracking?: string }>) => {
      if (req.Tracking === undefined) {
        throw new Error("Tracking is required");
      }

      const tracking = req.Tracking.toLowerCase();

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
  };

  rightascensionrate: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.rightascensionrate.value;
    },
    set: async (req: AlpacaRequest<{ RightAscensionRate?: string }>) => {
      if (req.RightAscensionRate === undefined) {
        throw new Error("RightAscensionRate is required");
      }
    },
  };

  declinationrate: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.declinationrate.value;
    },
    set: async (req: AlpacaRequest<{ DeclinationRate?: string }>) => {
      if (req.DeclinationRate === undefined) {
        throw new Error("DeclinationRate is required");
      }
    },
  };

  doesrefraction: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.doesrefraction.value;
    },
    set: async (req: AlpacaRequest<{ DoesRefraction?: string }>) => {
      if (req.DoesRefraction === undefined) {
        throw new Error("DoesRefraction is required");
      }
    },
  };

  guideratedeclination: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.guideratedeclination.value;
    },
    set: async (req: AlpacaRequest<{ GuideRateDeclination?: string }>) => {
      if (req.GuideRateDeclination === undefined) {
        throw new Error("GuideRateDeclination is required");
      }
    },
  };

  guideraterightascension: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.guideratedeclination.value;
    },
    set: async (req: AlpacaRequest<{ GuideRateRightAscension?: string }>) => {
      if (req.GuideRateRightAscension === undefined) {
        throw new Error("GuideRateRightAscension is required");
      }
    },
  };

  sideofpier: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.sideofpier.value;
    },
    set: async (req: AlpacaRequest<{ SideOfPier?: string }>) => {
      if (req.SideOfPier === undefined) {
        throw new Error("SideOfPier is required");
      }
    },
  };

  siteelevation: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.siteelevation.value;
    },
    set: async (req: AlpacaRequest<{ SiteElevation?: string }>) => {
      if (req.SiteElevation === undefined) {
        throw new Error("SiteElevation is required");
      }
    },
  };

  sitelatitude: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.sitelatitude.value;
    },
    set: async (req: AlpacaRequest<{ SiteLatitude?: string }>) => {
      if (req.SiteLatitude === undefined) {
        throw new Error("SiteLatitude is required");
      }
    },
  };

  sitelongitude: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.sitelongitude.value;
    },
    set: async (req: AlpacaRequest<{ SiteLongitude?: string }>) => {
      if (req.SiteLongitude === undefined) {
        throw new Error("SiteLongitude is required");
      }
    },
  };

  slewsettletime: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.slewsettletime.value;
    },
    set: async (req: AlpacaRequest<{ SlewSettleTime?: string }>) => {
      if (req.SlewSettleTime === undefined) {
        throw new Error("SlewSettleTime is required");
      }
    },
  };

  targetdeclination: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.targetdeclination.value;
    },
    set: async (req: AlpacaRequest<{ TargetDeclination?: string }>) => {
      if (req.TargetDeclination === undefined) {
        throw new Error("TargetDeclination is required");
      }
    },
  };

  targetrightascension: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.targetrightascension.value;
    },
    set: async (req: AlpacaRequest<{ TargetRightAscension?: string }>) => {
      if (req.TargetRightAscension === undefined) {
        throw new Error("TargetRightAscension is required");
      }
    },
  };

  trackingrate: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.trackingrate.value;
    },
    set: async (req: AlpacaRequest<{ TrackingRate?: string }>) => {
      if (req.TrackingRate === undefined) {
        throw new Error("TrackingRate is required");
      }
    },
  };

  utcdate: AlpacaReadWriteProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.utcdate.value;
    },
    set: async (req: AlpacaRequest<{ UTCDate?: string }>) => {
      if (req.UTCDate === undefined) {
        throw new Error("UTCDate is required");
      }
    },
  };

  // read-only properties

  slewing: AlpacaReadOnlyProperty<boolean> = {
    value: false,
    get: async (req: AlpacaRequest) => {
      return this.slewing.value;
    },
  };

  ispulseguiding: AlpacaReadOnlyProperty<boolean> = {
    value: false,
    get: async (req: AlpacaRequest) => {
      return this.ispulseguiding.value;
    },
  };

  siderealtime: AlpacaReadOnlyProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.sideofpier.value;
    },
  };

  rightascension: AlpacaReadOnlyProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
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
  };

  declination: AlpacaReadOnlyProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      //const [_, dec] = await celestron.getRaDec()
      //return dec
      return this.declination.value;
    },
  };

  altitude: AlpacaReadOnlyProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      const [alt, azm] = await celestron.getAltAzm();

      this.altitude.value = alt;
      this.azimuth.value = azm;

      return alt;
    },
  };

  azimuth: AlpacaReadOnlyProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.azimuth.value;
    },
  };

  destinationsideofpier: AlpacaReadOnlyProperty<number> = {
    value: 0,
    get: async (req: AlpacaRequest) => {
      return this.destinationsideofpier.value;
    },
  };

  ////////////////////////////////////////////////////////////////////

  // methods
  slewtocoordinatesasync: AlpacaMethod = {
    set: async (
      req: AlpacaRequest<{ RightAscension?: string; Declination?: string }>
    ) => {
      if (req.RightAscension === undefined) {
        throw new Error("RightAscension is required");
      }

      if (req.Declination === undefined) {
        throw new Error("Declination is required");
      }

      const ra = parseFloat(req.RightAscension);
      const dec = parseFloat(req.Declination);
      await celestron.gotoRaDec(ra, dec);
    },
  };

  slewtocoordinates: AlpacaMethod = {
    set: async (
      req: AlpacaRequest<{ RightAscension?: string; Declination?: string }>
    ) => {
      if (req.RightAscension === undefined) {
        throw new Error("RightAscension is required");
      }

      if (req.Declination === undefined) {
        throw new Error("Declination is required");
      }

      const ra = parseFloat(req.RightAscension);
      const dec = parseFloat(req.Declination);
      await celestron.gotoRaDec(ra, dec);
    },
  };

  synctocoordinates: AlpacaMethod = {
    set: async (
      req: AlpacaRequest<{ RightAscension?: string; Declination?: string }>
    ) => {
      if (req.RightAscension === undefined) {
        throw new Error("RightAscension is required");
      }

      if (req.Declination === undefined) {
        throw new Error("Declination is required");
      }

      const ra = parseFloat(req.RightAscension);
      const dec = parseFloat(req.Declination);
      await celestron.gotoRaDec(ra, dec);
    },
  };

  synctoaltaz: AlpacaMethod = {
    set: async (
      req: AlpacaRequest<{ Altitude?: string; Azimuth?: string }>
    ) => {
      if (req.Altitude === undefined) {
        throw new Error("Altitude is required");
      }

      if (req.Azimuth === undefined) {
        throw new Error("Azimuth is required");
      }
    },
  };

  synctotarget: AlpacaMethod = {
    set: async (req: AlpacaRequest) => {},
  };

  slewtoaltazasync: AlpacaMethod = {
    set: async (
      req: AlpacaRequest<{ Altitude?: string; Azimuth?: string }>
    ) => {
      if (req.Altitude === undefined) {
        throw new Error("Altitude is required");
      }

      if (req.Azimuth === undefined) {
        throw new Error("Azimuth is required");
      }
    },
  };

  slewtoaltaz: AlpacaMethod = {
    set: async (
      req: AlpacaRequest<{ Altitude?: string; Azimuth?: string }>
    ) => {
      if (req.Altitude === undefined) {
        throw new Error("Altitude is required");
      }

      if (req.Azimuth === undefined) {
        throw new Error("Azimuth is required");
      }
    },
  };

  slewtotarget: AlpacaMethod = {
    set: async (req: AlpacaRequest) => {},
  };

  slewtotargetasync: AlpacaMethod = {
    set: async (req: AlpacaRequest) => {},
  };

  abortslew: AlpacaMethod = {
    set: async (req: AlpacaRequest) => {
      this.slewing.value = false;
      this.tracking.value = true;
    },
  };

  moveaxis: AlpacaMethod = {
    set: async (req: AlpacaRequest<{ Axis?: string; Rate?: string }>) => {
      if (req.Axis === undefined) {
        throw new Error("Axis is required");
      }

      if (req.Rate === undefined) {
        throw new Error("Rate is required");
      }

      const axis = parseInt(req.Axis);
      const rate = parseFloat(req.Rate);

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
  };

  pulseguide: AlpacaMethod = {
    set: async (
      req: AlpacaRequest<{ Duration?: string; Direction?: string }>
    ) => {
      if (req.Duration === undefined) {
        throw new Error("Duration is required");
      }

      if (req.Direction === undefined) {
        throw new Error("Direction is required");
      }

      this.ispulseguiding.value = false;
    },
  };

  park: AlpacaMethod = {
    set: async (req: AlpacaRequest) => {},
  };

  unpark: AlpacaMethod = {
    set: async (req: AlpacaRequest) => {},
  };

  setpark: AlpacaMethod = {
    set: async (req: AlpacaRequest) => {},
  };

  findhome: AlpacaMethod = {
    set: async (req: AlpacaRequest) => {},
  };

  ////////////////////////////////////////////////////////////////////

  // features
  canslew: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };

  canslewasync: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  canslewaltaz: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };

  canslewaltazasync: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  cansync: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  cansyncaltaz: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  canpark: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };

  canunpark: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };

  cansettracking: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  cansetrightascensionrate: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  cansetdeclinationrate: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  cansetguiderates: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };

  cansetpark: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  cansetpierside: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };

  canmoveaxis: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return true;
    },
  };

  canpulseguide: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };

  name: AlpacaConstant<string> = {
    get: async (req: AlpacaRequest) => {
      return "Telescope";
    },
  };

  interfaceversion: AlpacaConstant<number> = {
    get: async (req: AlpacaRequest) => {
      return 0;
    },
  };

  driverinfo: AlpacaConstant<string> = {
    get: async (req: AlpacaRequest) => {
      return "Telescope";
    },
  };

  driverversion: AlpacaConstant<string> = {
    get: async (req: AlpacaRequest) => {
      return "0.0.1";
    },
  };

  description: AlpacaConstant<string> = {
    get: async (req: AlpacaRequest) => {
      return "Telescope";
    },
  };

  supportedactions: AlpacaConstant<Array<string>> = {
    get: async (req: AlpacaRequest) => {
      return [];
    },
  };

  axisrates: AlpacaConstant<Array<any>> = {
    get: async (req: AlpacaRequest<{ Axis?: string }>): Promise<any> => {
      if (req.Axis === undefined) {
        throw new Error("Axis is required");
      }

      const axis = parseInt(req.Axis);

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
  };

  equatorialsystem: AlpacaConstant<EquatorialSystems> = {
    get: async (req: AlpacaRequest) => {
      return EquatorialSystems.JNow;
    },
  };

  alignmentmode: AlpacaConstant<AlignmentModes> = {
    get: async (req: AlpacaRequest) => {
      return AlignmentModes.German;
    },
  };

  aperturearea: AlpacaConstant<number> = {
    get: async (req: AlpacaRequest) => {
      return 0;
    },
  };

  aperturediameter: AlpacaConstant<number> = {
    get: async (req: AlpacaRequest) => {
      return 0;
    },
  };

  focallength: AlpacaConstant<number> = {
    get: async (req: AlpacaRequest) => {
      return 0;
    },
  };

  athome: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };

  atpark: AlpacaConstant<boolean> = {
    get: async (req: AlpacaRequest) => {
      return false;
    },
  };
}

const telescope = new TelescopeEndpoint();

app.all(
  "/api/v1/:device_type/:device_number/:operation",
  async (req: TypedRequest, res: TypedResponse) => {
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

    if (req.method === "GET" && operation.get) {
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
        data.Value = await operation.get(req.query);
        console.log(req.method, req.url, data.Value);
      } catch (e) {
        return res.status(400).send("Bad parameter");
      }
    } else if (req.method === "PUT" && operation.set) {
      console.log(req.method, req.url, req.body);

      // according to conform tool if ClientID and ClientTransactionID
      // are incorrectly cased the device must ignore it
      if (req.body.ClientID !== undefined) {
        const clientID = parseInt(req.body.ClientID);
        if (clientID === null || isNaN(clientID) || clientID < 0) {
          return res.status(400).send("Invalid ClientID");
        }
      }

      if (req.body.ClientTransactionID !== undefined) {
        data.ClientTransactionID = parseInt(req.body.ClientTransactionID);

        if (
          data.ClientTransactionID === null ||
          isNaN(data.ClientTransactionID) ||
          data.ClientTransactionID < 0
        ) {
          return res.status(400).send("Invalid ClientTransactionID");
        }
      } else {
        data.ClientTransactionID = 0;
      }

      // todo: increment
      data.ServerTransactionID = 1;

      try {
        await operation.set(req.body);
      } catch (e) {
        return res.status(400).send("Bad parameter");
      }
    }

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
  console.log(`App listening on port ${port}`);
});

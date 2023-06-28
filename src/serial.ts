import { join } from "path";

interface Serial {
  open(opts: { path: string; baudRate: number }): number;
  close(fd: number): void;

  read(fd: number): Buffer;
  write(fd: number, data: string | Buffer): number;
}

const serial = require("node-gyp-build")(join(__dirname, "../")) as Serial;

export enum TrackingModes {
  Off = 0,
  AltAzm = 1,
  EqNorth = 2,
  EqSouth = 3,
}

export enum EquatorialSystems {
  Other = 0,
  JNow = 1,
  J2000 = 2,
  J2050 = 3,
  B1950 = 4,
}

export enum AlignmentModes {
  AltAzm = 0,
  Polar = 1,
  German = 2,
}

interface Port {
  send_command(cmd: string | Buffer): Promise<Buffer>;
  close(): Promise<void>;
}

class Commands {
  static EndOp = 0x23; //#
  static GetVersionOp = 0x56; // V
  static GetModelOp = 0x6d; // m
  static GetRaDecOp = 0x45; // E
  static GetPreciseRaDecOp = 0x65; // e
  static GetAltAzmOp = 0x5a; // Z
  static GetPreciseAltAzmOp = 0x7a; // z
  static GetTrackingModeOp = 0x74; // t
  static SetTrackignModeOp = 0x54; //
  static IsAlignCompleteOp = 0x4a; // J
  static IsGotoInProgressOp = 0x4c; // L
  static GotoOp = 0x52; //
  static CancelGotoOp = 0x4d; // M
  static SlewOp = 0x50; // P
  static SlewVariable = 3;

  static Ok = Buffer.from([Commands.EndOp]);
  static GetVersion = Buffer.from([Commands.GetVersionOp]);
  static GetModel = Buffer.from([Commands.GetModelOp]);
  static GetRaDec = Buffer.from([Commands.GetRaDecOp]);
  static GetPreciseRaDec = Buffer.from([Commands.GetPreciseRaDecOp]);
  static GetAltAzm = Buffer.from([Commands.GetAltAzmOp]);
  static GetPreciseAltAzm = Buffer.from([Commands.GetPreciseAltAzmOp]);
  static GetTrackingMode = Buffer.from([Commands.GetTrackingModeOp]);
  static IsAlignComplete = Buffer.from([Commands.IsAlignCompleteOp]);
  static IsGotoInProgress = Buffer.from([Commands.IsGotoInProgressOp]);
  static CancelGoto = Buffer.from([Commands.CancelGotoOp]);
}

class SimulatorPort implements Port {
  async send_command(cmd: string | Buffer): Promise<Buffer> {
    if (typeof cmd === "string") cmd = Buffer.from(cmd);

    switch (cmd[0]) {
      case Commands.GetRaDecOp:
        return Buffer.from("AAAA,AAAA#");

      case Commands.GetAltAzmOp: // getAltAzm
        return Buffer.from("AAAA,AAAA#");

      case Commands.SlewOp:
        return Commands.Ok;

      case Commands.GotoOp:
        return Commands.Ok;

      case Commands.SetTrackignModeOp:
        return Commands.Ok;

      case Commands.GetModelOp:
        return Buffer.from([20, Commands.EndOp]);

      case Commands.GetTrackingModeOp:
        return Buffer.from([TrackingModes.EqNorth, Commands.EndOp]);
    }

    return Buffer.alloc(0);
  }

  async close(): Promise<void> {}
}

class TelescopePort implements Port {
  fd: number;

  constructor(opts: { path: string; baudRate: number }) {
    this.fd = serial.open(opts);
  }

  async send_command(cmd: string | Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      serial.write(this.fd, cmd);

      const timeout_id = setTimeout(
        (start) => {
          reject(
            new Error(`Command ${cmd} timed out after ${Date.now() - start} ms`)
          );
        },
        3500,
        Date.now()
      );

      try {
        resolve(serial.read(this.fd));
      } catch (e) {
        reject(new Error(`Command ${cmd} failed`, { cause: e }));
      }

      clearTimeout(timeout_id);
    });
  }

  async close(): Promise<void> {
    serial.close(this.fd);
  }
}

export class CelestronAVX {
  port: Port;

  constructor({ path = "/dev/ttyUSB0", baudRate = 9600, simulator = false }) {
    if (simulator) {
      this.port = new SimulatorPort();
    } else {
      this.port = new TelescopePort({ path, baudRate });
    }
  }

  async close(): Promise<void> {
    await this.port.close();
  }

  async version(): Promise<string> {
    const buffer = await this.port.send_command(Commands.GetVersion);

    if (buffer.length !== 3) throw new Error("Invalid size");

    const major = buffer[0];
    const minor = buffer[1];

    return `${major}.${minor}`;
  }

  async model(): Promise<string> {
    const buffer = await this.port.send_command(Commands.GetModel);

    if (buffer.length !== 2) throw new Error("Invalid size");

    if (buffer[0] === 1) return "GPS Series";
    if (buffer[0] === 3) return "i-Series";
    if (buffer[0] === 4) return "i-Series SE";
    if (buffer[0] === 5) return "CGE";
    if (buffer[0] === 6) return "Advanced GT";
    if (buffer[0] === 7) return "SLT";
    if (buffer[0] === 9) return "CPC";
    if (buffer[0] === 10) return "GT";
    if (buffer[0] === 11) return "4/5 SE";
    if (buffer[0] === 12) return "6/8 SE";
    if (buffer[0] === 13) return "GCE Pro";
    if (buffer[0] === 14) return "CGEM DX";
    if (buffer[0] === 15) return "LCM";
    if (buffer[0] === 16) return "Sky Prodigy";
    if (buffer[0] === 17) return "CPC Deluxe";
    if (buffer[0] === 18) return "GT 16";
    if (buffer[0] === 19) return "StarSeeker";
    if (buffer[0] === 20) return "Advanced VX";
    if (buffer[0] === 21) return "Cosmos";
    if (buffer[0] === 22) return "Evolution";
    if (buffer[0] === 23) return "CGX";
    if (buffer[0] === 24) return "CGXL";
    if (buffer[0] === 25) return "Astrofi";
    if (buffer[0] === 26) return "SkyWatcher";

    return "Unknown model";
  }

  async getRaDec() {
    const buffer = await this.port.send_command(Commands.GetRaDec);

    if (buffer.length !== 10) throw new Error("Invalid size");

    const ra = parseInt(buffer.slice(0, 4).toString(), 16) / 0xffff;
    const dec = parseInt(buffer.slice(5, 9).toString(), 16) / 0xffff;

    return [ra * 24, dec * 360];
  }

  async getPreciseRaDec() {
    const buffer = await this.port.send_command(Commands.GetPreciseRaDec);

    if (buffer.length !== 18) throw new Error("Invalid size");

    const ra = parseInt(buffer.slice(0, 8).toString(), 16) / 0xffffffff;
    const dec = parseInt(buffer.slice(9, 17).toString(), 16) / 0xffffffff;

    return [ra * 24, dec * 360];
  }

  async getAltAzm() {
    const buffer = await this.port.send_command(Commands.GetAltAzm);

    if (buffer.length !== 10) throw new Error("Invalid size");

    const azm = parseInt(buffer.slice(0, 4).toString(), 16) / 0xffff;
    const alt = parseInt(buffer.slice(5, 9).toString(), 16) / 0xffff;

    return [alt, azm];
  }

  async getPreciseAltAzm() {
    const buffer = await this.port.send_command(Commands.GetPreciseAltAzm);

    if (buffer.length !== 18) throw new Error("Invalid size");

    const azm = parseInt(buffer.slice(0, 8).toString(), 16) / 0xffffffff;
    const alt = parseInt(buffer.slice(9, 17).toString(), 16) / 0xffffffff;

    return [alt, azm];
  }

  numberToHex(n: number, padding: number) {
    return Math.trunc(n).toString(16).toUpperCase().padStart(padding, "0");
  }

  async gotoRaDec(ra: number, dec: number) {
    const raStr = this.numberToHex((ra / 24) * 0xffff, 4);
    const decStr = this.numberToHex((dec / 360) * 0xffff, 4);

    const buffer = await this.port.send_command(`R${raStr},${decStr}`);

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async gotoPreciseRaDec(ra: number, dec: number) {
    const raStr = this.numberToHex((ra / 24) * 0xffffffff, 8);
    const decStr = this.numberToHex((dec / 360) * 0xffffffff, 8);

    const buffer = await this.port.send_command(`r${raStr},${decStr}`);

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async gotoAltAzm(alt: number, azm: number) {
    const altStr = this.numberToHex(alt * 0xffff, 4);
    const azmStr = this.numberToHex(azm * 0xffff, 4);

    const buffer = await this.port.send_command(`B${azmStr},${altStr}`);

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async gotoPreciseAltAzm(alt: number, azm: number) {
    const altStr = this.numberToHex(alt * 0xffffffff, 8);
    const azmStr = this.numberToHex(azm * 0xffffffff, 8);

    const buffer = await this.port.send_command(`b${azmStr},${altStr}`);

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async syncRaDec(ra: number, dec: number) {
    const raStr = this.numberToHex(ra * 0xffff, 4);
    const decStr = this.numberToHex(dec * 0xffff, 4);

    const buffer = await this.port.send_command(`S${raStr},${decStr}`);

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async syncPreciseRaDec(ra: number, dec: number) {
    const raStr = this.numberToHex(ra * 0xffffffff, 8);
    const decStr = this.numberToHex(dec * 0xffffffff, 8);

    const buffer = await this.port.send_command(`s${raStr},${decStr}`);

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async slewVariable(axis: number, rate: number) {
    const rateAbs = Math.abs(rate * 60 * 60); //arcseconds/second
    const rateHigh = Math.trunc((rateAbs * 4) / 256);
    const rateLow = Math.trunc((rateAbs * 4) % 256);
    const direction = rate >= 0 ? 6 : 7;
    const axisOp = axis === 0 ? 16 : 17;

    const buffer = await this.port.send_command(
      Buffer.from([
        Commands.SlewOp,
        Commands.SlewVariable,
        axisOp,
        direction,
        rateHigh,
        rateLow,
        0,
        0,
      ])
    );

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async getTrackingMode() {
    const buffer = await this.port.send_command(Commands.GetTrackingMode);

    if (buffer.length !== 2) throw new Error("Invalid size");

    return buffer[0];
  }

  async setTrackingMode(mode: TrackingModes) {
    const buffer = await this.port.send_command(
      Buffer.from([Commands.SetTrackignModeOp, mode])
    );

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async isAlignComplete() {
    const buffer = await this.port.send_command(Commands.IsAlignComplete);

    if (buffer.length !== 2) throw new Error("Invalid size");

    return buffer[0] === 1;
  }

  async isGotoInProgress() {
    const buffer = await this.port.send_command(Commands.IsGotoInProgress);

    if (buffer.length !== 2) throw new Error("Invalid size");

    // 0x30 = '0'
    // 0x31 = '1'
    return buffer[0] === 0x31;
  }

  async cancelGoto(): Promise<void> {
    const buffer = await this.port.send_command(Commands.CancelGoto);

    if (buffer.length !== 1) throw new Error("Invalid size");
  }

  async echo(ch: string): Promise<string> {
    const buffer = await this.port.send_command(`K${ch}`);

    if (buffer.length !== 2) throw new Error("Invalid size");

    return String.fromCharCode(buffer[0]);
  }
}

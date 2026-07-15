'use strict';

const PLUGIN_NAME = 'homebridge-pawport';
const PLATFORM_NAME = 'PawportPlatform';
const GRAPHQL_URL = 'https://api.app.pawport.com/graphql';
const POLL_INTERVAL_MS = 30000; // poll every 30 seconds

const SEND_DOOR_COMMAND_MUTATION = `
  mutation sendDoorCommand($command: String!, $doorID: String!, $arguments: json) {
    sendDoorCommand(command: $command, doorID: $doorID, arguments: $arguments)
  }
`;

const AUTH_DATA_QUERY = `
  query authDataGet {
    userContext {
      doorStates {
        doorID
        doorLocked
        behavior
        powerState
        __typename
      }
    }
  }
`;

module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, PawportPlatform);
};

// ——— Platform ————————————————————————————————————————————————

class PawportPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = [];

    if (!config || !config.doors || config.doors.length === 0) {
      this.log.warn('No doors configured. Add at least one door in your Homebridge config.');
      return;
    }

    this.api.on('didFinishLaunching', () => {
      this.syncAccessories();
    });
  }

  syncAccessories() {
    const configuredIDs = new Set(this.config.doors.map(d => d.doorID));

    this.accessories = this.accessories.filter(acc => {
      if (!configuredIDs.has(acc.context.doorID)) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [acc]);
        return false;
      }
      return true;
    });

    for (const doorConfig of this.config.doors) {
      if (!doorConfig.doorID || !doorConfig.authToken) {
        this.log.warn(`Door "${doorConfig.name}" is missing doorID or authToken — skipping.`);
        continue;
      }

      const uuid = this.api.hap.uuid.generate(doorConfig.doorID);
      const existing = this.accessories.find(a => a.UUID === uuid);

      if (existing) {
        this.log.info(`Restoring door: ${doorConfig.name}`);
        new PawportAccessory(this.log, existing, this.api, doorConfig);
      } else {
        this.log.info(`Adding door: ${doorConfig.name}`);
        const accessory = new this.api.platformAccessory(doorConfig.name, uuid);
        accessory.context.doorID = doorConfig.doorID;
        new PawportAccessory(this.log, accessory, this.api, doorConfig);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  configureAccessory(accessory) {
    this.accessories.push(accessory);
  }
}

// ——— Accessory ———————————————————————————————————————————————

class PawportAccessory {
  constructor(log, accessory, api, config) {
    this.log = log;
    this.accessory = accessory;
    this.api = api;
    this.config = config;

    this.authToken = config.authToken;
    this.doorID = config.doorID;

    // State Tracking — assume secured/closed until first poll
    this.currentLockState = api.hap.Characteristic.LockCurrentState.SECURED;
    this.targetLockState = api.hap.Characteristic.LockTargetState.SECURED;
    this.isForceOpen = false;

    // Prevent double-trigger
    this._lockCommandInFlight = false;
    this._forceOpenCommandInFlight = false;

    // Set accessory info
    this.accessory
      .getService(api.hap.Service.AccessoryInformation)
      .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Pawport')
      .setCharacteristic(api.hap.Characteristic.Model, 'Smart Pet Door')
      .setCharacteristic(api.hap.Characteristic.SerialNumber, this.doorID);

    // 1. Setup Lock Service
    this.lockService =
      this.accessory.getService(api.hap.Service.LockMechanism) ||
      this.accessory.addService(api.hap.Service.LockMechanism, config.name);

    this.lockService
      .getCharacteristic(api.hap.Characteristic.LockCurrentState)
      .onGet(() => this.currentLockState);

    this.lockService
      .getCharacteristic(api.hap.Characteristic.LockTargetState)
      .onGet(() => this.targetLockState)
      .onSet(async (value) => {
        if (this._lockCommandInFlight) {
          this.log.info(`${config.name}: Lock command already in flight, skipping duplicate.`);
          return;
        }
        this._lockCommandInFlight = true;

        this.targetLockState = value;
        const shouldLock = value === api.hap.Characteristic.LockTargetState.SECURED;
        this.log.info(`${config.name}: ${shouldLock ? 'Locking' : 'Unlocking'}...`);

        try {
          const success = await this.sendDoorCommand('door_lock', { locked: shouldLock });
          if (success) {
            this.currentLockState = shouldLock
              ? api.hap.Characteristic.LockCurrentState.SECURED
              : api.hap.Characteristic.LockCurrentState.UNSECURED;
            this.lockService
              .getCharacteristic(api.hap.Characteristic.LockCurrentState)
              .updateValue(this.currentLockState);
            this.log.info(`${config.name}: ${shouldLock ? 'Locked ✓' : 'Unlocked ✓'}`);
          }
        } catch (err) {
          this.log.error(`${config.name}: Lock command failed — ${err.message}`);
          throw new api.hap.HapStatusError(api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        } finally {
          this._lockCommandInFlight = false;
        }
      });

    // 2. Setup Force Open Switch Service
    this.switchService =
      this.accessory.getService('Manual Lift') ||
      this.accessory.addService(api.hap.Service.Switch, 'Manual Lift', 'manual-lift');

    this.switchService
      .getCharacteristic(api.hap.Characteristic.On)
      .onGet(() => this.isForceOpen)
      .onSet(async (value) => {
        if (this._forceOpenCommandInFlight) {
          this.log.info(`${config.name}: Force open command already in flight, skipping duplicate.`);
          return;
        }
        this._forceOpenCommandInFlight = true;

        this.log.info(`${config.name}: Sending force_open command (${value ? 'open' : 'close'})...`);
        try {
          const success = await this.sendDoorCommand('force_open', { forceOpen: value });
          if (success) {
            this.isForceOpen = value;
            this.switchService
              .getCharacteristic(api.hap.Characteristic.On)
              .updateValue(this.isForceOpen);
            this.log.info(`${config.name}: Door ${value ? 'opened' : 'closed'} ✓`);
          }
        } catch (err) {
          this.log.error(`${config.name}: Force open command failed — ${err.message}`);
          throw new api.hap.HapStatusError(api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        } finally {
          this._forceOpenCommandInFlight = false;
        }
      });

    // Initial state poll + start polling loop
    this.pollState();
    this._pollTimer = setInterval(() => this.pollState(), POLL_INTERVAL_MS);
  }

  async pollState() {
    try {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': this.authToken,
          'Accept': '*/*',
          'User-Agent': 'homebridge-pawport',
        },
        body: JSON.stringify({
          operationName: 'authDataGet',
          variables: {},
          query: AUTH_DATA_QUERY,
        }),
      });

      if (!response.ok) {
        this.log.warn(`${this.config.name}: State poll failed — HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      const doorStates = data?.data?.userContext?.doorStates || [];
      const state = doorStates.find(d => d.doorID === this.doorID);

      if (!state) {
        this.log.warn(`${this.config.name}: No state found for doorID ${this.doorID}`);
        return;
      }

      // doorLocked: 0 = unlocked, 1 = locked
      const isLocked = state.doorLocked === 1;
      const newLockState = isLocked
        ? this.api.hap.Characteristic.LockCurrentState.SECURED
        : this.api.hap.Characteristic.LockCurrentState.UNSECURED;

      if (newLockState !== this.currentLockState) {
        this.currentLockState = newLockState;
        this.targetLockState = isLocked
          ? this.api.hap.Characteristic.LockTargetState.SECURED
          : this.api.hap.Characteristic.LockTargetState.UNSECURED;
        this.lockService
          .getCharacteristic(this.api.hap.Characteristic.LockCurrentState)
          .updateValue(this.currentLockState);
        this.lockService
          .getCharacteristic(this.api.hap.Characteristic.LockTargetState)
          .updateValue(this.targetLockState);
        this.log.info(`${this.config.name}: Lock state updated from poll — ${isLocked ? 'Locked' : 'Unlocked'}`);
      }

      // behavior: reflects open/close state — non-null means door is open/active
      const isOpen = state.behavior !== null && state.behavior !== undefined;
      if (isOpen !== this.isForceOpen) {
        this.isForceOpen = isOpen;
        this.switchService
          .getCharacteristic(this.api.hap.Characteristic.On)
          .updateValue(this.isForceOpen);
        this.log.info(`${this.config.name}: Open state updated from poll — ${isOpen ? 'Open' : 'Closed'}`);
      }

    } catch (err) {
      this.log.error(`${this.config.name}: Poll error — ${err.message}`);
    }
  }

  async sendDoorCommand(command, args = {}) {
    const body = {
      operationName: 'sendDoorCommand',
      variables: {
        doorID: this.doorID,
        command,
        arguments: args,
      },
      query: SEND_DOOR_COMMAND_MUTATION,
    };

    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': this.authToken,
        'Accept': '*/*',
        'User-Agent': 'homebridge-pawport',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(data.errors.map(e => e.message).join(', '));
    }

    return data?.data?.sendDoorCommand === true;
  }
}

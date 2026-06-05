'use strict';

const PLUGIN_NAME = 'homebridge-pawport';
const PLATFORM_NAME = 'PawportPlatform';
const GRAPHQL_URL = 'https://api.app.pawport.com/graphql';

const SEND_DOOR_COMMAND_MUTATION = `
  mutation sendDoorCommand($command: String!, $doorID: String!, $arguments: json) {
    sendDoorCommand(command: $command, doorID: $doorID, arguments: $arguments)
  }
`;

module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, PawportPlatform);
};

// ─── Platform ────────────────────────────────────────────────────────────────

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

    // Remove accessories that are no longer in config
    this.accessories = this.accessories.filter(acc => {
      if (!configuredIDs.has(acc.context.doorID)) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [acc]);
        return false;
      }
      return true;
    });

    // Add or restore accessories for each configured door
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

// ─── Accessory ───────────────────────────────────────────────────────────────

class PawportAccessory {
  constructor(log, accessory, api, config) {
    this.log = log;
    this.accessory = accessory;
    this.api = api;
    this.config = config;

    this.authToken = config.authToken;
    this.doorID = config.doorID;

    // Current state tracking
    this.currentState = api.hap.Characteristic.LockCurrentState.SECURED;
    this.targetState = api.hap.Characteristic.LockTargetState.SECURED;

    // Set accessory info
    this.accessory
      .getService(api.hap.Service.AccessoryInformation)
      .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Pawport')
      .setCharacteristic(api.hap.Characteristic.Model, 'Smart Pet Door')
      .setCharacteristic(api.hap.Characteristic.SerialNumber, this.doorID);

    // Set up lock service
    this.lockService =
      this.accessory.getService(api.hap.Service.LockMechanism) ||
      this.accessory.addService(api.hap.Service.LockMechanism, config.name);

    this.lockService
      .getCharacteristic(api.hap.Characteristic.LockCurrentState)
      .onGet(() => this.currentState);

    this.lockService
      .getCharacteristic(api.hap.Characteristic.LockTargetState)
      .onGet(() => this.targetState)
      .onSet(async (value) => {
        this.targetState = value;
        const shouldLock = value === api.hap.Characteristic.LockTargetState.SECURED;
        this.log.info(`${config.name}: ${shouldLock ? 'Locking' : 'Unlocking'}...`);

        try {
          const success = await this.sendDoorCommand('door_lock', { locked: shouldLock });

          if (success) {
            this.currentState = shouldLock
              ? api.hap.Characteristic.LockCurrentState.SECURED
              : api.hap.Characteristic.LockCurrentState.UNSECURED;

            this.lockService
              .getCharacteristic(api.hap.Characteristic.LockCurrentState)
              .updateValue(this.currentState);

            this.log.info(`${config.name}: ${shouldLock ? 'Locked ✓' : 'Unlocked ✓'}`);
          } else {
            throw new Error('API returned false');
          }
        } catch (err) {
          this.log.error(`${config.name}: Command failed — ${err.message}`);
          // Revert target state to match current on failure
          this.targetState = shouldLock
            ? api.hap.Characteristic.LockTargetState.UNSECURED
            : api.hap.Characteristic.LockTargetState.SECURED;
          this.lockService
            .getCharacteristic(api.hap.Characteristic.LockTargetState)
            .updateValue(this.targetState);
          throw new api.hap.HapStatusError(api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });
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

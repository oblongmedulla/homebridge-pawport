# homebridge-pawport
[![npm](https://img.shields.io/npm/v/%40oblongmedulla/homebridge-pawport)](https://www.npmjs.com/package/@oblongmedulla/homebridge-pawport)
[![npm](https://img.shields.io/npm/dt/%40oblongmedulla/homebridge-pawport)](https://www.npmjs.com/package/@oblongmedulla/homebridge-pawport)

A Homebridge plugin that exposes your Pawport smart pet door as a **Lock** in Apple Home. Lock and unlock your pet door from the Home app, Siri, or automations.

Supports **multiple doors** on a single account.

---

## Installation

### Via Homebridge UI (Recommended)

Search for `homebridge-pawport` in the Homebridge plugin search and click **Install**.

### Manual Installation

```bash
npm install -g homebridge-pawport
```

## Configuration

After installing, go to the **Plugins** tab in Homebridge UI, find **homebridge-pawport**, and click **Settings**.

Add one entry per door with:

| Field      | Description                                                  |
| ---------- | ------------------------------------------------------------ |
| Door Name  | Whatever you want to call it in Apple Home (e.g. "Dog Door") |
| Auth Token | Your `x-auth-token` from the Pawport app (see below)         |
| Door ID    | The UUID of your door (see below)                            |

### Manual `config.json` Example

```json
{
  "platforms": [
    {
      "platform": "PawportPlatform",
      "name": "Pawport",
      "doors": [
        {
          "name": "Dog Door",
          "authToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          "doorID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        },
        {
          "name": "Cat Flap",
          "authToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          "doorID": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
        }
      ]
    }
  ]
}
```

## Finding Your Credentials (Easy Mode)

You no longer need to proxy network traffic or capture SSL certificates to get your credentials.

You can use the built-in login tool right inside the settings layout:

1. Open the plugin **Settings** modal in the Homebridge UI.
2. Click the **Login to Pawport** helper button at the top of the interface.
3. Enter your registered Pawport account email and password.
4. The plugin will securely reach out to the API and automatically fill in your Auth Token and Door ID values directly into the configuration form.

## How It Works

This plugin communicates with the Pawport cloud API using the same GraphQL endpoint as the official iOS app.

The door appears as a **Lock Mechanism** in HomeKit, which means you can:

* Lock and unlock from the Home app
* Use Siri ("Hey Siri, lock the dog door")
* Create automations (e.g. lock at sunset, unlock at 7am)
* Include it in Home scenes

> Note: This plugin is not affiliated with or endorsed by Pawport. Use at your own risk.

## Troubleshooting

### Door Shows as "No Response"

* Check that your `authToken` is correct and hasn't expired.
* Re-run the login helper button to refresh credentials.
* Make sure your Homebridge server has internet access.

### Commands Fail Silently

* Check the Homebridge logs for error details.
* Try locking/unlocking from the Pawport app to confirm the door is online.

## Contributing

Pull requests are welcome.

Please open an issue first to discuss what you'd like to change.

## License

MIT © oblongmedulla

# homebridge-pawport

[![npm](https://img.shields.io/npm/v/homebridge-pawport)](https://www.npmjs.com/package/homebridge-pawport)
[![npm](https://img.shields.io/npm/dt/homebridge-pawport)](https://www.npmjs.com/package/homebridge-pawport)

A [Homebridge](https://homebridge.io) plugin that exposes your [Pawport](https://pawport.com) smart pet door as a **Lock** in Apple Home. Lock and unlock your pet door from the Home app, Siri, or automations.

Supports **multiple doors** on a single account.

---

## Installation

### Via Homebridge UI (recommended)
Search for `homebridge-pawport` in the Homebridge plugin search and click Install.

### Manual
```bash
npm install -g homebridge-pawport
```

---

## Configuration

After installing, go to the **Plugins** tab in Homebridge UI, find `homebridge-pawport`, and click **Settings**. Add one entry per door with:

| Field | Description |
|-------|-------------|
| **Door Name** | Whatever you want to call it in Apple Home (e.g. "Dog Door") |
| **Auth Token** | Your `x-auth-token` from the Pawport app (see below) |
| **Door ID** | The UUID of your door (see below) |

### Manual config.json example

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

---

## Finding Your Credentials

You'll need to intercept your Pawport app's network traffic once to grab your `authToken` and `doorID`. Here's how:

### What you need
- An iPhone with the Pawport app installed
- [Proxyman](https://apps.apple.com/us/app/proxyman-network-debug-tool/id1551292695) (free) or [Stream](https://apps.apple.com/us/app/stream-http-debugging-proxy/id1312141691) (~$4.99) from the App Store

### Steps

1. Install Proxyman or Stream on your iPhone
2. Follow the in-app instructions to install the SSL certificate (Settings → trust the cert)
3. Start capturing traffic
4. Open the Pawport app, log in, and lock/unlock the door once
5. Stop capture and filter by `api.app.pawport.com`
6. Tap on a **sendDoorCommand** request
7. View the **Request** tab / Raw headers

You're looking for:
- **`x-auth-token`** header → this is your `authToken`
- **`doorID`** field in the request body → this is your `doorID`

---

## How It Works

This plugin communicates with the Pawport cloud API using the same GraphQL endpoint as the official iOS app. The door appears as a **Lock Mechanism** in HomeKit, which means you can:

- Lock / unlock from the Home app
- Use Siri ("Hey Siri, lock the dog door")
- Create automations (e.g. lock at sunset, unlock at 7am)
- Include it in Home scenes

> **Note:** This plugin is not affiliated with or endorsed by Pawport. Use at your own risk.

---

## Troubleshooting

**Door shows as "No Response"**
- Check that your `authToken` is correct and hasn't expired
- Make sure your Homebridge server has internet access

**Command fails silently**
- Check the Homebridge logs for error details
- Try locking/unlocking from the Pawport app to confirm the door is online

---

## Contributing

Pull requests welcome! Please open an issue first to discuss what you'd like to change.

[GitHub Repository](https://github.com/oblongmedulla/homebridge-pawport)

---

## License

MIT © [oblongmedulla](https://github.com/oblongmedulla)

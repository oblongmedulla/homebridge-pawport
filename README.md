# homebridge-pawport

![npm](https://img.shields.io/npm/v/%40oblongmedulla/homebridge-pawport)
![npm](https://img.shields.io/npm/dt/%40oblongmedulla/homebridge-pawport)

A [Homebridge](https://homebridge.io) plugin that exposes your [Pawport](https://pawport.com) smart pet door as a **Lock** in Apple Home. Lock and unlock your pet door from the Home app, Siri, or automations.

Supports **multiple doors** on a single account.

---

## Installation

### Via Homebridge UI (recommended)

Search for `homebridge-pawport` in the Homebridge plugin search and click Install.

### Manual

```bash
npm install -g @oblongmedulla/homebridge-pawport
```

## Configuration

After installing, go to the **Plugins** tab in Homebridge UI, find **homebridge-pawport**, and click **Settings**. Add one entry per door with:

| Field | Description |
|---|---|
| Door Name | Whatever you want to call it in Apple Home (e.g. "Dog Door") |
| Auth Token | Your `x-auth-token` from the Pawport app (see below) |
| Door ID | The UUID of your door (see below) |

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

## Finding Your Credentials

Pawport doesn't expose your Auth Token or Door ID anywhere in the app UI, so you'll need to capture them from your phone's network traffic using **Proxyman** (a free network debugging tool). This works no matter how you log into Pawport (email/password, Google, or Apple).

### 1. Install Proxyman

- Download the [Proxyman iOS app](https://proxyman.com/ios) from the App Store (or the Mac app if you'd rather capture from a simulator/desktop browser).
- Open Proxyman and follow its setup steps to connect your phone to the same Wi-Fi as your Mac and route traffic through it.

### 2. Install the Proxyman Certificate

- In the Proxyman app, go to the **Certificate** installation instructions.
- Install the certificate profile on your iPhone (**Settings → General → VPN & Device Management**), then enable full trust for it (**Settings → General → About → Certificate Trust Settings**).

### 3. Capture the Request

- With Proxyman actively capturing, open the **Pawport app** on your phone.
- Go to your door's page and send any command (e.g. lock or unlock the door).
- In Proxyman, look for a request to `api.app.pawport.com/graphql` with the operation name `sendDoorCommand`.

### 4. Copy Your Credentials

- Click into that request.
- Under **Request Headers**, copy the value of `x-auth-token` — this is your **Auth Token**.
- Under the **Request Body**, find `"doorID"` — this is your **Door ID**.

Paste both values into the plugin's Settings form in Homebridge UI.

> **Note:** Your auth token may expire periodically. If your door starts showing "No Response" in the Home app, repeat these steps to grab a fresh token.

## How It Works

This plugin communicates with the Pawport cloud API using the same GraphQL endpoint as the official iOS app. The door appears as a **Lock Mechanism** in HomeKit, which means you can:

- Lock / unlock from the Home app
- Use Siri ("Hey Siri, lock the dog door")
- Create automations (e.g. lock at sunset, unlock at 7am)
- Include it in Home scenes

> **Note:** This plugin is not affiliated with or endorsed by Pawport. Use at your own risk.

## Troubleshooting

### Door shows as "No Response"

- Check that your `authToken` is correct and hasn't expired (repeat the Proxyman steps above to get a fresh one).
- Make sure your Homebridge server has internet access.

### Commands fail silently

- Check the Homebridge logs for error details.
- Try locking/unlocking from the Pawport app to confirm the door is online.

## Contributing

Pull requests welcome! Please open an issue first to discuss what you'd like to change.

[GitHub Repository](https://github.com/oblongmedulla/homebridge-pawport)

## License

MIT © oblongmedulla
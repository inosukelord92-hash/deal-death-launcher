# DEAL DEATH

A Windows Minecraft: Java Edition launcher built with Electron.

![DEAL DEATH](assets/icon.png)

## Features

- Browse every Minecraft version and create instances
- Vanilla, Fabric, Forge, NeoForge and Quilt instances
- Microsoft sign-in (official OAuth) with Minecraft ownership check
- Automatic Java runtime download (Temurin 8/17/21/25)
- Download progress, launch logs and clear error messages
- Modrinth / CurseForge content browser (mods, resource packs, shaders, data packs)
- Modrinth modpack installer
- Instance content management (enable, disable, remove, open folder)
- Tray, playtime tracking, notifications, themes

## Requirements

- Windows 10/11 (x64)
- A Microsoft account that owns Minecraft: Java Edition
- Internet connection for the first launch

## Development

```bash
npm install
npm start
```

## Build the Windows installer

```bash
npm run build
```

The installer is written to `dist/DEAL DEATH Setup <version>.exe`.

## Sign-in

DEAL DEATH uses Microsoft's official OAuth sign-in and verifies game ownership
through the Xbox and Minecraft services. It does not support offline or cracked
accounts.

By default the launcher uses the public client ID bundled with
`minecraft-java-core`. For a public release you can register your own free Azure
app (public client, redirect URI `https://login.live.com/oauth20_desktop.srf`,
scope `XboxLive.signin offline_access`) and paste its client ID in
**Settings → General → Microsoft client ID**.

The Microsoft refresh token is stored encrypted with Windows DPAPI
(`safeStorage`) in the app's user-data folder.

## Data locations

- Instances: `%APPDATA%\deal-death-launcher\instances\<id>`
- Shared game files: `%APPDATA%\deal-death-launcher\versions`, `assets`, `libraries`
- Java runtimes: `%APPDATA%\deal-death-launcher\runtime`
- Launch logs: `%APPDATA%\deal-death-launcher\logs`

## Release

1. Run `npm run build`.
2. Create a GitHub release tagged `v1.3.0`.
3. Upload `dist/DEAL DEATH Setup 1.3.0.exe` as a release asset.
4. Test the download link in a private browser window.

Not affiliated with Mojang or Microsoft.

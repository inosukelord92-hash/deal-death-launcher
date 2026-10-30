# Publish pack — DEAL DEATH Launcher v1.3.6

Everything you need to put the launcher online. The build is done; these are the
only files you upload.

| File | Where | Size |
| --- | --- | --- |
| `DEAL DEATH Setup 1.3.6.exe` | `dist\` | 81.8 MB |
| `SHA256SUMS.txt` | `dist\` | 82 B |

SHA-256 of the installer:

```
7221be1140815f831be3ed247e5e65959f858bba1e5a6ad85e98a917d12a264f
```

---

## 1. SmartScreen warning (installer is not code-signed)

`Get-AuthenticodeSignature` reports **NotSigned**. There is no code-signing
certificate on this PC, so Windows will show *"Windows protected your PC"* for
every download. That is expected, not a virus.

**Put this in the post so people do not panic:**

> **Install note:** the installer is not code-signed yet, so Windows SmartScreen
> may warn you. Click **More info → Run anyway**. You can verify the download
> with the SHA-256 hash below before running it.

Bypass steps for users (paste as-is):

1. Run `DEAL DEATH Setup 1.3.6.exe`.
2. If *"Windows protected your PC"* appears → **More info** → **Run anyway**.
3. If Chrome/Edge blocks it → keep the file → **Show more** → **Keep anyway**.

To remove the warning permanently you need an OV/EV code-signing certificate
(DigiCert, Sectigo, SSL.com; ~$200–400/year, EV gives instant SmartScreen
reputation). Nothing else removes it. Do **not** self-sign — it makes the
warning worse.

---

## 2. Hosting (no git repo on this PC)

There is no `git`/`gh` here, so pick one:

**A. GitHub Releases (recommended, free, permanent link)**

1. github.com → **New repository** → name `deal-death-launcher` → Private or Public → Create.
2. On the repo page → **Releases** → **Draft a new release**.
3. Tag: `v1.3.6` · Title: `DEAL DEATH Launcher v1.3.6`.
4. Description: paste section **3** below.
5. Attach `DEAL DEATH Setup 1.3.6.exe` and `SHA256SUMS.txt` → **Publish release**.
6. Share the release URL (`https://github.com/<user>/deal-death-launcher/releases/latest`).

**B. Google Drive (fastest, no account setup beyond yours)**

1. Upload the `.exe` → right click → **Share** → *Anyone with the link* → Copy link.
2. Paste the link in the post. Google warns on large `.exe` downloads; users may
   need **Download anyway**.

**C. MediaFire / catbox.moe** — anonymous, direct link, no size problem
(catbox limit is 200 MB). Discord free uploads cap at 25 MB, so do not use it
for the installer.

---

## 3. Release post (copy-paste)

**DEAL DEATH Launcher v1.3.6 — Windows**

A Minecraft: Java Edition launcher with a cream/butter dashboard, one-click
XPON Optimize install, and the DEAL DEATH logo next to your name in the tab list.

**Download:** `DEAL DEATH Setup 1.3.6.exe` (81.8 MB)

**What's new in 1.3.6**

- Fixed the **black screen** on launch — the badge font texture was in the wrong
  folder, which broke the whole resource reload.
- The game now writes proper `logs/latest.log` again (log4j config path was invalid).
- Badge font jar is rebuilt and self-checked, so a bad glyph can no longer black-screen the game.
- Installer output cleaned up: one installer, no leftover build folders.

**Features**

- Official Microsoft sign-in with Minecraft ownership check, plus a local/offline profile.
- Fabric, Forge, NeoForge and Quilt.
- Automatic Java runtime download (Temurin 8 / 17 / 21 / 25).
- XPON Optimize card at the top: one click to install and play (Fabric 1.21.11).
- Tab list badge: DEAL DEATH logo next to your name and your friends' names.
- Tuned G1GC flags, auto RAM sizing, first-run graphics defaults, live download progress.
- Per-instance logs, modpack installs from Modrinth, multi-account support.

**Requirements**

- Windows 10/11 (64-bit)
- Microsoft account that owns Minecraft: Java Edition (or a local profile)
- Internet for the first launch

**Install note:** the installer is not code-signed yet, so Windows SmartScreen
may warn you. Click **More info → Run anyway**.

**Verify your download (optional)**

```
SHA-256  7221be1140815f831be3ed247e5e65959f858bba1e5a6ad85e98a917d12a264f
```

PowerShell: `Get-FileHash "DEAL DEATH Setup 1.3.6.exe" -Algorithm SHA256`

Not affiliated with Mojang or Microsoft. "Minecraft" is a trademark of Mojang Synergies AB.

---

## 4. Short caption (Discord / WhatsApp / Instagram)

> **DEAL DEATH Launcher v1.3.6** 🎮
> XPON Optimize one-click install · Fabric/Forge/NeoForge/Quilt · tab list me DEAL DEATH logo
> Black screen fix ho gaya ✅
> Download: `<link>`
> Installer unsigned hai — SmartScreen aaye to *More info → Run anyway*.

---

## 5. Before you publish — checklist

- [x] Installer built and asar-verified (`dist\DEAL DEATH Setup 1.3.6.exe`)
- [x] Version matches `package.json` (1.3.6)
- [x] Black screen fix tested on a real modded instance
- [x] `LICENSE` (MIT) added
- [x] SHA-256 published
- [ ] Upload the `.exe` (section 2)
- [ ] Paste the release post (section 3)
- [ ] Update `RELEASE.md` in the repo (still says v1.3.0)

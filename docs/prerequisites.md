# TAPat Prerequisites — what your machine needs before you start

Checklist for BegA and BegB: what to install and which accounts to create before you open the code. It takes about 30–45 minutes.
Last updated: 2026-11-05

Do this once, **before** your first task in [build-schedule.md](build-schedule.md). When every check in §5 passes, continue with [test-guide.md](test-guide.md).

> Commands are for **PowerShell** on Windows. Open it from the Start menu: type `PowerShell` and press Enter.
> After installing anything, **close and reopen PowerShell** so it sees the new program.

## 1. Hardware

| Item | Minimum | Who |
|---|---|---|
| Laptop | Windows 10 or 11, 64-bit | Everyone |
| Memory (RAM) | 8 GB (16 GB is smoother) | Everyone |
| Free disk space | 10 GB | Everyone |
| Internet | Stable Wi-Fi; a phone hotspot as backup | Everyone |
| Android phone | NFC built in, Chrome installed | **BegB** (required), BegA (optional) |
| NFC card or sticker | NTAG213/215/216; the team provides them | BegB |

iPhones cannot read our NFC cards in the browser (Web NFC is Chrome-on-Android only).

## 2. Accounts

| Account | Why | Action |
|---|---|---|
| GitHub | Access to the TAPat repository | Send your GitHub username to Jim and accept the invite email |
| Telegram (phone app) | Receive the bot's tap receipts and evidence requests while testing | Install Telegram from the Play Store and sign in |
| Google account | Sign in to Antigravity, the AI editor the team uses | Use your existing account |

**You do not need**: Freighter, a Stellar wallet, a Velo account, Oracle/Google Cloud, Tailscale, or Vercel. Those are Jim's ([setup.md](setup.md), [deployment.md](deployment.md)).

## 3. Software (install in this order)

If `winget` is not found, install **App Installer** from the Microsoft Store first, then reopen PowerShell.

| # | Program | Install | Check (new PowerShell window) |
|---|---|---|---|
| 1 | Git | `winget install --id Git.Git -e` | `git --version` → any version |
| 2 | Node.js **22** | `winget install OpenJS.NodeJS.22` (installs the latest 22.x) | `node --version` → `v22.23.4` or a later `v22` |
| 3 | pnpm **9** | `npm install -g pnpm@9` (if blocked: `corepack enable`) | `pnpm --version` → `9.x` |
| 4 | Google Chrome | `winget install --id Google.Chrome -e` | Chrome opens |
| 5 | Antigravity (AI editor) | Download from the link Jim posts in the team chat | Opens and signs in with Google |
| 6 | *(BegB, optional for others)* cloudflared | `winget install Cloudflare.cloudflared` | `cloudflared --version` → any version |

After installing Git, tell it who you are (once):

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Notes:

- **Use Node 22 at 22.23.4 or above, exactly**: `@noirx402/agent-sdk` (the SDK we use to call Noir) requires it. Its engines are `^22.23.4 || ^24.22.1 || >=26.12.1`, and Node 24/26 below those floors (e.g. 26.4) is not supported. If `node --version` prints a v22 lower than v22.23.4, or anything that is not a v22, run `winget upgrade OpenJS.NodeJS.22`, reopen PowerShell, and check again. If it still shows the wrong version, ask Jim.
- If PowerShell says `pnpm ... cannot be loaded because running scripts is disabled`, run this once, then reopen PowerShell:

  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```

- Do **not** install Visual Studio Build Tools, Python, or a database. The project doesn't need them on your laptop unless Jim asks.

## 4. Phone setup (BegB; BegA if you test NFC)

1. **Settings → Connected devices → NFC**: turn on. The menu name differs by brand; search "NFC" in Settings.
2. Update **Chrome** from the Play Store.
3. Install **Telegram** and sign in.
4. Keep the phone charged; NFC reads drain the battery a little.

The phone opens the app over an HTTPS link that Jim or the test guide gives you. Nothing else is installed on the phone.

## 5. Final check

Paste this into a new PowerShell window:

```powershell
git --version; node --version; pnpm --version; cloudflared --version
```

| Line | Expected |
|---|---|
| `git version …` | any |
| `v22.…` | must be `v22.23.4` or a later v22 |
| `9.…` | must start with `9` |
| `cloudflared version …` | BegB only; others may see "not recognized" — that's fine |

✅ All required lines match → you're ready. Continue with [test-guide.md](test-guide.md) §1 (get the code) and §2: Jim sends you the **dev** `.env` privately, never the prod one. The committed root `.env.example` lists every variable (server and web sections) with placeholders only — read it, never put a real value in it.

## 6. If something goes wrong

| Problem | Fix |
|---|---|
| `winget` is not recognized | Install **App Installer** from the Microsoft Store, reopen PowerShell |
| A command is "not recognized" right after installing | Close and reopen PowerShell |
| `node --version` is below `v22.23.4` or not a v22 | Run `winget upgrade OpenJS.NodeJS.22` (or the install line in §3 row 2), reopen PowerShell; still wrong → ask Jim |
| `npm install -g pnpm@9` fails | Run `corepack enable`, reopen PowerShell, then `pnpm --version` |
| `pnpm` blocked by script policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, reopen PowerShell |
| Can't see the TAPat repo on GitHub | Check your email for the invite from Jim and accept it |
| Antivirus slows or blocks installs | Allow the installer once, or ask Jim |

Stuck for more than 15 minutes? Post in the team chat with a screenshot of the PowerShell window.

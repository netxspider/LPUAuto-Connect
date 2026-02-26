# LPU Auto-Connect v2.0

A Chrome extension and student productivity hub for LPU WiFi — auto-login to the captive portal, one-click access to student portals with credential auto-fill, session keep-alive, data usage tracking, network health monitoring, and more.

## Features

### WiFi Auto-Login
| Feature | Description |
|---------|-------------|
| **Auto-Login** | Fills username, password, checks T&C, and submits on `internet.lpu.in` |
| **Multi-Account** | Save and switch between multiple WiFi accounts |
| **Auto-Close Tab** | Closes the login tab after successful authentication |
| **Session Keep-Alive** | Pings the portal every 15 minutes to prevent session timeout |
| **Dark Mode (Portal)** | Injects a dark theme into the captive portal page |

### Dashboard
| Feature | Description |
|---------|-------------|
| **Data Usage Tracker** | Monitors daily network traffic via `chrome.webRequest` |
| **Network Health Score** | RTT-based health rating (Gaming Ready / Low Latency / YouTube OK / Slow / WiFi Dying) |
| **Speed Test** | One-click download speed and latency measurement |
| **Session Timer** | Tracks how long you've been connected |
| **Login Counter** | Tracks total auto-login count |

### Quick Links with Auto-Fill
One-click access to student portals — credentials are auto-filled on page load.

| Portal | Auto-Fill | Auto-Submit |
|--------|-----------|-------------|
| **UMS** (`ums.lpu.in`) | Username → reload → Password + Captcha OCR | No (reCAPTCHA) |
| **MyClass** (`myclass.lpu.in`) | Username + Password | Yes |
| **LPULive** (`lpulive.lpu.in`) | Username + Password | No (Cloudflare) |
| **OAS** (`oas.lpu.in`) | Username + Password | Yes |
| **NeoBrowser** (`examly.io`) | Email → Next → Password (two-step) | Yes |

> **UMS Captcha:** Uses Tesseract.js OCR to automatically read and fill the captcha. The recognized text can be corrected before submitting.

### Credential Management
| Section | Used For |
|---------|----------|
| **WiFi Accounts** | `internet.lpu.in` captive portal login |
| **UMS / Portal Credentials** | UMS, MyClass, LPULive, OAS |
| **NeoBrowser Credentials** | `examly.io` (defaults to `<regno>@neocolab.ai` / `<regno>`) |

### VPN & DNS
| Feature | Description |
|---------|-------------|
| **Proxy Toggle** | Route traffic through a custom HTTP/HTTPS/SOCKS proxy |
| **Secure DNS** | Switch between Cloudflare, Google, Quad9, AdGuard, or system default DoH |

## Installation

1. Open Chrome → `chrome://extensions/`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `LPUInternetExtension` folder
5. Click the extension icon in your toolbar

## Setup

1. Click the extension icon
2. Go to **Settings** tab
3. Add a **WiFi Account** (Registration Number + Password for `internet.lpu.in`)
4. Add **UMS / Portal Credentials** (for UMS, MyClass, LPULive, OAS)
5. Optionally set **NeoBrowser Credentials**
6. Toggle preferences: Auto-Login, Auto-Close, Keep-Alive, Dark Mode

## How It Works

```
Connect to LPU WiFi
        ↓
Browser opens internet.lpu.in
        ↓
content.js detects login form → auto-fills → submits
        ↓
You're online! (tab auto-closes if enabled)
        ↓
background.js pings portal every 15min (keep-alive)
        ↓
Click Quick Link (e.g. UMS) → autofill.js fills credentials
        ↓
Tesseract.js reads captcha → fills it → you verify and login
```

## File Structure

```
LPUInternetExtension/
├── manifest.json        → Extension config (MV3), permissions, content scripts
├── background.js        → Service worker: keep-alive, data tracking, speed test, proxy
├── content.js           → Auto-login on internet.lpu.in + dark mode injection
├── autofill.js          → Auto-fill credentials on UMS, MyClass, LPULive, OAS, NeoBrowser
├── tesseract.min.js     → Tesseract.js OCR library for UMS captcha solving
├── darkmode.css         → Dark theme stylesheet for captive portal
├── popup.html           → Extension popup UI (3 tabs: Dashboard, VPN, Settings)
├── popup.css            → Dark glassmorphism theme styles
├── popup.js             → Popup logic: data usage, health, accounts, quick links
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Save credentials and settings locally |
| `tabs` | Open quick links and manage login tabs |
| `proxy` | VPN/proxy routing |
| `alarms` | Schedule keep-alive pings every 15 minutes |
| `webRequest` | Track network traffic for data usage estimation |
| `<all_urls>` | Monitor data usage across all sites |

## Security

- All credentials are stored locally via `chrome.storage.local` — never synced or transmitted
- No data is sent to external servers
- Content scripts only activate on specific LPU domains
- Open source — inspect every line of code

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension doesn't auto-login | Verify credentials in Settings → WiFi Accounts |
| Quick links don't auto-fill | Save credentials in UMS / Portal Credentials section |
| UMS captcha not solved | OCR may misread — correct the text and submit manually |
| Auto-Login toggle is ON but still not submitting | Reload extension at `chrome://extensions/` |
| NeoBrowser login fails | Check two-step flow — email must be entered first, then password |
| Speed test fails | Ensure you're connected to the internet first |
| Infinite login loop | Disable Auto-Login temporarily in Settings |

---

**LPU Auto-Connect v2.0** — Made by [netxspider](https://github.com/netxspider)

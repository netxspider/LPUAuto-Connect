# LPU Auto-Connect v2.0

A Chrome extension and student productivity hub for LPU WiFi — auto-login to the captive portal, one-click access to student portals with credential auto-fill, session keep-alive, data usage tracking, network health monitoring, and more.

> **Support the project:** If this extension saved you time, consider [buying me a coffee](https://razorpay.me/@netxspider) ☕

---

## Table of Contents

- [Features](#features)
- [Installation Guide](#installation-guide)
- [Getting Started](#getting-started)
- [How to Use](#how-to-use)
- [How It Works](#how-it-works)
- [File Structure](#file-structure)
- [Permissions](#permissions)
- [Security & Privacy](#security--privacy)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

---

## Features

### 🔌 Extension Toggle
Turn the entire extension ON or OFF using the toggle in the header. When disabled, all auto-fill, auto-login, and keep-alive features are paused — useful for exams or when you want manual control.

### 📶 WiFi Auto-Login
| Feature | Description |
|---------|-------------|
| **Auto-Login** | Fills username, password, checks T&C, and submits on `internet.lpu.in` |
| **Multi-Account** | Save and switch between multiple WiFi accounts |
| **Auto-Close Tab** | Closes the login tab after successful authentication |
| **Session Keep-Alive** | Pings the portal every 15 minutes to prevent session timeout |
| **Dark Mode (Portal)** | Injects a dark theme into the captive portal page |

### 📊 Dashboard
| Feature | Description |
|---------|-------------|
| **Data Usage Tracker** | Monitors daily network traffic via `chrome.webRequest` |
| **Network Health Score** | RTT-based health rating (Gaming Ready / Low Latency / YouTube OK / Slow / WiFi Dying) |
| **Speed Test** | One-click download speed and latency measurement |
| **Session Timer** | Tracks how long you've been connected |
| **Login Counter** | Tracks total auto-login count |

### 🔗 Quick Links with Auto-Fill
One-click access to student portals — credentials are auto-filled on page load.

| Portal | Auto-Fill | Auto-Submit |
|--------|-----------|-------------|
| **UMS** (`ums.lpu.in`) | Username → reload → Password + Captcha OCR | No (reCAPTCHA) |
| **MyClass** (`myclass.lpu.in`) | Username + Password | Yes |
| **LPULive** (`lpulive.lpu.in`) | Username + Password | No (Cloudflare) |
| **OAS** (`oas.lpu.in`) | Username + Password | Yes |
| **NeoBrowser** (`examly.io`) | Email → Next → Password (two-step) | Yes |

> **UMS Captcha:** Uses Tesseract.js OCR to automatically read and fill the captcha. The recognized text can be corrected before submitting.

### 🔐 Credential Management
| Section | Used For |
|---------|----------|
| **WiFi Accounts** | `internet.lpu.in` captive portal login |
| **UMS / Portal Credentials** | UMS, MyClass, LPULive, OAS |
| **NeoBrowser Credentials** | `examly.io` (defaults to `<regno>@neocolab.ai` / `<regno>`) |

### 🛡️ VPN & DNS
| Feature | Description |
|---------|-------------|
| **Proxy Toggle** | Route traffic through a custom HTTP/HTTPS/SOCKS proxy |
| **Secure DNS** | Switch between Cloudflare, Google, Quad9, AdGuard, or system default DoH |

---

## Installation Guide

### Prerequisites
- **Google Chrome** (or any Chromium-based browser like Brave, Edge, Opera)
- An active LPU WiFi connection (for the auto-login features)

### Step-by-Step Installation

#### 1. Download the Extension

**Option A — Clone with Git:**
```bash
git clone https://github.com/netxspider/LPUInternetExtension.git
```

**Option B — Download ZIP:**
1. Go to the [GitHub repository](https://github.com/netxspider/LPUInternetExtension)
2. Click the green **"Code"** button → **"Download ZIP"**
3. Extract the ZIP to a folder you'll remember (e.g. `Desktop/LPUInternetExtension`)

#### 2. Load it in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Turn on **Developer mode** using the toggle in the **top-right corner**
3. Click **"Load unpacked"** (top-left)
4. Browse to and select the `LPUInternetExtension` folder
5. The extension will appear in the list with a ✓ — you're installed!

#### 3. Pin the Extension

1. Click the **puzzle piece icon** (🧩) in Chrome's toolbar
2. Find **LPU Auto-Connect** in the list
3. Click the **pin icon** (📌) next to it
4. The extension icon will now always be visible in your toolbar

#### 4. Verify Installation

Click the extension icon — you should see the popup with three tabs: **Dashboard**, **VPN**, and **Settings**.

---

## Getting Started

After installation, follow these steps to set up the extension:

### Step 1: Set Up WiFi Credentials

1. Click the extension icon → go to the **Settings** tab
2. Under **WiFi Accounts**, click the **+** button
3. Enter:
   - **Account Name** — any label (e.g. "Main", "Friend's")
   - **Registration Number** — your LPU registration number
   - **Password** — your WiFi portal password
4. Click **Save Account**
5. The account will appear in the list — click it to make it active

> 💡 You can save multiple accounts and switch between them any time.

### Step 2: Set Up Portal Credentials

1. Under **UMS / Portal Credentials**, enter:
   - **Registration Number** — same as UMS login
   - **Password** — your UMS/portal password
2. Click **Save Portal Credentials**

These are used for auto-filling UMS, MyClass, LPULive, and OAS.

### Step 3: Set Up NeoBrowser Credentials (Optional)

1. Under **NeoBrowser Credentials**, enter:
   - **Username** — usually `<registration_number>@neocolab.ai`
   - **Password** — usually your registration number
2. Click **Save Neo Credentials**

> By default, these are auto-generated from your WiFi account registration number.

### Step 4: Configure Preferences

Toggle these ON/OFF based on your needs:

| Setting | Default | What it does |
|---------|---------|--------------|
| **Auto-Login** | ✅ ON | Automatically submits the WiFi login form |
| **Auto-Close Tab** | ✅ ON | Closes the login tab after successful login |
| **Session Keep-Alive** | ✅ ON | Pings portal every 15 min to prevent timeout |
| **Dark Mode (Portal)** | ❌ OFF | Applies dark theme to `internet.lpu.in` |

---

## How to Use

### Daily WiFi Login

1. Connect to **LPU WiFi** from your device
2. Chrome will open `internet.lpu.in` (captive portal)
3. **The extension automatically** fills your credentials and logs you in
4. The tab closes automatically (if enabled), and you're online!

> If it doesn't auto-login, click the extension icon to verify your credentials are saved.

### Accessing Student Portals

1. Click the extension icon → **Dashboard** tab
2. Click any **Quick Link** (UMS, MyClass, LPULive, OAS, Neo)
3. The portal opens in a new tab with credentials **pre-filled**
4. For UMS: the captcha is automatically solved via OCR — verify and submit

### Using the Extension Toggle

The header of the popup has an **ON/OFF toggle switch**:

- **ON (default):** All features active — auto-login, auto-fill, keep-alive
- **OFF:** Extension goes dormant — no auto-fill, no keep-alive pings, UI is dimmed

This is useful during **exams** or when you want to **manually control** your login flow.

### Running a Speed Test

1. Open the extension → **Dashboard** tab
2. Click **"Run Speed Test"**
3. Wait for the test to complete (tests multiple chunk sizes)
4. Results show download speed (Mbps) and latency (ms)

### Setting Up VPN / Proxy

1. Go to the **VPN** tab
2. Enter your proxy details:
   - **Proxy Host** (e.g. `proxy.example.com`)
   - **Port** (e.g. `8080`)
   - **Scheme** (HTTP, HTTPS, or SOCKS5)
3. Click **Save Proxy Config**
4. Toggle the proxy switch **ON**

> `internet.lpu.in` is always bypassed so proxy doesn't break WiFi login.

### Changing DNS

1. Go to the **VPN** tab → **Secure DNS** section
2. Select a DNS provider (Cloudflare, Google, Quad9, AdGuard)
3. Click **Apply DNS**
4. The DoH URL is copied to your clipboard — paste it in Chrome's DNS settings
5. Click **"Open Chrome DNS Settings"** for quick access

### Supporting the Developer

At the bottom of the **Settings** tab, there's a **"Buy Me a Coffee"** section. Click **"Donate via Razorpay"** to support the developer.

---

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

---

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

---

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Save credentials and settings locally |
| `tabs` | Open quick links and manage login tabs |
| `proxy` | VPN/proxy routing |
| `alarms` | Schedule keep-alive pings every 15 minutes |
| `webRequest` | Track network traffic for data usage estimation |
| `<all_urls>` | Monitor data usage across all sites |

---

## Security & Privacy

- 🔒 All credentials are stored **locally** via `chrome.storage.local` — never synced or transmitted
- 🚫 No data is sent to external servers
- 🎯 Content scripts only activate on specific LPU domains
- 📖 Fully open source — inspect every line of code

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension doesn't auto-login | Verify credentials in Settings → WiFi Accounts |
| Extension toggle is OFF | Turn it ON using the header toggle switch |
| Quick links don't auto-fill | Save credentials in UMS / Portal Credentials section |
| UMS captcha not solved | OCR may misread — correct the text and submit manually |
| Auto-Login toggle is ON but not submitting | Reload extension at `chrome://extensions/` |
| NeoBrowser login fails | Check two-step flow — email must be entered first, then password |
| Speed test fails | Ensure you're connected to the internet first |
| Infinite login loop | Disable Auto-Login temporarily in Settings |
| Extension not appearing | Make sure Developer Mode is ON at `chrome://extensions/` |
| UI is dimmed / buttons don't work | Extension is disabled — toggle it ON in the header |

---

## Support

If this extension saved your time and effort, consider supporting the developer:

☕ **[Buy Me a Coffee](https://razorpay.me/@netxspider)**

---

**LPU Auto-Connect v2.0** — Made with ❤️ by [netxspider](https://github.com/netxspider)

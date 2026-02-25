# 🛜 LPU Auto-Connect

A Chrome extension that **automatically logs you into the LPU WiFi captive portal** (`internet.lpu.in`) — no more typing credentials and checking that terms box every single time.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Auto-Login** | Fills username, password, and checks T&C automatically |
| **Speed Test** | One-click download speed measurement |
| **Connection Info** | Network type, downlink speed display |
| **Session Timer** | Track how long you've been connected |
| **Login Counter** | See how many times you've auto-logged in |
| **Auto-Close** | Optionally closes the login tab after success |
| **Secure Storage** | Credentials stored locally — never synced to cloud |

## 🚀 Installation

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `LPUInternetExtension` folder
5. The extension icon will appear in your toolbar! 🎉

## ⚙️ Setup

1. Click the extension icon in your toolbar
2. Go to the **Settings** tab
3. Enter your **Registration Number** and **Password**
4. Toggle your preferences (Auto-Login, Auto-Close Tab)
5. Click **Save Settings**

That's it! Next time you connect to LPU WiFi and the captive portal opens, the extension will handle everything automatically.

## 🏗️ How It Works

```
You connect to LPU WiFi
        ↓
Browser opens internet.lpu.in (captive portal)
        ↓
Content script detects the login form
        ↓
Auto-fills credentials from local storage
        ↓
Checks terms & conditions checkbox
        ↓
Clicks "Login" button
        ↓
You're online! ✅ (tab auto-closes if enabled)
```

## 📁 File Structure

```
LPUInternetExtension/
├── manifest.json      → Extension config (Manifest V3)
├── content.js         → Auto-login script (runs on internet.lpu.in)
├── background.js      → Service worker (session tracking, speed test)
├── popup.html         → Dashboard UI
├── popup.css          → Premium dark theme styles
├── popup.js           → Dashboard logic
├── icons/
│   ├── icon16.png     → Toolbar icon
│   ├── icon48.png     → Extensions page icon
│   └── icon128.png    → Chrome Web Store icon
└── README.md          → This file
```

## 🔒 Security

- Credentials are stored using `chrome.storage.local` (never synced)
- No data is sent to any external server
- The extension only activates on `internet.lpu.in` pages
- Open source — you can inspect every line of code

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension doesn't auto-login | Check that credentials are saved in Settings tab |
| Login form not detected | The portal may have changed — open an issue |
| Infinite login loop | The extension has built-in loop prevention, but if it happens, disable Auto-Login temporarily |
| Speed test fails | You may not be connected to the internet yet |

## 🤝 Notes

- If the captive portal page structure changes, the content script selectors may need updating
- The speed test uses a small public file download — results are approximate
- `navigator.connection` API may not be available in all browsers (connection type/downlink)

---

Made with ❤️ at LPU
# LPUInternetExtension

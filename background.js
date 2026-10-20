/**
 * LPU Auto-Connect — Background Service Worker (v3.0.1)
 * Handles: session tracking, badge updates, speed test, network detection,
 *          session keep-alive, and data usage tracking.
 */

// ─── Session & Login Status ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'LOGIN_STATUS') return;

    const tabId = sender.tab ? sender.tab.id : null;

    switch (message.status) {
        case 'login_attempted':
            console.log('[LPU Auto-Connect] Login attempted.');
            chrome.storage.local.set({
                sessionStart: message.timestamp,
                lastLoginAttempt: message.timestamp,
                connectionStatus: 'connecting'
            });
            chrome.action.setBadgeText({ text: '...' });
            chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });

            setTimeout(() => {
                chrome.storage.local.get(['connectionStatus'], (data) => {
                    if (data.connectionStatus === 'connecting') {
                        chrome.storage.local.set({ connectionStatus: 'connected' });
                        chrome.action.setBadgeText({ text: '✓' });
                        chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
                        chrome.storage.local.get(['loginCount'], (c) => {
                            chrome.storage.local.set({ loginCount: (c.loginCount || 0) + 1 });
                        });
                    }
                });
            }, 3000);

            // Auto-close tab — verify page changed before closing
            if (message.autoClose && tabId) {
                let checks = 0;
                const maxChecks = 10;
                const checkAndClose = () => {
                    checks++;
                    chrome.tabs.get(tabId, (tab) => {
                        if (chrome.runtime.lastError || !tab) return;
                        const url = (tab.url || '').toLowerCase();
                        const loginDone = url.includes('client.jsp') && !url.includes('login');
                        const successPage = url.includes('success') || url.includes('logged');
                        if (loginDone || successPage || checks >= maxChecks) {
                            chrome.tabs.remove(tabId).catch(() => { });
                        } else if (checks < maxChecks) {
                            setTimeout(checkAndClose, 1500);
                        }
                    });
                };
                setTimeout(checkAndClose, 3000);
            }
            break;

        case 'already_logged_in':
            chrome.storage.local.set({ connectionStatus: 'connected' });
            chrome.action.setBadgeText({ text: '✓' });
            chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
            break;

        case 'no_credentials':
            chrome.action.setBadgeText({ text: '!' });
            chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
            break;

        case 'login_button_not_found':
            chrome.storage.local.set({ connectionStatus: 'error' });
            chrome.action.setBadgeText({ text: '✗' });
            chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
            break;
    }
    sendResponse({ received: true });
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeText({ text: '' });
    // Set default settings
    chrome.storage.local.get(['keepAlive', 'darkMode', 'dataCapMB'], (data) => {
        const defaults = {};
        if (data.keepAlive === undefined) defaults.keepAlive = true;
        if (data.darkMode === undefined) defaults.darkMode = false;
        if (data.dataCapMB === undefined) defaults.dataCapMB = 2048; // 2GB default
        if (Object.keys(defaults).length > 0) {
            chrome.storage.local.set(defaults);
        }
    });
    // Start keep-alive alarm
    setupKeepAlive(true);
});

// ─── Session Keep-Alive ──────────────────────────────────────────────
// Pings internet.lpu.in every 15 minutes to prevent captive portal timeout.
// Only active when keepAlive setting is true.

function setupKeepAlive(enabled) {
    if (enabled) {
        chrome.alarms.create('keepAlive', { periodInMinutes: 15 });
        console.log('[LPU Auto-Connect] Keep-alive alarm set (every 15min).');
    } else {
        chrome.alarms.clear('keepAlive');
        console.log('[LPU Auto-Connect] Keep-alive alarm cleared.');
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
        chrome.storage.local.get(['keepAlive', 'extensionEnabled'], (data) => {
            if (data.keepAlive === false || data.extensionEnabled === false) return;

            // Silently ping the portal to keep session alive
            fetch('http://internet.lpu.in', {
                cache: 'no-store',
                mode: 'no-cors'
            }).then(() => {
                console.log('[LPU Auto-Connect] Keep-alive ping sent.');
                chrome.storage.local.set({ lastKeepAlive: Date.now() });
            }).catch(() => {
                console.log('[LPU Auto-Connect] Keep-alive ping failed (offline?).');
            });
        });
    }
});

// Listen for setting changes to toggle keep-alive
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.keepAlive) {
        setupKeepAlive(changes.keepAlive.newValue);
    }
});

// ─── Data Usage Tracking ─────────────────────────────────────────────
// Uses chrome.webRequest.onCompleted to track real data consumption.
// Buffers in memory and flushes periodically to storage to prevent disk/quota throttling.

function getTodayKey() {
    const now = new Date();
    return `dataUsage_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

let sessionBytesBuffer = 0;

function flushDataUsage(callback) {
    if (sessionBytesBuffer <= 0) {
        if (callback) callback();
        return;
    }
    const toFlush = sessionBytesBuffer;
    sessionBytesBuffer = 0;
    const key = getTodayKey();
    chrome.storage.local.get([key], (data) => {
        const current = data[key] || 0;
        chrome.storage.local.set({ [key]: current + toFlush }, () => {
            if (callback) callback();
        });
    });
}

// Flush data usage every 6 seconds
setInterval(flushDataUsage, 6000);

chrome.webRequest.onCompleted.addListener(
    (details) => {
        let contentLength = 0;
        if (details.responseHeaders) {
            for (const header of details.responseHeaders) {
                if (header.name.toLowerCase() === 'content-length') {
                    contentLength = parseInt(header.value) || 0;
                    break;
                }
            }
        }
        if (contentLength === 0) contentLength = 3500; // conservative ~3.5KB fallback
        const totalEstimate = contentLength + 450; // include headers
        sessionBytesBuffer += totalEstimate;
        if (sessionBytesBuffer >= 131072) { // 128KB threshold
            flushDataUsage();
        }
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
);

// Message handler for getting data usage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_DATA_USAGE') {
        flushDataUsage(() => {
            const key = getTodayKey();
            chrome.storage.local.get([key, 'dataCapMB'], (data) => {
                sendResponse({
                    bytesUsed: (data[key] || 0) + sessionBytesBuffer,
                    dataCapMB: data.dataCapMB || 2048
                });
            });
        });
        return true;
    }
});

// ─── Speed Test (Real Live Multi-Chunk) ───────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SPEED_TEST') {
        runAccurateSpeedTest().then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true;
    }
});

async function runAccurateSpeedTest() {
    const chunks = [
        { bytes: 300000, label: '300KB' },
        { bytes: 1200000, label: '1.2MB' },
        { bytes: 3000000, label: '3MB' }
    ];

    let totalBytes = 0;
    let totalDurationSec = 0;
    let initialPingMs = null;

    try {
        const pingStart = performance.now();
        await fetch('https://speed.cloudflare.com/__down?bytes=0&t=' + Date.now(), { cache: 'no-store' });
        initialPingMs = Math.round(performance.now() - pingStart);
    } catch (e) {
        initialPingMs = null;
    }

    for (const chunk of chunks) {
        try {
            const startTime = performance.now();
            const response = await fetch(`https://speed.cloudflare.com/__down?bytes=${chunk.bytes}&t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) continue;

            const reader = response.body.getReader();
            let chunkBytes = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunkBytes += value.length;
            }

            const endTime = performance.now();
            const duration = (endTime - startTime) / 1000;
            if (duration > 0 && chunkBytes > 0) {
                totalBytes += chunkBytes;
                totalDurationSec += duration;
            }
        } catch (err) {
            console.warn('[Speed Test] chunk failed:', err);
        }
    }

    if (totalBytes === 0 || totalDurationSec === 0) {
        try {
            const start = performance.now();
            await fetch('https://www.google.com/generate_204?t=' + Date.now(), { cache: 'no-store', mode: 'no-cors' });
            const latency = Math.round(performance.now() - start);
            return { speedMbps: 0, latencyMs: latency, error: 'Speed test server unreachable' };
        } catch (e) {
            return { speedMbps: 0, latencyMs: 0, error: 'No internet connection detected' };
        }
    }

    const avgSpeedMbps = Math.round(((totalBytes * 8) / 1000000 / totalDurationSec) * 10) / 10;
    return {
        speedMbps: avgSpeedMbps,
        latencyMs: initialPingMs || 25,
        bytesTested: totalBytes
    };
}

// ─── Network Connectivity Check ──────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_NETWORK') {
        checkNetworkStatus().then(sendResponse).catch(err => {
            sendResponse({ status: 'offline', error: err.message });
        });
        return true;
    }
});

async function checkNetworkStatus() {
    const result = {
        online: navigator.onLine,
        networkType: 'unknown',
        authorized: false,
        ssid: null
    };

    if (!navigator.onLine) {
        result.status = 'disconnected';
        return result;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch('https://www.google.com/generate_204', {
            cache: 'no-store', mode: 'no-cors', signal: controller.signal
        });
        clearTimeout(timeout);
        result.authorized = true;
        result.status = 'authorized';
    } catch (err) {
        result.authorized = false;
        try {
            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 5000);
            await fetch('http://internet.lpu.in', {
                cache: 'no-store', mode: 'no-cors', signal: controller2.signal
            });
            clearTimeout(timeout2);
            result.status = 'unauthorized';
            result.networkType = 'lpu_wifi';
        } catch (e2) {
            result.status = 'disconnected';
        }
    }

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
        if (conn.type === 'cellular') result.networkType = 'cellular';
        else if (conn.type === 'wifi' && result.networkType !== 'lpu_wifi') result.networkType = 'other_wifi';
        else if (conn.type === 'ethernet') result.networkType = 'ethernet';
    }

    return result;
}



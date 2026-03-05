/**
 * LPU Auto-Connect — Background Service Worker (v2.0)
 * Handles: session tracking, badge updates, speed test, network detection,
 *          DNS config, VPN proxy, session keep-alive, and data usage tracking.
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

// ─── Install & Startup ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.get(['dnsProvider'], (data) => {
        if (!data.dnsProvider) {
            chrome.storage.local.set({ dnsProvider: 'default' });
        }
    });
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
// Uses chrome.webRequest.onCompleted to estimate data consumption.
// Tracks Content-Length from response headers, keyed by date for daily totals.

function getTodayKey() {
    const now = new Date();
    return `dataUsage_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

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
        if (contentLength === 0) contentLength = 5120; // ~5KB fallback
        const totalEstimate = contentLength + 500; // + request headers estimate
        const key = getTodayKey();
        chrome.storage.local.get([key], (data) => {
            const current = data[key] || 0;
            chrome.storage.local.set({ [key]: current + totalEstimate });
        });
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
);

// Message handler for getting data usage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_DATA_USAGE') {
        const key = getTodayKey();
        chrome.storage.local.get([key, 'dataCapMB'], (data) => {
            sendResponse({
                bytesUsed: data[key] || 0,
                dataCapMB: data.dataCapMB || 2048
            });
        });
        return true;
    }
});

// ─── Speed Test (Accurate Multi-Chunk) ───────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SPEED_TEST') {
        runAccurateSpeedTest().then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true;
    }
});

async function runAccurateSpeedTest() {
    const tests = [
        { url: 'https://speed.cloudflare.com/__down?bytes=100000', expectedBytes: 100000 },
        { url: 'https://speed.cloudflare.com/__down?bytes=1000000', expectedBytes: 1000000 },
        { url: 'https://speed.cloudflare.com/__down?bytes=5000000', expectedBytes: 5000000 },
    ];

    let bestSpeedMbps = 0;
    let totalLatencyMs = 0;
    let validTests = 0;

    for (const test of tests) {
        try {
            const startTime = performance.now();
            const response = await fetch(test.url + '&cachebust=' + Date.now(), { cache: 'no-store' });
            if (!response.ok) continue;

            const reader = response.body.getReader();
            let totalBytes = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                totalBytes += value.length;
            }

            const endTime = performance.now();
            const durationSeconds = (endTime - startTime) / 1000;
            const bytesUsed = totalBytes > 0 ? totalBytes : test.expectedBytes;
            const speedMbps = ((bytesUsed * 8) / 1000000) / durationSeconds;

            totalLatencyMs += (endTime - startTime);
            validTests++;
            if (speedMbps > bestSpeedMbps) bestSpeedMbps = speedMbps;

            console.log(`[Speed Test] ${(bytesUsed / 1024).toFixed(0)}KB in ${durationSeconds.toFixed(2)}s = ${speedMbps.toFixed(2)} Mbps`);
        } catch (err) {
            continue;
        }
    }

    if (validTests === 0) {
        try {
            const start = performance.now();
            await fetch('https://www.google.com/generate_204?t=' + Date.now(), { cache: 'no-store', mode: 'no-cors' });
            const latency = performance.now() - start;
            return { speedMbps: 0, latencyMs: Math.round(latency), error: 'Speed test servers unreachable.' };
        } catch (e) {
            return { speedMbps: 0, latencyMs: 0, error: 'No internet connection detected.' };
        }
    }

    return {
        speedMbps: Math.round(bestSpeedMbps * 100) / 100,
        latencyMs: Math.round(totalLatencyMs / validTests),
        chunksCompleted: validTests
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

// ─── DNS-over-HTTPS Configuration ────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_DNS') {
        chrome.storage.local.set({ dnsProvider: message.provider }, () => {
            sendResponse({ success: true, provider: message.provider });
        });
        return true;
    }
});

// ─── VPN Proxy (chrome.proxy API) ────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'SET_PROXY') return;

    if (message.enabled) {
        const { host, port, scheme } = message.config;
        const proxyConfig = {
            mode: 'fixed_servers',
            rules: {
                singleProxy: { scheme: scheme || 'http', host, port: parseInt(port) || 8080 },
                bypassList: ['internet.lpu.in', 'localhost', '127.0.0.1', '<local>']
            }
        };
        chrome.proxy.settings.set({ value: proxyConfig, scope: 'regular' }, () => {
            console.log('[LPU Auto-Connect] Proxy enabled:', host + ':' + port);
            chrome.storage.local.set({ vpnEnabled: true, proxyHost: host, proxyPort: port, proxyScheme: scheme });
            sendResponse({ success: true });
        });
    } else {
        chrome.proxy.settings.clear({ scope: 'regular' }, () => {
            console.log('[LPU Auto-Connect] Proxy disabled.');
            chrome.storage.local.set({ vpnEnabled: false });
            sendResponse({ success: true });
        });
    }
    return true;
});

// Restore proxy on startup
chrome.storage.local.get(['vpnEnabled', 'proxyHost', 'proxyPort', 'proxyScheme'], (data) => {
    if (data.vpnEnabled && data.proxyHost) {
        const proxyConfig = {
            mode: 'fixed_servers',
            rules: {
                singleProxy: { scheme: data.proxyScheme || 'http', host: data.proxyHost, port: parseInt(data.proxyPort) || 8080 },
                bypassList: ['internet.lpu.in', 'localhost', '127.0.0.1', '<local>']
            }
        };
        chrome.proxy.settings.set({ value: proxyConfig, scope: 'regular' });
    }
});

// DNS Provider info
const DNS_PROVIDERS = {
    default: { name: 'System Default', dns: 'Automatic', doh: null },
    cloudflare: { name: 'Cloudflare', dns: '1.1.1.1 / 1.0.0.1', doh: 'https://cloudflare-dns.com/dns-query' },
    google: { name: 'Google DNS', dns: '8.8.8.8 / 8.8.4.4', doh: 'https://dns.google/dns-query' },
    quad9: { name: 'Quad9', dns: '9.9.9.9 / 149.112.112.112', doh: 'https://dns.quad9.net/dns-query' },
    adguard: { name: 'AdGuard DNS', dns: '94.140.14.14 / 94.140.15.15', doh: 'https://dns.adguard-dns.com/dns-query' }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_DNS_PROVIDERS') {
        sendResponse(DNS_PROVIDERS);
        return false;
    }
});

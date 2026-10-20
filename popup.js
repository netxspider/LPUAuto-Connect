/**
 * LPU Auto-Connect v3.0.1 — Popup Script
 * Features: Apple glassmorphism UI, fluid dashboard, data usage tracking, network health,
 *           speed test, quick links, multi-account manager, keep-alive, dark mode, and session tracking.
 * Supported in both Chrome Extension and Browser Preview environments.
 */
(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ─── Unified Storage Wrapper (Chrome Extension & Web Preview) ───
    const storage = {
        get: function (keys, cb) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(keys, cb);
                return;
            }
            const res = {};
            const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || {}));
            keyList.forEach(k => {
                try {
                    const v = localStorage.getItem('lpu_' + k);
                    if (v !== null) res[k] = JSON.parse(v);
                    else if (keys && typeof keys === 'object' && !Array.isArray(keys) && k in keys) res[k] = keys[k];
                } catch (e) {
                    res[k] = localStorage.getItem('lpu_' + k);
                }
            });
            if (cb) setTimeout(() => cb(res), 0);
        },
        set: function (items, cb) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set(items, cb);
                return;
            }
            if (items && typeof items === 'object') {
                Object.keys(items).forEach(k => {
                    try {
                        localStorage.setItem('lpu_' + k, JSON.stringify(items[k]));
                    } catch (e) {
                        localStorage.setItem('lpu_' + k, String(items[k]));
                    }
                });
            }
            if (cb) setTimeout(cb, 0);
        },
        remove: function (keys, cb) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.remove(keys, cb);
                return;
            }
            const keyList = Array.isArray(keys) ? keys : [keys];
            keyList.forEach(k => localStorage.removeItem('lpu_' + k));
            if (cb) setTimeout(cb, 0);
        }
    };

    // Safe Runtime Message Dispatcher
    function sendRuntimeMessage(msg, cb) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                chrome.runtime.sendMessage(msg, (res) => {
                    const err = chrome.runtime.lastError;
                    if (cb) cb(res, err);
                });
                return;
            } catch (e) {
                if (cb) cb(null, e);
                return;
            }
        }
        // Preview mode fallback
        if (cb) {
            setTimeout(() => {
                if (msg.type === 'CHECK_NETWORK') {
                    cb({ online: navigator.onLine, status: navigator.onLine ? 'authorized' : 'disconnected', authorized: navigator.onLine });
                } else {
                    cb({});
                }
            }, 50);
        }
    }

    // Safe Link Opener
    function openUrl(url) {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url });
        } else {
            window.open(url, '_blank');
        }
    }

    // ─── DOM References ──────────────────────────────────────────────
    const statusSubtitle = $('#statusSubtitle');
    const extensionToggle = $('#extensionToggle');
    const themeToggle = $('#themeToggle');
    const donateBtn = $('#donateBtn');
    const clearUmsBtn = $('#clearUmsCredentials');
    const clearNeoBtn = $('#clearNeoCredentials');
    const appEl = document.querySelector('.app');

    const tabs = $$('.tab');
    const tabContents = $$('.tab-content');

    // Dashboard
    const dataUsedValue = $('#dataUsedValue');
    const healthEmoji = $('#healthEmoji');
    const healthRTT = $('#healthRTT');
    const healthLabel = $('#healthLabel');
    const speedValue = $('#speedValue');
    const latencyValue = $('#latencyValue');
    const connectionType = $('#connectionType');
    const runSpeedTestBtn = $('#runSpeedTest');
    const speedProgress = $('#speedProgress');
    const sessionTime = $('#sessionTime');
    const loginCountEl = $('#loginCount');
    const downlinkValue = $('#downlinkValue');

    // Settings & Toggles
    const toggleAutoLogin = $('#toggleAutoLogin');
    const toggleAutoClose = $('#toggleAutoClose');
    const toggleKeepAlive = $('#toggleKeepAlive');
    const toggleDarkMode = $('#toggleDarkMode');
    const saveToast = $('#saveToast');
    const saveToastMsg = $('#saveToastMsg');

    // Multi-Account (WiFi)
    const wifiStatusBadge = $('#wifiStatusBadge');
    const accountsList = $('#accountsList');
    const addAccountBannerBtn = $('#addAccountBannerBtn');
    const addAccountForm = $('#addAccountForm');
    const newAccountName = $('#newAccountName');
    const newAccountUser = $('#newAccountUser');
    const newAccountPass = $('#newAccountPass');
    const saveNewAccount = $('#saveNewAccount');
    const cancelNewAccount = $('#cancelNewAccount');

    // UMS / Portal Credentials & Status Badges
    const umsUsername = $('#umsUsername');
    const umsPassword = $('#umsPassword');
    const saveUmsCredentials = $('#saveUmsCredentials');
    const umsStatusBadge = $('#umsStatusBadge');

    // NeoBrowser
    const neoUsername = $('#neoUsername');
    const neoPassword = $('#neoPassword');
    const saveNeoCredentials = $('#saveNeoCredentials');
    const neoStatusBadge = $('#neoStatusBadge');

    // Portal Status Badge Helper
    function updatePortalBadge(badgeEl, isSet) {
        if (!badgeEl) return;
        if (isSet) {
            badgeEl.className = 'portal-status-badge set';
            badgeEl.textContent = 'Set';
        } else {
            badgeEl.className = 'portal-status-badge not-set';
            badgeEl.textContent = 'Not Set';
        }
    }

    // Quick Links
    const quicklinks = $$('.quicklink');

    // ─── Tab Navigation (Apple Glassmorphism) ─────────────────────────
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tabContents.forEach(tc => tc.classList.remove('active'));

            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const target = $(`#tab-${tab.dataset.tab}`);
            if (target) {
                target.classList.add('active');
            }
        });
    });

    // ─── Network Status ──────────────────────────────────────────────
    function checkNetwork() {
        sendRuntimeMessage({ type: 'CHECK_NETWORK' }, (response, err) => {
            if (err || !response) {
                updateNetworkUI({
                    online: navigator.onLine,
                    status: navigator.onLine ? 'unknown' : 'disconnected',
                    networkType: 'unknown',
                    authorized: false
                });
            } else {
                updateNetworkUI(response);
            }
        });
    }

    function updateNetworkUI(info) {
        if (!statusSubtitle) return;
        const { online, status, authorized } = info;

        if (!online) {
            statusSubtitle.textContent = 'Disconnected';
        } else if (status === 'authorized' || authorized) {
            statusSubtitle.textContent = 'Connected & Active';
        } else if (status === 'unauthorized') {
            statusSubtitle.textContent = 'Login Required';
        } else {
            statusSubtitle.textContent = 'Network Active';
        }
    }

    // ─── Data Usage Tracking ─────────────────────────────────────────
    function getTodayKey() {
        const now = new Date();
        return `dataUsage_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 MB';
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
        if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
        return bytes + ' B';
    }

    function updateDataUsage() {
        if (!dataUsedValue) return;
        const key = getTodayKey();
        sendRuntimeMessage({ type: 'GET_DATA_USAGE' }, (res, err) => {
            if (!err && res && typeof res.bytesUsed === 'number' && res.bytesUsed > 0) {
                dataUsedValue.textContent = formatBytes(res.bytesUsed);
                storage.set({ [key]: res.bytesUsed });
                return;
            }

            // Fallback / Standalone mode: track from stored daily key or performance entries
            storage.get([key], (d) => {
                let bytes = d[key] || 0;
                try {
                    const entries = performance.getEntriesByType('resource');
                    let perfBytes = 0;
                    entries.forEach(e => {
                        perfBytes += (e.transferSize || e.decodedBodySize || 0);
                    });
                    if (perfBytes > bytes) {
                        bytes = perfBytes;
                        storage.set({ [key]: bytes });
                    }
                } catch (e) {}
                dataUsedValue.textContent = formatBytes(bytes);
            });
        });
    }

    // ─── Real Network Latency (RTT) ──────────────────────────────────
    async function measureRealLatency() {
        try {
            const start = performance.now();
            await fetch('https://speed.cloudflare.com/__down?bytes=0&t=' + Date.now(), { cache: 'no-store' });
            return Math.round(performance.now() - start);
        } catch (e) {
            try {
                const start2 = performance.now();
                await fetch('https://www.google.com/generate_204?t=' + Date.now(), { cache: 'no-store', mode: 'no-cors' });
                return Math.round(performance.now() - start2);
            } catch (e2) {
                return null;
            }
        }
    }

    async function updateNetworkHealth() {
        if (!healthEmoji || !healthRTT || !healthLabel) return;
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let effectiveType = 'WiFi';

        if (conn && conn.effectiveType) {
            effectiveType = conn.effectiveType.toUpperCase();
        }
        if (connectionType) {
            connectionType.textContent = effectiveType;
        }

        if (!navigator.onLine) {
            healthEmoji.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
            healthRTT.textContent = 'Offline';
            healthLabel.textContent = 'Disconnected';
            if (latencyValue) latencyValue.textContent = '—';
            return;
        }

        const rtt = await measureRealLatency();

        if (rtt === null || rtt === undefined) {
            healthEmoji.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>';
            healthRTT.textContent = '— ms';
            healthLabel.textContent = 'Ping Unavailable';
            return;
        }

        healthRTT.textContent = rtt + ' ms';
        if (latencyValue) latencyValue.textContent = rtt + 'ms';
        storage.set({ lastLatencyMs: rtt });

        if (rtt < 50) {
            healthEmoji.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round"><path d="M6 12L3.27 3.13A1 1 0 0 1 4.38 2l16.24 8.11a1 1 0 0 1 0 1.78L4.38 20a1 1 0 0 1-1.11-1.13L6 12z"/></svg>';
            healthLabel.textContent = 'Gaming Ready';
        } else if (rtt < 100) {
            healthEmoji.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
            healthLabel.textContent = 'Low Latency';
        } else if (rtt <= 250) {
            healthEmoji.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>';
            healthLabel.textContent = 'Fast';
        } else if (rtt <= 450) {
            healthEmoji.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>';
            healthLabel.textContent = 'Moderate';
        } else {
            healthEmoji.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
            healthLabel.textContent = 'WiFi Dying';
        }
    }

    // ─── Quick Links ─────────────────────────────────────────────────
    quicklinks.forEach(ql => {
        ql.addEventListener('click', () => {
            openUrl(ql.dataset.url);
        });
    });

    // ─── Real Speed Test (Streaming Live Multi-Chunk) ────────────────
    async function executeRealSpeedTest(onProgress) {
        const chunks = [
            { bytes: 300000, label: '300KB' },
            { bytes: 1200000, label: '1.2MB' },
            { bytes: 2500000, label: '2.5MB' }
        ];

        let totalBytes = 0;
        let totalDurationSec = 0;
        let initialLatency = null;

        const pingStart = performance.now();
        try {
            await fetch('https://speed.cloudflare.com/__down?bytes=0&t=' + Date.now(), { cache: 'no-store' });
            initialLatency = Math.round(performance.now() - pingStart);
        } catch (e) {
            initialLatency = 30;
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const startTime = performance.now();
            try {
                const response = await fetch(`https://speed.cloudflare.com/__down?bytes=${chunk.bytes}&t=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) continue;

                const reader = response.body.getReader();
                let downloaded = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    downloaded += value.length;
                    const elapsed = (performance.now() - startTime) / 1000;
                    if (elapsed > 0.05) {
                        const currentMbps = ((downloaded * 8) / 1000000) / elapsed;
                        const pct = Math.min(95, Math.round(((i + (downloaded / chunk.bytes)) / chunks.length) * 100));
                        if (onProgress) onProgress(currentMbps, pct);
                    }
                }

                const chunkDuration = (performance.now() - startTime) / 1000;
                if (chunkDuration > 0 && downloaded > 0) {
                    totalBytes += downloaded;
                    totalDurationSec += chunkDuration;
                }
            } catch (err) {
                console.warn('[Speed Test] chunk failed:', err);
            }
        }

        if (totalBytes === 0 || totalDurationSec === 0) {
            throw new Error('Speed test server unreachable');
        }

        const avgSpeedMbps = Math.round(((totalBytes * 8) / 1000000 / totalDurationSec) * 10) / 10;
        return {
            speedMbps: avgSpeedMbps,
            latencyMs: initialLatency,
            totalBytes
        };
    }

    let isTestRunning = false;
    if (runSpeedTestBtn) {
        runSpeedTestBtn.addEventListener('click', async () => {
            if (isTestRunning) return;
            isTestRunning = true;
            runSpeedTestBtn.classList.add('loading');
            runSpeedTestBtn.innerHTML = `
                <svg class="spinning" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <span>Testing Speed...</span>
            `;
            runSpeedTestBtn.disabled = true;
            speedProgress.classList.add('active');
            const progressFill = speedProgress.querySelector('.fluid-progress-fill');
            if (progressFill) progressFill.style.width = '10%';
            speedValue.textContent = '...';
            latencyValue.textContent = '...';

            try {
                const result = await executeRealSpeedTest((liveMbps, pct) => {
                    speedValue.textContent = liveMbps.toFixed(1);
                    if (progressFill) progressFill.style.width = pct + '%';
                });

                if (progressFill) progressFill.style.width = '100%';
                speedValue.textContent = result.speedMbps.toFixed(1);
                latencyValue.textContent = `${result.latencyMs}ms`;
                if (downlinkValue) downlinkValue.textContent = `${result.speedMbps.toFixed(1)} Mb/s`;
                if (healthRTT) healthRTT.textContent = `${result.latencyMs} ms`;

                storage.set({ lastSpeedMbps: result.speedMbps, lastLatencyMs: result.latencyMs });

                // Add real bytes downloaded in speed test to today's data usage
                const key = getTodayKey();
                storage.get([key], (d) => {
                    const current = d[key] || 0;
                    const updated = current + result.totalBytes;
                    storage.set({ [key]: updated }, () => {
                        if (dataUsedValue) dataUsedValue.textContent = formatBytes(updated);
                    });
                });
            } catch (err) {
                speedValue.textContent = '!';
                latencyValue.textContent = 'Error';
                showToast(saveToast, saveToastMsg, 'Speed test failed (network offline)');
            } finally {
                setTimeout(() => {
                    speedProgress.classList.remove('active');
                    if (progressFill) progressFill.style.width = '0%';
                }, 600);
                runSpeedTestBtn.classList.remove('loading');
                runSpeedTestBtn.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Run Speed Test</span>
                `;
                runSpeedTestBtn.disabled = false;
                isTestRunning = false;
            }
        });
    }

    // ─── Load Settings ───────────────────────────────────────────────
    function loadSettings() {
        storage.get([
            'autoLogin', 'autoClose', 'keepAlive', 'darkMode',
            'neoUsername', 'neoPassword', 'umsUsername', 'umsPassword', 'lastSpeedMbps',
            'extensionEnabled', 'uiTheme'
        ], (data) => {
            // Extension toggle (default: enabled)
            const isEnabled = data.extensionEnabled !== false;
            if (extensionToggle) extensionToggle.checked = isEnabled;
            if (appEl) appEl.classList.toggle('disabled', !isEnabled);

            // Theme (default: dark)
            const isLight = data.uiTheme === 'light';
            if (appEl) appEl.classList.toggle('light-theme', isLight);

            if (toggleAutoLogin) toggleAutoLogin.checked = data.autoLogin !== false;
            if (toggleAutoClose) toggleAutoClose.checked = data.autoClose !== false;
            if (toggleKeepAlive) toggleKeepAlive.checked = data.keepAlive !== false;
            if (toggleDarkMode) toggleDarkMode.checked = data.darkMode === true;

            if (data.neoUsername && neoUsername) neoUsername.value = data.neoUsername;
            if (data.neoPassword && neoPassword) neoPassword.value = data.neoPassword;
            if (data.umsUsername && umsUsername) umsUsername.value = data.umsUsername;
            if (data.umsPassword && umsPassword) umsPassword.value = data.umsPassword;

            updatePortalBadge(umsStatusBadge, !!(data.umsUsername && data.umsUsername.trim()));
            updatePortalBadge(neoStatusBadge, !!(data.neoUsername && data.neoUsername.trim()));

            if (data.lastSpeedMbps && downlinkValue) {
                downlinkValue.textContent = data.lastSpeedMbps + ' Mb/s';
            } else if (downlinkValue) {
                downlinkValue.textContent = '—';
            }
        });
    }

    // ─── Auto-Save Toggles (immediate on change) ────────────────────
    function autoSaveToggle(el, key, label) {
        if (!el) return;
        el.addEventListener('change', () => {
            storage.set({ [key]: el.checked }, () => {
                showToast(saveToast, saveToastMsg, `${label} ${el.checked ? 'enabled' : 'disabled'}`);
            });
        });
    }
    autoSaveToggle(toggleAutoLogin, 'autoLogin', 'Auto-Login');
    autoSaveToggle(toggleAutoClose, 'autoClose', 'Auto-Close Tab');
    autoSaveToggle(toggleKeepAlive, 'keepAlive', 'Session Keep-Alive');
    autoSaveToggle(toggleDarkMode, 'darkMode', 'Portal Dark Mode');

    // ─── Extension Enable/Disable Master Toggle ──────────────────────
    if (extensionToggle) {
        extensionToggle.addEventListener('change', () => {
            const enabled = extensionToggle.checked;
            storage.set({ extensionEnabled: enabled }, () => {
                if (appEl) appEl.classList.toggle('disabled', !enabled);
                showToast(saveToast, saveToastMsg, `Extension ${enabled ? 'enabled' : 'disabled'}`);
            });
        });
    }

    // ─── Theme Toggle (Light / Dark) ──────────────────────────────────
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (!appEl) return;
            const isLight = appEl.classList.toggle('light-theme');
            storage.set({ uiTheme: isLight ? 'light' : 'dark' });
            showToast(saveToast, saveToastMsg, isLight ? 'Light theme activated' : 'Dark theme activated');
        });
    }

    // ─── Clear Credential Buttons ─────────────────────────────────────
    if (clearUmsBtn) {
        clearUmsBtn.addEventListener('click', () => {
            storage.remove(['umsUsername', 'umsPassword'], () => {
                if (umsUsername) umsUsername.value = '';
                if (umsPassword) umsPassword.value = '';
                updatePortalBadge(umsStatusBadge, false);
                showToast(saveToast, saveToastMsg, 'UMS credentials cleared');
            });
        });
    }

    if (clearNeoBtn) {
        clearNeoBtn.addEventListener('click', () => {
            storage.remove(['neoUsername', 'neoPassword'], () => {
                if (neoUsername) neoUsername.value = '';
                if (neoPassword) neoPassword.value = '';
                updatePortalBadge(neoStatusBadge, false);
                showToast(saveToast, saveToastMsg, 'NeoBrowser credentials cleared');
            });
        });
    }

    // ─── Buy Me a Coffee ─────────────────────────────────────────────
    if (donateBtn) {
        donateBtn.addEventListener('click', () => {
            openUrl('https://razorpay.me/@netxspider');
        });
    }

    // ─── Multi-Account System (WiFi Accounts) ────────────────────────
    function loadAccounts() {
        if (!accountsList) return;
        if (addAccountForm && addAccountForm.style.display === 'block') {
            accountsList.classList.add('minimized');
            if (addAccountBannerBtn) addAccountBannerBtn.classList.add('minimized');
        } else {
            accountsList.classList.remove('minimized');
            if (addAccountBannerBtn) addAccountBannerBtn.classList.remove('minimized');
        }
        storage.get(['accounts', 'activeAccountId', 'lpuUsername'], (data) => {
            let accounts = data.accounts || [];

            // If no accounts exist but legacy credentials exist, migrate them
            if (accounts.length === 0 && data.lpuUsername) {
                storage.get(['lpuPassword'], (d2) => {
                    const migrated = [{
                        id: Date.now().toString(),
                        name: 'Main',
                        username: data.lpuUsername,
                        password: d2.lpuPassword || ''
                    }];
                    storage.set({
                        accounts: migrated,
                        activeAccountId: migrated[0].id
                    }, () => loadAccounts());
                });
                return;
            }

            // Update WiFi Accounts "Set" / "Not Set" status badge
            const hasAccounts = accounts.length > 0;
            updatePortalBadge(wifiStatusBadge, hasAccounts);

            const activeId = data.activeAccountId || (hasAccounts ? accounts[0].id : null);
            accountsList.innerHTML = '';

            if (accounts.length === 0) {
                accountsList.innerHTML = `
                    <div class="accounts-empty-state">
                        <div class="empty-icon-ring">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                                <circle cx="12" cy="20" r="1" fill="currentColor" />
                            </svg>
                        </div>
                        <p class="empty-title">No WiFi Accounts Saved</p>
                        <p class="empty-subtitle">Add your registration credentials for auto-login to LPU WiFi.</p>
                    </div>
                `;
                return;
            }

            accounts.forEach(acc => {
                const isActive = acc.id === activeId;
                const item = document.createElement('div');
                item.className = 'account-card' + (isActive ? ' active' : '');
                item.setAttribute('role', 'button');
                item.setAttribute('tabindex', '0');
                item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                item.title = isActive ? `${acc.name} is active` : `Click to activate ${acc.name}`;

                item.innerHTML = `
                    <div class="account-radio-box">
                        <div class="apple-radio ${isActive ? 'selected' : ''}"></div>
                    </div>
                    <div class="account-details">
                        <div class="account-top-line">
                            <span class="account-name">${escapeHtml(acc.name)}</span>
                            ${isActive ? '<span class="active-badge">Active</span>' : ''}
                        </div>
                        <span class="account-reg-number">${escapeHtml(acc.username)}</span>
                    </div>
                    <button class="account-trash-btn" title="Delete ${escapeHtml(acc.name)}" type="button" aria-label="Delete account">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                `;

                // Clicking anywhere on the card selects/switches to this account
                item.addEventListener('click', (e) => {
                    const trash = e.target && typeof e.target.closest === 'function' ? e.target.closest('.account-trash-btn') : null;
                    if (trash) return;
                    switchAccount(acc.id);
                });

                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        const trash = e.target && typeof e.target.closest === 'function' ? e.target.closest('.account-trash-btn') : null;
                        if (trash) return;
                        e.preventDefault();
                        switchAccount(acc.id);
                    }
                });

                // Delete button
                const trashBtn = item.querySelector('.account-trash-btn');
                if (trashBtn) {
                    trashBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteAccount(acc.id);
                    });
                }

                accountsList.appendChild(item);
            });
        });
    }

    function switchAccount(accountId) {
        storage.get(['accounts'], (data) => {
            const accounts = data.accounts || [];
            const acc = accounts.find(a => a.id === accountId);
            if (!acc) return;

            storage.set({
                activeAccountId: accountId,
                lpuUsername: acc.username,
                lpuPassword: acc.password
            }, () => {
                loadAccounts();
                updatePortalBadge(wifiStatusBadge, true);
                showToast(saveToast, saveToastMsg, `Active account: "${acc.name}" (${acc.username})`);

                // Auto-set NeoBrowser defaults if unset or using default domain pattern
                storage.get(['neoUsername'], (d) => {
                    if (!d.neoUsername || d.neoUsername.endsWith('@neocolab.ai')) {
                        storage.set({
                            neoUsername: acc.username + '@neocolab.ai',
                            neoPassword: acc.username
                        }, () => {
                            if (neoUsername) neoUsername.value = acc.username + '@neocolab.ai';
                            if (neoPassword) neoPassword.value = acc.username;
                            updatePortalBadge(neoStatusBadge, true);
                        });
                    }
                });
            });
        });
    }

    function deleteAccount(accountId) {
        storage.get(['accounts', 'activeAccountId'], (data) => {
            let accounts = (data.accounts || []).filter(a => a.id !== accountId);
            const updates = { accounts };

            if (data.activeAccountId === accountId && accounts.length > 0) {
                updates.activeAccountId = accounts[0].id;
                updates.lpuUsername = accounts[0].username;
                updates.lpuPassword = accounts[0].password;
            } else if (accounts.length === 0) {
                updates.activeAccountId = null;
                updates.lpuUsername = '';
                updates.lpuPassword = '';
            }

            storage.set(updates, () => {
                loadAccounts();
                updatePortalBadge(wifiStatusBadge, accounts.length > 0);
                showToast(saveToast, saveToastMsg, 'Account removed');
            });
        });
    }

    // Toggle Add Account Form & Minimize Account List
    function openAddAccountForm() {
        if (!addAccountForm) return;
        if (accountsList) accountsList.classList.add('minimized');
        if (addAccountBannerBtn) addAccountBannerBtn.classList.add('minimized');
        addAccountForm.style.display = 'block';
        if (newAccountName) {
            newAccountName.value = '';
            newAccountName.focus();
        }
        if (newAccountUser) newAccountUser.value = '';
        if (newAccountPass) newAccountPass.value = '';
        addAccountForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function closeAddAccountForm() {
        if (addAccountForm) addAccountForm.style.display = 'none';
        if (accountsList) accountsList.classList.remove('minimized');
        if (addAccountBannerBtn) addAccountBannerBtn.classList.remove('minimized');
    }

    if (addAccountBannerBtn) {
        addAccountBannerBtn.addEventListener('click', openAddAccountForm);
    }

    if (cancelNewAccount) {
        cancelNewAccount.addEventListener('click', closeAddAccountForm);
    }

    if (saveNewAccount) {
        saveNewAccount.addEventListener('click', () => {
            const name = (newAccountName && newAccountName.value.trim()) || 'Account';
            const user = newAccountUser ? newAccountUser.value.trim() : '';
            const pass = newAccountPass ? newAccountPass.value : '';

            if (!user || !pass) {
                if (!user && newAccountUser) shakeElement(newAccountUser);
                if (!pass && newAccountPass) shakeElement(newAccountPass);
                showToast(saveToast, saveToastMsg, 'Please enter Registration Number & Password');
                return;
            }

            const newAcc = { id: Date.now().toString(), name, username: user, password: pass };

            storage.get(['accounts'], (data) => {
                const accounts = data.accounts || [];
                accounts.push(newAcc);
                const updates = {
                    accounts,
                    activeAccountId: newAcc.id,
                    lpuUsername: newAcc.username,
                    lpuPassword: newAcc.password
                };

                storage.set(updates, () => {
                    closeAddAccountForm();
                    loadAccounts();
                    updatePortalBadge(wifiStatusBadge, true);
                    showToast(saveToast, saveToastMsg, `Account "${name}" saved & set as active!`);

                    // Pre-fill UMS registration number if UMS field is empty
                    if (umsUsername && !umsUsername.value) {
                        storage.get(['umsUsername'], (uData) => {
                            if (!uData.umsUsername && umsUsername) {
                                umsUsername.value = user;
                            }
                        });
                    }
                });
            });
        });
    }

    // ─── UMS Credentials ─────────────────────────────────────────────
    if (saveUmsCredentials) {
        saveUmsCredentials.addEventListener('click', () => {
            const user = umsUsername ? umsUsername.value.trim() : '';
            const pass = umsPassword ? umsPassword.value : '';
            if (!user) {
                shakeElement(umsUsername);
                showToast(saveToast, saveToastMsg, 'Please enter Registration Number');
                return;
            }
            if (!pass) {
                shakeElement(umsPassword);
                showToast(saveToast, saveToastMsg, 'Please enter UMS Password');
                return;
            }
            storage.set({ umsUsername: user, umsPassword: pass }, () => {
                updatePortalBadge(umsStatusBadge, true);
                showToast(saveToast, saveToastMsg, 'UMS credentials saved & set!');
            });
        });
    }

    // ─── NeoBrowser Credentials ──────────────────────────────────────
    if (saveNeoCredentials) {
        saveNeoCredentials.addEventListener('click', () => {
            const user = neoUsername ? neoUsername.value.trim() : '';
            const pass = neoPassword ? neoPassword.value : '';
            if (!user) {
                shakeElement(neoUsername);
                showToast(saveToast, saveToastMsg, 'Please enter Neo Email / Username');
                return;
            }
            if (!pass) {
                shakeElement(neoPassword);
                showToast(saveToast, saveToastMsg, 'Please enter Neo Password');
                return;
            }
            storage.set({ neoUsername: user, neoPassword: pass }, () => {
                updatePortalBadge(neoStatusBadge, true);
                showToast(saveToast, saveToastMsg, 'NeoBrowser credentials saved & set!');
            });
        });
    }

    // ─── Session Time Tracking ───────────────────────────────────────
    function updateSessionTime(startTime) {
        if (!sessionTime) return;
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const hours = Math.floor(minutes / 60);
        sessionTime.textContent = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
    }

    function loadStoredStatus() {
        storage.get(['sessionStart', 'loginCount'], (data) => {
            if (loginCountEl) loginCountEl.textContent = data.loginCount || 0;
            if (data.sessionStart) updateSessionTime(data.sessionStart);
        });
    }

    // ─── Utility Functions ───────────────────────────────────────────
    function showToast(toastEl, msgEl, text) {
        if (!toastEl) return;
        if (msgEl && text) msgEl.textContent = text;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 2500);
    }

    function shakeElement(el) {
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight; // trigger reflow
        el.style.animation = 'shake 0.4s ease';
        el.style.borderColor = 'rgba(239,68,68,0.7)';
        setTimeout(() => {
            el.style.borderColor = '';
            el.style.animation = '';
        }, 1000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // ─── Real-time Storage Listener ──────────────────────────────────
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes.loginCount && loginCountEl) {
                loginCountEl.textContent = changes.loginCount.newValue || 0;
            }
            if (changes.sessionStart) {
                updateSessionTime(changes.sessionStart.newValue);
            }
            if (changes.extensionEnabled && extensionToggle) {
                const enabled = changes.extensionEnabled.newValue !== false;
                extensionToggle.checked = enabled;
                if (appEl) appEl.classList.toggle('disabled', !enabled);
            }
        });
    }

    // ─── Initialize ──────────────────────────────────────────────────
    loadSettings();
    loadStoredStatus();
    loadAccounts();
    checkNetwork();
    updateDataUsage();
    updateNetworkHealth();

    // Periodic Background Timers
    setInterval(checkNetwork, 30000);
    setInterval(updateDataUsage, 15000);
    setInterval(() => {
        storage.get(['sessionStart'], (data) => {
            if (data.sessionStart) updateSessionTime(data.sessionStart);
        });
    }, 30000);
})();

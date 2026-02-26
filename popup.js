/**
 * LPU Auto-Connect v2.0 — Popup Script
 * Features: data usage tracking, network health, quick links, multi-account,
 *           VPN proxy, DNS config, keep-alive, dark mode, and session tracking.
 */
(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ─── DOM References ──────────────────────────────────────────────
    const statusSubtitle = $('#statusSubtitle');
    const extensionToggle = $('#extensionToggle');
    const donateBtn = $('#donateBtn');

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

    // VPN
    const toggleVPN = $('#toggleVPN');
    const vpnDot = $('#vpnDot');
    const vpnLabel = $('#vpnLabel');
    const proxyHost = $('#proxyHost');
    const proxyPort = $('#proxyPort');
    const proxyScheme = $('#proxyScheme');
    const saveProxyBtn = $('#saveProxy');

    // DNS
    const dnsOptions = $$('.dns-option');
    const currentDNS = $('#currentDNS');
    const applyDNSBtn = $('#applyDNS');
    const dnsToast = $('#dnsToast');
    const dnsToastMsg = $('#dnsToastMsg');
    const openChromeSecureDNS = $('#openChromeSecureDNS');

    // Settings
    const toggleAutoLogin = $('#toggleAutoLogin');
    const toggleAutoClose = $('#toggleAutoClose');
    const toggleKeepAlive = $('#toggleKeepAlive');
    const toggleDarkMode = $('#toggleDarkMode');
    const saveToast = $('#saveToast');
    const saveToastMsg = $('#saveToastMsg');

    // Multi-Account
    const accountsList = $('#accountsList');
    const addAccountBtn = $('#addAccountBtn');
    const addAccountForm = $('#addAccountForm');
    const newAccountName = $('#newAccountName');
    const newAccountUser = $('#newAccountUser');
    const newAccountPass = $('#newAccountPass');
    const saveNewAccount = $('#saveNewAccount');
    const cancelNewAccount = $('#cancelNewAccount');

    // UMS / Portal Credentials
    const umsUsername = $('#umsUsername');
    const umsPassword = $('#umsPassword');
    const saveUmsCredentials = $('#saveUmsCredentials');

    // NeoBrowser
    const neoUsername = $('#neoUsername');
    const neoPassword = $('#neoPassword');
    const saveNeoCredentials = $('#saveNeoCredentials');

    // Quick Links
    const quicklinks = $$('.quicklink');

    const DNS_DATA = {
        default: { name: 'System Default', doh: '' },
        cloudflare: { name: 'Cloudflare', doh: 'https://cloudflare-dns.com/dns-query' },
        google: { name: 'Google DNS', doh: 'https://dns.google/dns-query' },
        quad9: { name: 'Quad9', doh: 'https://dns.quad9.net/dns-query' },
        adguard: { name: 'AdGuard DNS', doh: 'https://dns.adguard-dns.com/dns-query' }
    };
    let selectedDNS = 'default';

    // ─── Tab Navigation ──────────────────────────────────────────────
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            $(`#tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // ─── Network Status ──────────────────────────────────────────────
    async function checkNetwork() {
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'CHECK_NETWORK' }, (res) => {
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(res);
                });
            });
            updateNetworkUI(response);
        } catch (err) {
            updateNetworkUI({ online: navigator.onLine, status: navigator.onLine ? 'unknown' : 'disconnected', networkType: 'unknown', authorized: false });
        }
    }

    function updateNetworkUI(info) {
        const { online, status, networkType, authorized } = info;

        if (!online) {
            statusSubtitle.textContent = 'No connection';
        } else if (status === 'authorized' || authorized) {
            statusSubtitle.textContent = 'Connected & authorized';
        } else if (status === 'unauthorized') {
            statusSubtitle.textContent = 'Login required';
        } else {
            statusSubtitle.textContent = 'Verifying...';
        }
    }

    // ─── Data Usage ──────────────────────────────────────────────────
    function updateDataUsage() {
        chrome.runtime.sendMessage({ type: 'GET_DATA_USAGE' }, (res) => {
            if (chrome.runtime.lastError || !res) return;
            const bytesUsed = res.bytesUsed || 0;
            if (bytesUsed >= 1073741824) {
                dataUsedValue.textContent = (bytesUsed / 1073741824).toFixed(1) + ' GB';
            } else {
                dataUsedValue.textContent = Math.round(bytesUsed / 1048576) + ' MB';
            }
        });
    }

    // ─── Network Health (RTT) ────────────────────────────────────────
    function updateNetworkHealth() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let rtt = null;
        let effectiveType = '—';

        if (conn) {
            rtt = conn.rtt;
            effectiveType = (conn.effectiveType || '—').toUpperCase();
        }
        connectionType.textContent = effectiveType;

        if (rtt === null || rtt === undefined) {
            healthEmoji.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>';
            healthRTT.textContent = '— ms';
            healthLabel.textContent = 'RTT unavailable';
            return;
        }

        healthRTT.textContent = rtt + ' ms';

        if (rtt < 50) { healthEmoji.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round"><path d="M6 12L3.27 3.13A1 1 0 0 1 4.38 2l16.24 8.11a1 1 0 0 1 0 1.78L4.38 20a1 1 0 0 1-1.11-1.13L6 12z"/></svg>'; healthLabel.textContent = 'Gaming Ready'; }
        else if (rtt < 100) { healthEmoji.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'; healthLabel.textContent = 'Low Latency'; }
        else if (rtt <= 300) { healthEmoji.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>'; healthLabel.textContent = 'YouTube OK'; }
        else if (rtt <= 500) { healthEmoji.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>'; healthLabel.textContent = 'Slow'; }
        else { healthEmoji.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'; healthLabel.textContent = 'WiFi dying'; }
    }

    // ─── Quick Links ─────────────────────────────────────────────────
    quicklinks.forEach(ql => {
        ql.addEventListener('click', () => {
            chrome.tabs.create({ url: ql.dataset.url });
        });
    });

    // ─── Speed Test ──────────────────────────────────────────────────
    let isTestRunning = false;
    runSpeedTestBtn.addEventListener('click', async () => {
        if (isTestRunning) return;
        isTestRunning = true;
        runSpeedTestBtn.classList.add('loading');
        runSpeedTestBtn.textContent = 'Testing...';
        runSpeedTestBtn.disabled = true;
        speedProgress.classList.add('active');
        speedValue.textContent = '...';
        latencyValue.textContent = '...';

        try {
            const result = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'SPEED_TEST' }, (response) => {
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(response);
                });
            });
            if (result.error) {
                speedValue.textContent = '!';
                latencyValue.textContent = 'Error';
            } else {
                speedValue.textContent = result.speedMbps;
                latencyValue.textContent = `${result.latencyMs}ms`;
                downlinkValue.textContent = `${result.speedMbps} Mb/s`;
                chrome.storage.local.set({ lastSpeedMbps: result.speedMbps, lastLatencyMs: result.latencyMs });
            }
        } catch (err) {
            speedValue.textContent = '!';
            latencyValue.textContent = 'Failed';
        }

        setTimeout(() => speedProgress.classList.remove('active'), 500);
        runSpeedTestBtn.classList.remove('loading');
        runSpeedTestBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Speed Test';
        runSpeedTestBtn.disabled = false;
        isTestRunning = false;
    });

    // ─── Load Settings ───────────────────────────────────────────────
    function loadSettings() {
        chrome.storage.local.get([
            'autoLogin', 'autoClose', 'keepAlive', 'darkMode',
            'dnsProvider', 'proxyHost', 'proxyPort', 'proxyScheme', 'vpnEnabled',
            'neoUsername', 'neoPassword', 'umsUsername', 'umsPassword', 'lastSpeedMbps',
            'extensionEnabled'
        ], (data) => {
            // Extension toggle (default: enabled)
            const isEnabled = data.extensionEnabled !== false;
            extensionToggle.checked = isEnabled;
            document.querySelector('.app').classList.toggle('disabled', !isEnabled);
            toggleAutoLogin.checked = data.autoLogin !== false;
            toggleAutoClose.checked = data.autoClose !== false;
            toggleKeepAlive.checked = data.keepAlive !== false;
            toggleDarkMode.checked = data.darkMode === true;

            if (data.dnsProvider && DNS_DATA[data.dnsProvider]) {
                selectedDNS = data.dnsProvider;
                updateDNSUI(selectedDNS);
            }

            if (data.proxyHost) proxyHost.value = data.proxyHost;
            if (data.proxyPort) proxyPort.value = data.proxyPort;
            if (data.proxyScheme) proxyScheme.value = data.proxyScheme;
            toggleVPN.checked = data.vpnEnabled === true;
            updateVPNStatus(data.vpnEnabled === true);

            if (data.neoUsername) neoUsername.value = data.neoUsername;
            if (data.neoPassword) neoPassword.value = data.neoPassword;
            if (data.umsUsername) umsUsername.value = data.umsUsername;
            if (data.umsPassword) umsPassword.value = data.umsPassword;

            if (data.lastSpeedMbps) downlinkValue.textContent = data.lastSpeedMbps + ' Mb/s';
            else downlinkValue.textContent = '—';
        });
    }

    // ─── Auto-Save Toggles (immediate on change) ────────────────────
    function autoSaveToggle(el, key, label) {
        el.addEventListener('change', () => {
            chrome.storage.local.set({ [key]: el.checked }, () => {
                showToast(saveToast, saveToastMsg, `${label} ${el.checked ? 'enabled' : 'disabled'}`);
            });
        });
    }
    autoSaveToggle(toggleAutoLogin, 'autoLogin', 'Auto-Login');
    autoSaveToggle(toggleAutoClose, 'autoClose', 'Auto-Close');
    autoSaveToggle(toggleKeepAlive, 'keepAlive', 'Keep-Alive');
    autoSaveToggle(toggleDarkMode, 'darkMode', 'Portal Dark Mode');

    // ─── Extension Enable/Disable Toggle ─────────────────────────────
    extensionToggle.addEventListener('change', () => {
        const enabled = extensionToggle.checked;
        chrome.storage.local.set({ extensionEnabled: enabled }, () => {
            document.querySelector('.app').classList.toggle('disabled', !enabled);
            showToast(saveToast, saveToastMsg, `Extension ${enabled ? 'enabled' : 'disabled'}`);
        });
    });

    // ─── Buy Me a Coffee ─────────────────────────────────────────────
    donateBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://razorpay.me/@netxspider' });
    });

    // ─── Multi-Account System ────────────────────────────────────────
    function loadAccounts() {
        chrome.storage.local.get(['accounts', 'activeAccountId', 'lpuUsername'], (data) => {
            let accounts = data.accounts || [];

            // If no accounts exist but we have legacy credentials, migrate them
            if (accounts.length === 0 && data.lpuUsername) {
                chrome.storage.local.get(['lpuPassword'], (d2) => {
                    const migrated = [{
                        id: Date.now().toString(),
                        name: 'Main',
                        username: data.lpuUsername,
                        password: d2.lpuPassword || ''
                    }];
                    chrome.storage.local.set({
                        accounts: migrated,
                        activeAccountId: migrated[0].id
                    }, () => loadAccounts());
                });
                return;
            }

            const activeId = data.activeAccountId;
            accountsList.innerHTML = '';

            if (accounts.length === 0) {
                accountsList.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px 0">No accounts saved. Click + to add one.</div>';
                return;
            }

            accounts.forEach(acc => {
                const item = document.createElement('div');
                item.className = 'account-item' + (acc.id === activeId ? ' active' : '');
                item.innerHTML = `
          <div class="account-radio"></div>
          <div class="account-info">
            <span class="account-name">${escapeHtml(acc.name)}</span>
            <span class="account-user">${escapeHtml(acc.username)}</span>
          </div>
          <button class="account-delete" title="Delete">✕</button>
        `;

                // Click to switch account
                item.querySelector('.account-info').addEventListener('click', () => {
                    switchAccount(acc.id);
                });
                item.querySelector('.account-radio').addEventListener('click', () => {
                    switchAccount(acc.id);
                });

                // Delete button
                item.querySelector('.account-delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteAccount(acc.id);
                });

                accountsList.appendChild(item);
            });
        });
    }

    function switchAccount(accountId) {
        chrome.storage.local.get(['accounts'], (data) => {
            const accounts = data.accounts || [];
            const acc = accounts.find(a => a.id === accountId);
            if (!acc) return;

            chrome.storage.local.set({
                activeAccountId: accountId,
                lpuUsername: acc.username,
                lpuPassword: acc.password
            }, () => {
                loadAccounts();
                showToast(saveToast, saveToastMsg, `Switched to ${acc.name}`);

                // Auto-set NeoBrowser defaults if not custom
                chrome.storage.local.get(['neoUsername'], (d) => {
                    if (!d.neoUsername || d.neoUsername.endsWith('@neocolab.ai')) {
                        chrome.storage.local.set({
                            neoUsername: acc.username + '@neocolab.ai',
                            neoPassword: acc.username
                        });
                        neoUsername.value = acc.username + '@neocolab.ai';
                        neoPassword.value = acc.username;
                    }
                });
            });
        });
    }

    function deleteAccount(accountId) {
        chrome.storage.local.get(['accounts', 'activeAccountId'], (data) => {
            let accounts = (data.accounts || []).filter(a => a.id !== accountId);
            const updates = { accounts };

            // If we deleted the active account, switch to first remaining
            if (data.activeAccountId === accountId && accounts.length > 0) {
                updates.activeAccountId = accounts[0].id;
                updates.lpuUsername = accounts[0].username;
                updates.lpuPassword = accounts[0].password;
            } else if (accounts.length === 0) {
                updates.activeAccountId = null;
                updates.lpuUsername = '';
                updates.lpuPassword = '';
            }

            chrome.storage.local.set(updates, () => {
                loadAccounts();
                showToast(saveToast, saveToastMsg, 'Account deleted');
            });
        });
    }

    // Add account UI
    addAccountBtn.addEventListener('click', () => {
        addAccountForm.style.display = addAccountForm.style.display === 'none' ? 'block' : 'none';
        newAccountName.value = '';
        newAccountUser.value = '';
        newAccountPass.value = '';
    });

    cancelNewAccount.addEventListener('click', () => {
        addAccountForm.style.display = 'none';
    });

    saveNewAccount.addEventListener('click', () => {
        const name = newAccountName.value.trim() || 'Account';
        const user = newAccountUser.value.trim();
        const pass = newAccountPass.value;

        if (!user || !pass) {
            if (!user) shakeElement(newAccountUser);
            if (!pass) shakeElement(newAccountPass);
            return;
        }

        const newAcc = { id: Date.now().toString(), name, username: user, password: pass };

        chrome.storage.local.get(['accounts', 'activeAccountId'], (data) => {
            const accounts = data.accounts || [];
            accounts.push(newAcc);
            const updates = { accounts };

            // If first account, make it active and set credentials
            if (!data.activeAccountId) {
                updates.activeAccountId = newAcc.id;
                updates.lpuUsername = newAcc.username;
                updates.lpuPassword = newAcc.password;
            }

            chrome.storage.local.set(updates, () => {
                addAccountForm.style.display = 'none';
                loadAccounts();
                showToast(saveToast, saveToastMsg, `Account "${name}" added`);
            });
        });
    });
    // ─── UMS / Portal Credentials ────────────────────────────────
    saveUmsCredentials.addEventListener('click', () => {
        const user = umsUsername.value.trim();
        const pass = umsPassword.value;
        if (!user) { shakeElement(umsUsername); return; }
        if (!pass) { shakeElement(umsPassword); return; }
        chrome.storage.local.set({ umsUsername: user, umsPassword: pass }, () => {
            showToast(saveToast, saveToastMsg, 'Portal credentials saved');
        });
    });

    // ─── NeoBrowser Credentials ──────────────────────────────────────
    saveNeoCredentials.addEventListener('click', () => {
        const user = neoUsername.value.trim();
        const pass = neoPassword.value;
        if (!user) { shakeElement(neoUsername); return; }
        chrome.storage.local.set({ neoUsername: user, neoPassword: pass }, () => {
            showToast(saveToast, saveToastMsg, 'NeoBrowser credentials saved');
        });
    });

    // ─── VPN Proxy ───────────────────────────────────────────────────
    function updateVPNStatus(enabled) {
        if (enabled) { vpnDot.classList.add('active'); vpnLabel.textContent = 'Proxy Active'; vpnLabel.style.color = '#34d399'; }
        else { vpnDot.classList.remove('active'); vpnLabel.textContent = 'Proxy Off'; vpnLabel.style.color = ''; }
    }

    toggleVPN.addEventListener('change', () => {
        if (toggleVPN.checked) {
            const host = proxyHost.value.trim();
            if (!host) { shakeElement(proxyHost); toggleVPN.checked = false; return; }
            chrome.runtime.sendMessage({
                type: 'SET_PROXY', enabled: true,
                config: { host, port: parseInt(proxyPort.value) || 8080, scheme: proxyScheme.value || 'http' }
            }, (res) => {
                if (res && res.success) { updateVPNStatus(true); showToast(dnsToast, dnsToastMsg, 'Proxy enabled!'); }
            });
        } else {
            chrome.runtime.sendMessage({ type: 'SET_PROXY', enabled: false }, (res) => {
                if (res && res.success) { updateVPNStatus(false); showToast(dnsToast, dnsToastMsg, 'Proxy disabled.'); }
            });
        }
    });

    saveProxyBtn.addEventListener('click', () => {
        const host = proxyHost.value.trim();
        if (!host) { shakeElement(proxyHost); return; }
        chrome.storage.local.set({ proxyHost: host, proxyPort: proxyPort.value, proxyScheme: proxyScheme.value }, () => {
            showToast(dnsToast, dnsToastMsg, 'Proxy config saved!');
        });
    });

    // ─── DNS Management ──────────────────────────────────────────────
    dnsOptions.forEach(option => {
        option.addEventListener('click', () => {
            dnsOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            selectedDNS = option.dataset.dns;
        });
    });

    function updateDNSUI(provider) {
        dnsOptions.forEach(o => o.classList.toggle('active', o.dataset.dns === provider));
        const d = DNS_DATA[provider];
        if (d) currentDNS.textContent = d.name;
    }

    applyDNSBtn.addEventListener('click', async () => {
        const d = DNS_DATA[selectedDNS];
        if (!d) return;
        chrome.storage.local.set({ dnsProvider: selectedDNS });
        currentDNS.textContent = d.name;
        if (selectedDNS === 'default') { showToast(dnsToast, dnsToastMsg, 'Set to system default DNS'); return; }
        if (d.doh) {
            try { await navigator.clipboard.writeText(d.doh); showToast(dnsToast, dnsToastMsg, `${d.name} URL copied!`); }
            catch (e) { showToast(dnsToast, dnsToastMsg, `DNS: ${d.doh}`); }
        }
    });

    openChromeSecureDNS.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://settings/security' });
    });

    // ─── Session Time ────────────────────────────────────────────────
    function updateSessionTime(startTime) {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const hours = Math.floor(minutes / 60);
        sessionTime.textContent = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
    }

    function loadStoredStatus() {
        chrome.storage.local.get(['connectionStatus', 'sessionStart', 'loginCount'], (data) => {
            loginCountEl.textContent = data.loginCount || 0;
            if (data.sessionStart) updateSessionTime(data.sessionStart);
        });
    }

    // ─── Utility ─────────────────────────────────────────────────────
    function showToast(toastEl, msgEl, text) {
        if (msgEl && text) msgEl.textContent = text;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 2500);
    }

    function shakeElement(el) {
        el.style.animation = 'none'; el.offsetHeight;
        el.style.animation = 'shake 0.4s ease';
        el.style.borderColor = 'rgba(239,68,68,0.5)';
        setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 1000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Real-time Updates ───────────────────────────────────────────
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.loginCount) loginCountEl.textContent = changes.loginCount.newValue || 0;
        if (changes.sessionStart) updateSessionTime(changes.sessionStart.newValue);
        if (changes.extensionEnabled) {
            const enabled = changes.extensionEnabled.newValue !== false;
            extensionToggle.checked = enabled;
            document.querySelector('.app').classList.toggle('disabled', !enabled);
        }
    });

    // ─── Initialize ──────────────────────────────────────────────────
    loadSettings();
    loadStoredStatus();
    loadAccounts();
    checkNetwork();
    updateDataUsage();
    updateNetworkHealth();

    // Periodic updates
    setInterval(checkNetwork, 30000);
    setInterval(updateDataUsage, 15000);
    setInterval(() => {
        chrome.storage.local.get(['sessionStart'], (data) => {
            if (data.sessionStart) updateSessionTime(data.sessionStart);
        });
    }, 30000);
})();

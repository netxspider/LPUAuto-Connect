/**
 * LPU Auto-Connect — Content Script
 * Runs on internet.lpu.in pages to auto-fill credentials and submit the login form.
 * 
 * 24Online Captive Portal Form Structure:
 *  - Username field: name="username"
 *  - Password field: name="password"
 *  - Terms checkbox: name="acceptagreement" or similar
 *  - Login button: name="Login" or type="submit"
 */

(function () {
    'use strict';

    // Prevent multiple injections
    if (window.__LPU_AUTO_CONNECT_INJECTED__) return;
    window.__LPU_AUTO_CONNECT_INJECTED__ = true;

    console.log('[LPU Auto-Connect] Content script loaded on:', window.location.href);

    // ─── Dark Mode Injection ────────────────────────────────────────────
    // Check if dark mode is enabled and inject the dark mode stylesheet
    chrome.storage.local.get(['darkMode'], (data) => {
        if (data.darkMode === true) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = chrome.runtime.getURL('darkmode.css');
            link.id = 'lpu-darkmode-css';
            document.head.appendChild(link);
            console.log('[LPU Auto-Connect] Dark mode CSS injected.');
        }
    });

    // Listen for dark mode changes while on the page
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.darkMode) {
            const existing = document.getElementById('lpu-darkmode-css');
            if (changes.darkMode.newValue && !existing) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = chrome.runtime.getURL('darkmode.css');
                link.id = 'lpu-darkmode-css';
                document.head.appendChild(link);
            } else if (!changes.darkMode.newValue && existing) {
                existing.remove();
            }
        }
    });

    // ─── Loop Prevention ───────────────────────────────────────────────
    function isAlreadyLoggedIn() {
        const body = document.body ? document.body.innerText.toLowerCase() : '';
        const successIndicators = [
            'you are logged in',
            'you have been logged in',
            'logout',
            'log out',
            'to start surfing',
            'successfully authenticated',
            'minimize this login window'
        ];
        return successIndicators.some(indicator => body.includes(indicator));
    }

    // ─── Find Form Elements ────────────────────────────────────────────
    function findElement(selectors) {
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

    function findUsernameField() {
        return findElement([
            'input[name="username"]',
            'input[name="userName"]',
            'input[name="userid"]',
            'input[name="userId"]',
            'input[id="username"]',
            'input[id="userName"]',
            'input[type="text"][name*="user"]',
            'input[type="text"]'
        ]);
    }

    function findPasswordField() {
        return findElement([
            'input[name="password"]',
            'input[name="passwd"]',
            'input[id="password"]',
            'input[type="password"]'
        ]);
    }

    function findCheckbox() {
        return findElement([
            'input[name="acceptagreement"]',
            'input[name="agreement"]',
            'input[name="terms"]',
            'input[name="agree"]',
            'input[type="checkbox"][name*="accept"]',
            'input[type="checkbox"][name*="agree"]',
            'input[type="checkbox"]'
        ]);
    }

    function findLoginButton() {
        return findElement([
            'input[name="Login"]',
            'input[name="login"]',
            'button[name="Login"]',
            'button[name="login"]',
            'input[type="submit"]',
            'button[type="submit"]',
            'input[value="Login"]',
            'input[value="login"]',
            'input[value="Log In"]',
            'input[value="Sign In"]'
        ]);
    }

    // ─── Set Value (framework-compatible) ──────────────────────────────
    function setNativeValue(element, value) {
        // Focus the element first
        element.focus();
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

        // Use the native setter to bypass React/Angular value traps
        const valueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        valueSetter.call(element, value);

        // Fire all events a real keystroke would fire
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    }

    // ─── Simulate a REAL checkbox toggle ─────────────────────────────────
    // The 24Online portal's JS only enables the login button when it
    // detects a real user click that toggles the checkbox. Simply setting
    // .checked = true or clicking once from an unchecked state is not
    // enough — the portal needs to SEE the full "uncheck → recheck"
    // toggle via real click events. We replicate this by clicking the
    // checkbox 3 times: check → uncheck → check, with delays between
    // each click to let the portal's event handlers process.
    function realClick(el) {
        const opts = { bubbles: true, cancelable: true, view: window };
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.click(); // toggles .checked and fires 'click' event
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function toggleCheckboxSequence(checkbox, callback) {
        // The checkbox starts unchecked on a fresh page load.
        // Click 1: unchecked → checked  (portal may/may not enable button)
        // Click 2: checked → unchecked  (portal disables button)
        // Click 3: unchecked → checked  (portal enables button — this is the real toggle)

        console.log('[LPU Auto-Connect] Starting checkbox toggle sequence...');

        // Click 1 — check it
        realClick(checkbox);
        console.log('[LPU Auto-Connect] Click 1 done. Checked:', checkbox.checked);

        setTimeout(() => {
            // Click 2 — uncheck it
            realClick(checkbox);
            console.log('[LPU Auto-Connect] Click 2 done. Checked:', checkbox.checked);

            setTimeout(() => {
                // Click 3 — re-check it (this is the toggle that enables the button)
                realClick(checkbox);
                console.log('[LPU Auto-Connect] Click 3 done. Checked:', checkbox.checked);

                // If somehow it ended up unchecked, force one more click
                if (!checkbox.checked) {
                    setTimeout(() => {
                        realClick(checkbox);
                        console.log('[LPU Auto-Connect] Extra click. Checked:', checkbox.checked);
                        callback();
                    }, 200);
                } else {
                    callback();
                }
            }, 350);
        }, 350);
    }

    // ─── Wait for Login Button to Become Enabled ───────────────────────
    function waitForButtonEnabled(loginBtn, maxWait, callback) {
        const start = Date.now();
        const check = () => {
            if (!loginBtn.disabled) {
                callback(true);
                return;
            }
            if (Date.now() - start > maxWait) {
                // Timed out — force-enable as last resort
                console.log('[LPU Auto-Connect] Button still disabled after wait, force-enabling...');
                loginBtn.disabled = false;
                loginBtn.removeAttribute('disabled');
                callback(true);
                return;
            }
            setTimeout(check, 100);
        };
        check();
    }

    // ─── Main Auto-Login Logic ─────────────────────────────────────────
    function attemptLogin() {
        // Loop prevention
        if (isAlreadyLoggedIn()) {
            console.log('[LPU Auto-Connect] Already logged in. Skipping auto-login.');
            notifyBackground('already_logged_in');
            return;
        }

        const usernameField = findUsernameField();
        const passwordField = findPasswordField();

        if (!usernameField || !passwordField) {
            console.log('[LPU Auto-Connect] Login form not found. Might be a different page.');
            return;
        }

        chrome.storage.local.get(['lpuUsername', 'lpuPassword', 'autoLogin', 'autoClose'], (data) => {
            if (!data.lpuUsername || !data.lpuPassword) {
                console.log('[LPU Auto-Connect] No credentials saved. Please set them in the extension popup.');
                notifyBackground('no_credentials');
                return;
            }

            if (data.autoLogin === false) {
                console.log('[LPU Auto-Connect] Auto-login is disabled.');
                return;
            }

            console.log('[LPU Auto-Connect] Filling credentials...');

            // Step 1: Fill username
            setNativeValue(usernameField, data.lpuUsername);

            setTimeout(() => {
                // Step 2: Fill password
                setNativeValue(passwordField, data.lpuPassword);

                setTimeout(() => {
                    // Step 3: Toggle the checkbox (check → uncheck → check)
                    const checkbox = findCheckbox();
                    if (checkbox) {
                        toggleCheckboxSequence(checkbox, () => {
                            // Step 4: Wait for login button to become enabled, then click
                            setTimeout(() => {
                                clickLoginButton(data.autoClose !== false);
                            }, 400);
                        });
                    } else {
                        // No checkbox found, try to click login directly
                        setTimeout(() => {
                            clickLoginButton(data.autoClose !== false);
                        }, 400);
                    }
                }, 300);
            }, 250);
        });
    }

    function clickLoginButton(shouldAutoClose) {
        const loginBtn = findLoginButton();
        if (!loginBtn) {
            console.log('[LPU Auto-Connect] Login button not found!');
            notifyBackground('login_button_not_found');
            return;
        }

        waitForButtonEnabled(loginBtn, 2000, (ready) => {
            console.log('[LPU Auto-Connect] Clicking login button... (disabled:', loginBtn.disabled, ')');
            loginBtn.click();

            // Also try form.submit() as a fallback
            const form = loginBtn.closest('form');
            if (form) {
                try { form.submit(); } catch (e) { /* ignore */ }
            }

            // Only notify after we've confirmed the button was clicked
            notifyBackground('login_attempted', shouldAutoClose);
        });
    }

    // ─── Communication with Background ────────────────────────────────
    function notifyBackground(status, autoClose = false) {
        try {
            chrome.runtime.sendMessage({
                type: 'LOGIN_STATUS',
                status: status,
                autoClose: autoClose,
                timestamp: Date.now()
            });
        } catch (e) {
            console.log('[LPU Auto-Connect] Could not notify background:', e.message);
        }
    }

    // ─── Wait for Page & Run ───────────────────────────────────────────
    function init() {
        // Check if extension is enabled before proceeding
        chrome.storage.local.get(['extensionEnabled'], (data) => {
            if (data.extensionEnabled === false) {
                console.log('[LPU Auto-Connect] Extension is disabled. Skipping auto-login.');
                return;
            }

            const checkInterval = setInterval(() => {
                const usernameField = findUsernameField();
                if (usernameField || document.readyState === 'complete') {
                    clearInterval(checkInterval);
                    setTimeout(attemptLogin, 1000); // give portal JS time to initialize
                }
            }, 300);

            // Failsafe: stop checking after 15 seconds
            setTimeout(() => clearInterval(checkInterval), 15000);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

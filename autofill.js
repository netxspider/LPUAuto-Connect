/**
 * LPU Auto-Connect — Auto-Fill Content Script v2.1
 *
 * Credential sources:
 *   UMS / MyClass / LPULive / OAS → umsUsername + umsPassword (stored separately)
 *   NeoBrowser (examly.io)        → neoUsername + neoPassword
 *
 * Behavior matrix:
 *   UMS       → TWO-STEP (username → reload → password + captcha OCR via Tesseract.js)
 *   LPULive   → fills both, NO auto-submit (Cloudflare)
 *   MyClass   → fills both + auto-submit (if autoLogin ON)
 *   OAS       → fills both + auto-submit (if autoLogin ON)
 *   NeoBrowser → TWO-STEP SPA (email → Next → password → submit)
 *
 * The "Auto-Login" setting controls whether the form is auto-submitted.
 * When OFF → credentials are filled but no click/submit happens.
 */

(function () {
    'use strict';

    if (window.__LPU_AUTOFILL_INJECTED__) return;
    window.__LPU_AUTOFILL_INJECTED__ = true;

    const host = window.location.hostname.toLowerCase();
    console.log('[LPU] Auto-fill loaded on:', host);

    const isUMS = host.includes('ums.lpu.in');
    const isMyClass = host.includes('myclass.lpu.in');
    const isLPULive = host.includes('lpulive.lpu.in');
    const isOAS = host.includes('oas.lpu.in');
    const isNeoBrowser = host.includes('examly.io') || host.includes('lpucolab');

    // LPULive always blocked (Cloudflare), UMS has its own logic
    const neverAutoSubmit = isLPULive;

    // ════════════════════════════════════════════════════════════════
    // Helpers
    // ════════════════════════════════════════════════════════════════

    function findInput(selectors) {
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function findUsernameField() {
        return findInput([
            'input[name="uid"]',
            'input[name="username"]', 'input[name="userName"]',
            'input[name="userid"]', 'input[name="userId"]',
            'input[name="email"]', 'input[name="Email"]',
            'input[id="username"]', 'input[id="userName"]',
            'input[id="email"]', 'input[id="Email"]',
            'input[id="uid"]',
            'input[type="email"]',
            'input[placeholder*="mail"]',
            'input[placeholder*="user"]', 'input[placeholder*="User"]',
            'input[placeholder*="Registration"]', 'input[placeholder*="registration"]',
            'input[type="text"]'
        ]);
    }

    function findPasswordField() {
        return findInput([
            'input[name="password"]', 'input[name="Password"]',
            'input[name="passwd"]', 'input[type="password"]'
        ]);
    }

    function findSubmitButton() {
        const sels = [
            'button[type="submit"]', 'input[type="submit"]',
            'button[name="submit"]', 'button[name="Login"]', 'input[name="Login"]',
            'button[id="login"]', 'button[id="Login"]', 'button[id="submit"]',
            '#loginbtn', '#btnLogin',
        ];
        for (const sel of sels) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        const buttons = document.querySelectorAll('button, input[type="button"]');
        for (const btn of buttons) {
            const t = (btn.textContent || btn.value || '').toLowerCase();
            if (t.includes('login') || t.includes('sign in') || t.includes('submit')) return btn;
        }
        return null;
    }

    function findNextButton() {
        const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
        for (const btn of buttons) {
            const t = (btn.textContent || btn.value || '').toLowerCase().trim();
            if (t === 'next' || t.includes('next') || t.includes('continue') || t.includes('proceed')) return btn;
        }
        return null;
    }

    function setFieldValue(field, value) {
        if (!field || !value) return;
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        setter.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    }

    function clickSubmit(fallbackField) {
        const btn = findSubmitButton();
        if (btn) { btn.click(); return; }
        if (fallbackField) {
            const form = fallbackField.closest('form');
            if (form) form.submit();
        }
    }

    // ════════════════════════════════════════════════════════════════
    // UMS — Two-step + Tesseract.js Captcha OCR
    // Step 1: page shows username only → fill + submit → page reloads
    // Step 2: page shows username (pre-filled) + password + captcha
    //         → fill password, solve captcha via OCR, user may adjust
    // ════════════════════════════════════════════════════════════════

    function fillUMS(autoLogin) {
        chrome.storage.local.get(['umsUsername', 'umsPassword'], (data) => {
            const username = data.umsUsername || '';
            const password = data.umsPassword || '';
            if (!username) { console.log('[LPU] No UMS username saved.'); return; }

            const userField = findUsernameField();
            const passField = findPasswordField();

            // ── Detect which step we're on ──
            // If password field exists → we're on step 2
            if (passField) {
                console.log('[LPU] UMS step 2 detected (password field visible).');

                // Fill password
                passField.focus();
                setFieldValue(passField, password);
                console.log('[LPU] UMS password filled.');

                // Also ensure username is filled (in case server didn't pre-fill)
                if (userField && !userField.value.trim()) {
                    setFieldValue(userField, username);
                }

                // Attempt captcha OCR
                solveCaptchaOCR(autoLogin);
                return;
            }

            // No password field → step 1 (username only)
            if (userField) {
                // Prevent infinite reload: if username already matches, don't re-submit
                if (userField.value.trim() === username) {
                    console.log('[LPU] UMS username already filled, waiting for page to update...');
                    return;
                }

                userField.focus();
                setFieldValue(userField, username);
                console.log('[LPU] UMS step 1 — username filled.');

                // Auto-submit step 1 (always — this just loads step 2)
                setTimeout(() => clickSubmit(userField), 600);
            }
        });
    }

    /**
     * Attempt to solve the UMS captcha using Tesseract.js OCR.
     * Looks for a captcha image element, reads it, fills the captcha input.
     */
    async function solveCaptchaOCR(autoLogin) {
        // Check if Tesseract is available (loaded via manifest)
        if (typeof Tesseract === 'undefined') {
            console.log('[LPU] Tesseract.js not available, skipping captcha OCR.');
            return;
        }

        // Find the captcha image — try common selectors
        const captchaImg = findInput([
            'img#imgCaptcha',
            'img#captchaImage',
            'img#CaptchaImage',
            'img.captcha',
            'img[alt*="captcha"]',
            'img[alt*="Captcha"]',
            'img[src*="captcha"]',
            'img[src*="Captcha"]',
        ]) || document.querySelector('img[id*="aptcha"]') || document.querySelector('img[src*="aptcha"]');

        // Find the captcha input field
        const captchaInput = findInput([
            'input#txtCaptcha',
            'input#captcha',
            'input#Captcha',
            'input[name="captcha"]',
            'input[name="Captcha"]',
            'input[name="txtCaptcha"]',
            'input[placeholder*="captcha"]',
            'input[placeholder*="Captcha"]',
            'input[placeholder*="code"]',
            'input[placeholder*="Code"]',
        ]);

        if (!captchaImg || !captchaInput) {
            console.log('[LPU] Captcha image or input not found.',
                'img:', !!captchaImg, 'input:', !!captchaInput);
            return;
        }

        console.log('[LPU] Captcha image found, running Tesseract.js OCR...');

        try {
            // Convert captcha image to canvas for better OCR
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Create a new image to ensure it's loaded
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                // Use the captcha image source
                img.src = captchaImg.src;
            });

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Pre-process: increase contrast (grayscale + threshold)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Convert to grayscale
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                // Apply threshold for cleaner OCR
                const val = gray > 128 ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = val;
            }
            ctx.putImageData(imageData, 0, 0);

            // Run Tesseract OCR
            const worker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log('[LPU] OCR progress:', Math.round(m.progress * 100) + '%');
                    }
                }
            });

            // Set OCR parameters for better captcha recognition
            await worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                tessedit_pageseg_mode: '7', // Treat as single line of text
            });

            const { data: { text } } = await worker.recognize(canvas.toDataURL());
            await worker.terminate();

            // Clean the recognized text (remove spaces, newlines)
            const captchaText = text.replace(/[\s\n\r]/g, '').trim();

            if (captchaText) {
                captchaInput.focus();
                setFieldValue(captchaInput, captchaText);
                console.log('[LPU] Captcha solved:', captchaText);

                // Auto-submit if autoLogin is enabled
                if (autoLogin) {
                    setTimeout(() => {
                        const btn = findSubmitButton();
                        if (btn) {
                            console.log('[LPU] Auto-submitting UMS login.');
                            btn.click();
                        }
                    }, 500);
                } else {
                    console.log('[LPU] Auto-Login OFF — captcha filled, user submits manually.');
                }
            } else {
                console.log('[LPU] OCR returned empty text.');
            }
        } catch (err) {
            console.error('[LPU] Captcha OCR error:', err);
        }
    }

    // ════════════════════════════════════════════════════════════════
    // Standard Portal Fill (MyClass, OAS, LPULive)
    // ════════════════════════════════════════════════════════════════

    function fillPortalSite(autoLogin) {
        chrome.storage.local.get(['umsUsername', 'umsPassword'], (data) => {
            const username = data.umsUsername || '';
            const password = data.umsPassword || '';

            if (!username && !password) {
                console.log('[LPU] No portal credentials saved.');
                return;
            }

            const userField = findUsernameField();
            const passField = findPasswordField();

            if (userField && username) {
                userField.focus();
                setFieldValue(userField, username);
                console.log('[LPU] Portal username filled.');
            }

            setTimeout(() => {
                const pf = passField || findPasswordField();
                if (pf && password) {
                    pf.focus();
                    setFieldValue(pf, password);
                    console.log('[LPU] Portal password filled.');
                }

                // Auto-submit only if autoLogin is ON and site allows it
                if (autoLogin && !neverAutoSubmit) {
                    setTimeout(() => clickSubmit(userField || pf), 500);
                } else {
                    console.log('[LPU] Auto-Login OFF or CAPTCHA site — user submits manually.');
                }
            }, 400);
        });
    }

    // ════════════════════════════════════════════════════════════════
    // NeoBrowser Two-Step (email → Next → password → submit)
    // ════════════════════════════════════════════════════════════════

    function fillNeoBrowser(autoLogin) {
        chrome.storage.local.get(['neoUsername', 'neoPassword', 'lpuUsername'], (data) => {
            const email = data.neoUsername || (data.lpuUsername ? data.lpuUsername + '@neocolab.ai' : '');
            const password = data.neoPassword || data.lpuUsername || '';

            if (!email) { console.log('[LPU] No NeoBrowser credentials.'); return; }

            const emailField = findInput([
                'input[type="email"]', 'input[name="email"]', 'input[name="Email"]',
                'input[id="email"]', 'input[id="Email"]',
                'input[placeholder*="mail"]', 'input[placeholder*="Mail"]',
                'input[type="text"]'
            ]);
            if (!emailField) { console.log('[LPU] No email field on NeoBrowser.'); return; }

            emailField.focus();
            setFieldValue(emailField, email);
            console.log('[LPU] NeoBrowser email filled.');

            // Check if password field already visible
            const existingPass = findPasswordField();
            if (existingPass) {
                setFieldValue(existingPass, password);
                console.log('[LPU] NeoBrowser password filled (same page).');
                if (autoLogin) setTimeout(() => clickSubmit(existingPass), 500);
                return;
            }

            if (!autoLogin) {
                console.log('[LPU] Auto-Login OFF — email filled, user proceeds manually.');
                return;
            }

            // Click "Next" to reveal password
            setTimeout(() => {
                const nextBtn = findNextButton() || findSubmitButton();
                if (nextBtn) { console.log('[LPU] Clicking Next.'); nextBtn.click(); }

                // Wait for password field
                let attempts = 0;
                const wait = setInterval(() => {
                    attempts++;
                    const pf = findPasswordField();
                    if (pf) {
                        clearInterval(wait);
                        setTimeout(() => {
                            pf.focus();
                            setFieldValue(pf, password);
                            console.log('[LPU] NeoBrowser password filled (step 2).');
                            setTimeout(() => clickSubmit(pf), 500);
                        }, 300);
                    } else if (attempts >= 30) {
                        clearInterval(wait);
                        console.log('[LPU] NeoBrowser password field did not appear.');
                    }
                }, 500);
            }, 800);
        });
    }

    // ════════════════════════════════════════════════════════════════
    // Entry Point — check autoLogin setting first
    // ════════════════════════════════════════════════════════════════

    function startAutoFill() {
        chrome.storage.local.get(['autoLogin'], (settings) => {
            // Default to true if not set
            const autoLogin = settings.autoLogin !== false;

            console.log('[LPU] Auto-Login setting:', autoLogin ? 'ON' : 'OFF');

            if (isUMS) fillUMS(autoLogin);
            else if (isNeoBrowser) fillNeoBrowser(autoLogin);
            else fillPortalSite(autoLogin);
        });
    }

    // ════════════════════════════════════════════════════════════════
    // Wait for page & run
    // ════════════════════════════════════════════════════════════════

    function waitAndFill() {
        let attempts = 0;
        const check = setInterval(() => {
            attempts++;
            const field = findUsernameField() || findPasswordField() || findInput(['input[type="email"]']);
            if (field || attempts >= 20) {
                clearInterval(check);
                if (field) setTimeout(startAutoFill, 500);
                else console.log('[LPU] No login fields found.');
            }
        }, 500);
    }

    const observer = new MutationObserver(() => {
        const field = findUsernameField() || findPasswordField() || findInput(['input[type="email"]']);
        if (field) {
            observer.disconnect();
            setTimeout(startAutoFill, 300);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            waitAndFill();
            observer.observe(document.body, { childList: true, subtree: true });
        });
    } else {
        waitAndFill();
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    }

    setTimeout(() => observer.disconnect(), 15000);
})();

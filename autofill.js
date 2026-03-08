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

    // UMS has its own two-step logic; all other portals can auto-submit

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
        // Guard: only run on the UMS login page.
        // After a successful login the user is on a dashboard/student page — we
        // must NOT touch those pages or we'll cause an infinite reload loop.
        const path = window.location.pathname.toLowerCase();
        const href = window.location.href.toLowerCase();
        const looksLikeLoginPage =
            path === '/lpuums/' ||
            path === '/lpuums/index.aspx' ||
            href.includes('login') ||
            href.includes('loginnew') ||
            // BotDetect captcha is only on the login page (step 2)
            !!document.querySelector('img.BDC_CaptchaImage, input[id*="CaptchaCode"]');

        if (!looksLikeLoginPage) {
            console.log('[LPU] UMS: not on login page — skipping auto-fill.');
            return;
        }

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

                console.log('[LPU] UMS password filled — fill captcha manually then click Login.');
                return;
            }

            // No password field → step 1 (username only)
            if (userField) {
                // Prevent re-submit: if username already matches, don't re-submit
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

        // Find the captcha image — BotDetect (UMS uses BDC_CaptchaImage class)
        const captchaImg =
            document.querySelector('img.BDC_CaptchaImage') ||
            document.querySelector('img[id*="CaptchaImage"]') ||
            findInput([
                'img#imgCaptcha',
                'img#captchaImage',
                'img.captcha',
                'img[alt*="captcha"]',
                'img[alt*="Captcha"]',
                'img[src*="captcha"]',
                'img[src*="Captcha"]',
                'img[src*="BotDetect"]',
            ]) ||
            document.querySelector('img[id*="aptcha"]') ||
            document.querySelector('img[src*="aptcha"]');

        // Find the captcha input field — BotDetect uses BDC_ prefixed IDs
        const captchaInput =
            document.querySelector('input[id*="CaptchaCode"]') ||
            document.querySelector('input[id*="CaptchaText"]') ||
            document.querySelector('input[name*="CaptchaCode"]') ||
            findInput([
                'input#txtCaptcha',
                'input#captcha',
                'input#Captcha',
                'input[name="captcha"]',
                'input[name="Captcha"]',
                'input[name="txtCaptcha"]',
                'input[placeholder*="captcha"]',
                'input[placeholder*="Captcha"]',
                'input[placeholder*="CAPTCHA"]',
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
            // ── Fetch the captcha image as a blob (avoids CORS rejection) ──
            // BotDetect rejects crossOrigin="anonymous" requests. Using fetch
            // with credentials sends session cookies without an Origin header.
            // IMPORTANT: use the src exactly as-is — the &t= param is BotDetect's
            // session token and must NOT be modified (changing it causes 400).
            const captchaSrc = captchaImg.src;
            let blobUrl = null;
            try {
                const resp = await fetch(captchaSrc, {
                    credentials: 'include',
                    cache: 'no-store'
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                const blob = await resp.blob();
                blobUrl = URL.createObjectURL(blob);
                console.log('[LPU] Captcha image fetched as blob OK.');
            } catch (fetchErr) {
                console.warn('[LPU] Blob fetch failed, falling back to src:', fetchErr.message);
            }

            // ── Load image ──
            const rawImg = new Image();
            await new Promise((resolve, reject) => {
                rawImg.onload = resolve;
                rawImg.onerror = (e) => {
                    console.error('[LPU] Image load error:', e);
                    reject(new Error('Image load failed'));
                };
                rawImg.src = blobUrl || captchaSrc;
            });
            if (blobUrl) URL.revokeObjectURL(blobUrl);

            const srcW = rawImg.naturalWidth || rawImg.width || 200;
            const srcH = rawImg.naturalHeight || rawImg.height || 60;
            console.log('[LPU] Captcha natural size:', srcW, 'x', srcH);

            // ── Scale up 3× for better OCR resolution ──
            const SCALE = 3;
            const canvas = document.createElement('canvas');
            canvas.width = srcW * SCALE;
            canvas.height = srcH * SCALE;
            const ctx = canvas.getContext('2d');

            // White background first
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw image scaled up (no smoothing = sharper edges for OCR)
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(rawImg, 0, 0, canvas.width, canvas.height);

            // ── Grayscale → Threshold → Invert ──
            // BotDetect captcha = dark/coloured background + white/light text.
            // After grayscale: background pixels are dark (<128), text pixels are bright (>128).
            // After threshold (>128 → 255): background = 0 (black), text = 255 (white).
            // Tesseract expects DARK text on LIGHT background → we must INVERT.
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const px = imageData.data;
            for (let i = 0; i < px.length; i += 4) {
                const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
                // Threshold then invert: bright pixels (text) → 0 (black), dark bg → 255 (white)
                const val = gray > 128 ? 0 : 255;
                px[i] = px[i + 1] = px[i + 2] = val;
                px[i + 3] = 255; // full opacity
            }
            ctx.putImageData(imageData, 0, 0);

            const processedDataUrl = canvas.toDataURL('image/png');

            // ── OCR: try multiple PSM modes until we get text ──
            const psmModes = ['8', '7', '6', '13']; // single-word, single-line, block, raw-line
            let captchaText = '';

            const worker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log('[LPU] OCR progress:', Math.round(m.progress * 100) + '%');
                    }
                }
            });

            for (const psm of psmModes) {
                await worker.setParameters({
                    // UMS captcha is uppercase letters + digits
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                    tessedit_pageseg_mode: psm,
                });
                const { data: { text } } = await worker.recognize(processedDataUrl);
                captchaText = text.replace(/[\s\n\r]/g, '').trim();
                console.log(`[LPU] OCR PSM ${psm} result: "${captchaText}"`);
                if (captchaText.length >= 4) break; // decent result
            }

            await worker.terminate();

            if (captchaText) {
                captchaInput.focus();
                setFieldValue(captchaInput, captchaText);
                console.log('[LPU] Captcha filled:', captchaText);

                if (autoLogin) {
                    setTimeout(() => {
                        const btn = findSubmitButton();
                        if (btn) {
                            console.log('[LPU] Auto-submitting UMS login.');
                            btn.click();
                        }
                    }, 800);
                } else {
                    console.log('[LPU] Auto-Login OFF — captcha filled, user submits manually.');
                }
            } else {
                console.log('[LPU] OCR returned empty text — user must fill captcha manually.');
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

                // Auto-submit if autoLogin is ON
                if (autoLogin) {
                    setTimeout(() => clickSubmit(userField || pf), 500);
                } else {
                    console.log('[LPU] Auto-Login OFF — user submits manually.');
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
        chrome.storage.local.get(['autoLogin', 'extensionEnabled'], (settings) => {
            // Check if extension is enabled (default: true)
            if (settings.extensionEnabled === false) {
                console.log('[LPU] Extension is disabled. Skipping auto-fill.');
                return;
            }

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

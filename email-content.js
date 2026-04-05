/**
 * PhishGuard — Gmail Email Content Detector
 * Content script that runs specifically on Gmail to detect and analyze emails
 * for phishing, spam, and social engineering attacks.
 */

(function () {
    'use strict';

    // Prevent double-injection
    if (window.__phishguardEmailInjected) return;
    window.__phishguardEmailInjected = true;

    // ============================================================
    // Configuration
    // ============================================================
    const CONFIG = {
        // Debounce delay before analyzing (ms)
        ANALYZE_DELAY: 1500,
        // Minimum text length to trigger analysis
        MIN_TEXT_LENGTH: 30,
        // Cache duration (ms) — don't re-analyze same email within 5 min
        CACHE_DURATION: 5 * 60 * 1000,
        // Selectors for Gmail DOM elements
        SELECTORS: {
            // Gmail email view container
            emailBody: [
                'div.a3s.aiL',          // Main email body
                'div.a3s',              // Fallback email body
                'div[data-message-id]', // Message container
            ],
            emailSubject: [
                'h2.hP',               // Email subject header
                'span.hP',             // Subject span variant
            ],
            emailSender: [
                'span.gD',             // Sender email element
                'span[email]',         // Sender with email attribute
                'span.go',             // Sender name
            ],
            emailContainer: [
                'div.nH.if',           // Conversation view wrapper
                'div.nH.bkK',          // Alternative wrapper  
                'table.cf.gJ',         // Email thread table
            ]
        }
    };

    // Analysis cache: hash -> { result, timestamp }
    const analysisCache = new Map();
    let lastAnalyzedHash = '';
    let analyzeTimeout = null;
    let currentBanner = null;

    // ============================================================
    // DOM Query Helpers
    // ============================================================
    function queryFirst(selectors) {
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function getEmailBody() {
        const el = queryFirst(CONFIG.SELECTORS.emailBody);
        return el ? el.innerText.trim() : '';
    }

    function getEmailSubject() {
        const el = queryFirst(CONFIG.SELECTORS.emailSubject);
        return el ? el.innerText.trim() : '';
    }

    function getEmailSender() {
        const el = queryFirst(CONFIG.SELECTORS.emailSender);
        if (el) {
            return el.getAttribute('email') || el.innerText.trim();
        }
        return '';
    }

    // ============================================================
    // Simple hash for deduplication
    // ============================================================
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    // ============================================================
    // Inline Alert Banner (shown inside Gmail)
    // ============================================================
    function createEmailBanner(data, sender, subject) {
        // Remove existing banner
        removeBanner();

        const verdict = data.verdict || 'unknown';
        const isSafe = verdict === 'safe';
        const isDanger = verdict === 'dangerous' || verdict === 'suspicious';

        const banner = document.createElement('div');
        banner.id = 'phishguard-email-banner';
        banner.innerHTML = `
      <div class="phishguard-email-inner ${isDanger ? 'phishguard-email-danger' : 'phishguard-email-safe'}">
        <div class="phishguard-email-left">
          <span class="phishguard-email-icon">${isDanger ? '⚠️' : '✅'}</span>
          <div class="phishguard-email-info">
            <div class="phishguard-email-title">
              PhishGuard: 
              <span class="phishguard-email-verdict phishguard-verdict-${verdict}">${verdict.toUpperCase()}</span>
              <span class="phishguard-email-conf">(${data.confidence || 0}% confidence)</span>
            </div>
            <div class="phishguard-email-summary">${data.summary || 'Analysis complete.'}</div>
            ${data.red_flags && data.red_flags.length > 0
                ? `<div class="phishguard-email-flags">🚩 ${data.red_flags.slice(0, 3).join(' • ')}</div>`
                : ''
            }
          </div>
        </div>
        <button class="phishguard-email-close" id="phishguard-email-close">✕</button>
      </div>
    `;

        // Inject styles if not already present
        if (!document.getElementById('phishguard-email-styles')) {
            const style = document.createElement('style');
            style.id = 'phishguard-email-styles';
            style.textContent = `
        #phishguard-email-banner {
          margin: 0 0 8px 0;
          font-family: 'Google Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
          animation: phishguardBannerIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .phishguard-email-inner {
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .phishguard-email-inner.phishguard-email-safe {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 78, 59, 0.06));
          border: 1px solid rgba(16, 185, 129, 0.25);
        }
        .phishguard-email-inner.phishguard-email-danger {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.06));
          border: 1px solid rgba(239, 68, 68, 0.35);
        }
        .phishguard-email-left {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex: 1;
        }
        .phishguard-email-icon {
          font-size: 20px;
          line-height: 1;
          margin-top: 2px;
          flex-shrink: 0;
        }
        .phishguard-email-info {
          flex: 1;
          min-width: 0;
        }
        .phishguard-email-title {
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 2px;
        }
        .phishguard-email-verdict {
          font-weight: 700;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          padding: 1px 6px;
          border-radius: 4px;
        }
        .phishguard-verdict-safe { background: rgba(16,185,129,0.15); color: #059669; }
        .phishguard-verdict-suspicious { background: rgba(245,158,11,0.15); color: #d97706; }
        .phishguard-verdict-dangerous { background: rgba(239,68,68,0.15); color: #dc2626; }
        .phishguard-email-conf {
          font-size: 11px;
          color: #6b7280;
          font-weight: 400;
        }
        .phishguard-email-summary {
          font-size: 12px;
          color: #4b5563;
          line-height: 1.4;
          margin-top: 2px;
        }
        .phishguard-email-flags {
          font-size: 11px;
          color: #dc2626;
          margin-top: 4px;
          font-weight: 500;
        }
        .phishguard-email-close {
          background: rgba(0,0,0,0.06);
          border: none;
          color: #6b7280;
          font-size: 14px;
          cursor: pointer;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          flex-shrink: 0;
          line-height: 1;
        }
        .phishguard-email-close:hover {
          background: rgba(0,0,0,0.12);
          color: #1f2937;
        }
        @keyframes phishguardBannerIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes phishguardBannerOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }
      `;
            document.head.appendChild(style);
        }

        // Insert banner above the email body
        const emailBodyEl = queryFirst(CONFIG.SELECTORS.emailBody);
        if (emailBodyEl && emailBodyEl.parentElement) {
            emailBodyEl.parentElement.insertBefore(banner, emailBodyEl);
        } else {
            // Fallback: insert at top of main content
            const mainContent = document.querySelector('div.nH[role="main"]') || document.querySelector('div.AO');
            if (mainContent) {
                mainContent.insertBefore(banner, mainContent.firstChild);
            }
        }

        currentBanner = banner;

        // Close button handler
        const closeBtn = document.getElementById('phishguard-email-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                banner.style.animation = 'phishguardBannerOut 0.3s ease forwards';
                setTimeout(() => banner.remove(), 300);
                currentBanner = null;
            });
        }
    }

    function removeBanner() {
        if (currentBanner) {
            currentBanner.remove();
            currentBanner = null;
        }
        const existing = document.getElementById('phishguard-email-banner');
        if (existing) existing.remove();
    }

    // ============================================================
    // Email Analysis Logic
    // ============================================================
    async function analyzeEmail() {
        // Check if extension is enabled
        const { extensionEnabled = true } = await chrome.storage.local.get('extensionEnabled');
        if (!extensionEnabled) return;

        const body = getEmailBody();
        const subject = getEmailSubject();
        const sender = getEmailSender();

        // Need at least a body to analyze
        if (!body || body.length < CONFIG.MIN_TEXT_LENGTH) return;

        // Build text to analyze
        const emailContent = [
            subject ? `Subject: ${subject}` : '',
            sender ? `From: ${sender}` : '',
            '',
            body
        ].filter(Boolean).join('\n');

        // Check dedup hash
        const hash = simpleHash(emailContent.substring(0, 500));
        if (hash === lastAnalyzedHash) return;
        lastAnalyzedHash = hash;

        // Check cache
        const cached = analysisCache.get(hash);
        if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_DURATION) {
            createEmailBanner(cached.result, sender, subject);
            return;
        }

        try {
            // Send to background for analysis
            const response = await chrome.runtime.sendMessage({
                type: 'ANALYZE_EMAIL',
                emailContent: emailContent,
                subject: subject,
                sender: sender
            });

            if (response && response.success && response.data) {
                // Cache the result
                analysisCache.set(hash, {
                    result: response.data,
                    timestamp: Date.now()
                });

                // Show banner
                createEmailBanner(response.data, sender, subject);
            }
        } catch (error) {
            console.error('PhishGuard: Email analysis error:', error);
        }
    }

    // ============================================================
    // DOM Observer — detect when an email is opened
    // ============================================================
    function scheduleAnalysis() {
        if (analyzeTimeout) clearTimeout(analyzeTimeout);
        analyzeTimeout = setTimeout(() => {
            // Check if we're viewing an email (not just the inbox)
            const emailBody = queryFirst(CONFIG.SELECTORS.emailBody);
            if (emailBody && emailBody.innerText.trim().length > CONFIG.MIN_TEXT_LENGTH) {
                analyzeEmail();
            }
        }, CONFIG.ANALYZE_DELAY);
    }

    // Watch for Gmail DOM changes (email open/navigation)
    const observer = new MutationObserver((mutations) => {
        // Look for significant DOM changes indicating email opened
        let shouldCheck = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if added node contains email body
                        if (node.classList &&
                            (node.classList.contains('a3s') ||
                             node.classList.contains('aiL') ||
                             node.querySelector?.('div.a3s'))) {
                            shouldCheck = true;
                            break;
                        }
                        // Check for conversation view changes
                        if (node.querySelector?.('div.a3s')) {
                            shouldCheck = true;
                            break;
                        }
                    }
                }
            }
            if (shouldCheck) break;
        }

        if (shouldCheck) {
            scheduleAnalysis();
        }
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Also check on URL hash changes (Gmail uses hash routing)
    let lastHash = location.hash;
    setInterval(() => {
        if (location.hash !== lastHash) {
            lastHash = location.hash;
            // Hash changed — might have opened an email
            // Reset last hash to allow re-analysis
            lastAnalyzedHash = '';
            removeBanner();
            scheduleAnalysis();
        }
    }, 500);

    // Initial check in case email is already open
    scheduleAnalysis();

    // ============================================================
    // Message Listener (from background)
    // ============================================================
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'TEXT_ANALYSIS_RESULT') {
            // Reuse the toast from content.js if needed
            sendResponse({ received: true });
        }
    });

    console.log('🧅 PhishGuard Gmail email detector initialized');
})();

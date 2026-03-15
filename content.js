/**
 * PhishGuard — Content Script
 * Runs on all pages to handle text selection and display inline alerts
 */

(function () {
    'use strict';

    // Prevent double-injection
    if (window.__phishguardInjected) return;
    window.__phishguardInjected = true;

    // ============================================================
    // Inline Alert Toast
    // ============================================================
    function createToast(data, originalText) {
        // Remove any existing toast
        const existingToast = document.getElementById('phishguard-toast');
        if (existingToast) existingToast.remove();

        const verdict = data.verdict || 'unknown';
        const isUnsafe = verdict === 'suspicious' || verdict === 'dangerous';

        const toast = document.createElement('div');
        toast.id = 'phishguard-toast';
        toast.innerHTML = `
      <div class="phishguard-toast-inner ${isUnsafe ? 'phishguard-danger' : 'phishguard-safe'}">
        <div class="phishguard-toast-header">
          <span class="phishguard-toast-icon">${isUnsafe ? '❌' : '✅'}</span>
          <span class="phishguard-toast-title">PhishGuard Analysis</span>
          <button class="phishguard-toast-close" id="phishguard-toast-close">&times;</button>
        </div>
        <div class="phishguard-toast-body">
          <div class="phishguard-toast-verdict">
            <strong>Verdict:</strong> 
            <span class="phishguard-verdict-badge phishguard-verdict-${verdict}">${verdict.toUpperCase()}</span>
            <span class="phishguard-confidence">${data.confidence || 0}% confidence</span>
          </div>
          <p class="phishguard-toast-summary">${data.summary || 'No summary available.'}</p>
          ${originalText ? `<p class="phishguard-toast-text"><em>"${originalText}"</em></p>` : ''}
        </div>
      </div>
    `;

        // Inject styles
        if (!document.getElementById('phishguard-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'phishguard-toast-styles';
            style.textContent = `
        #phishguard-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 2147483647;
          font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
          animation: phishguardSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          max-width: 420px;
          min-width: 320px;
        }
        .phishguard-toast-inner {
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .phishguard-toast-inner.phishguard-safe {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(6, 78, 59, 0.95));
        }
        .phishguard-toast-inner.phishguard-danger {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(127, 29, 29, 0.95));
        }
        .phishguard-toast-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .phishguard-toast-icon {
          font-size: 20px;
          line-height: 1;
        }
        .phishguard-toast-title {
          font-size: 14px;
          font-weight: 700;
          color: white;
          flex: 1;
          letter-spacing: 0.02em;
        }
        .phishguard-toast-close {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          line-height: 1;
        }
        .phishguard-toast-close:hover {
          background: rgba(255,255,255,0.35);
        }
        .phishguard-toast-body {
          color: rgba(255,255,255,0.95);
          font-size: 13px;
          line-height: 1.5;
        }
        .phishguard-toast-verdict {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .phishguard-verdict-badge {
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .phishguard-verdict-safe { background: rgba(255,255,255,0.25); }
        .phishguard-verdict-suspicious { background: rgba(251,191,36,0.3); color: #fbbf24; }
        .phishguard-verdict-dangerous { background: rgba(255,255,255,0.25); }
        .phishguard-confidence {
          font-size: 11px;
          opacity: 0.75;
        }
        .phishguard-toast-summary {
          margin: 4px 0;
          opacity: 0.9;
        }
        .phishguard-toast-text {
          margin: 8px 0 0;
          font-size: 12px;
          opacity: 0.7;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        @keyframes phishguardSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes phishguardSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(120%); opacity: 0; }
        }
      `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        // Close button
        document.getElementById('phishguard-toast-close').addEventListener('click', () => {
            toast.style.animation = 'phishguardSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => toast.remove(), 300);
        });

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
            if (document.getElementById('phishguard-toast')) {
                toast.style.animation = 'phishguardSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);
    }

    // ============================================================
    // Message Listener (from background)
    // ============================================================
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'TEXT_ANALYSIS_RESULT') {
            createToast(message.data, message.originalText);
            sendResponse({ received: true });
        }
    });

})();

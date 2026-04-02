/**
 * PhishGuard — Background Service Worker
 * Handles URL analysis, icon switching, notifications, and context menus
 */

// Import API functions
importScripts('api.js');

// ============================================================
// State Management
// ============================================================
const tabStates = new Map(); // tabId -> { verdict, confidence, summary, ... }
let extensionEnabled = true; // Track extension enabled state

// Load enabled state on startup
chrome.storage.local.get('extensionEnabled', (data) => {
    extensionEnabled = data.extensionEnabled !== false; // Default to true
});

// ============================================================
// Icon Management
// ============================================================
function getIconPaths(state) {
    // state: 'default', 'safe', 'danger'
    return {
        16: `icons/${state}-16.png`,
        32: `icons/${state}-32.png`,
        48: `icons/${state}-48.png`,
        128: `icons/${state}-128.png`
    };
}

async function setIcon(tabId, state) {
    try {
        // Verify tab still exists before setting icon
        await chrome.tabs.get(tabId);
    } catch (e) {
        // Tab no longer exists — skip icon update
        return;
    }

    try {
        await chrome.action.setIcon({
            tabId: tabId,
            path: getIconPaths(state)
        });

        // Set tooltip based on state
        const titles = {
            default: 'PhishGuard — Analyzing...',
            safe: 'PhishGuard — ✅ Site Verified Safe',
            danger: 'PhishGuard — ❌ Suspicious Site Detected!'
        };
        await chrome.action.setTitle({
            tabId: tabId,
            title: titles[state] || 'PhishGuard'
        });
    } catch (e) {
        // Silently ignore — tab may have been closed during the call
        if (!e.message?.includes('No tab with id')) {
            console.error('PhishGuard: Error setting icon:', e);
        }
    }
}

// ============================================================
// URL Analysis
// ============================================================
function shouldAnalyzeURL(url) {
    if (!url) return false;
    // Skip internal browser pages, extension pages, and new tab pages
    const skipPatterns = [
        'chrome://', 'chrome-extension://', 'about:', 'edge://',
        'brave://', 'opera://', 'vivaldi://', 'moz-extension://',
        'chrome-search://', 'devtools://', 'view-source:',
        'chrome://newtab', 'edge://newtab', 'about:newtab',
        'about:blank', 'about:home', 'about:privatebrowsing',
        'chrome://new-tab-page', 'edge://new-tab-page'
    ];
    
    // Check if URL matches any skip pattern
    if (skipPatterns.some(pattern => url.startsWith(pattern))) {
        return false;
    }
    
    // Also skip if it's just a new tab without a real URL
    try {
        const urlObj = new URL(url);
        // Skip if no real hostname
        if (!urlObj.hostname || urlObj.hostname === '') {
            return false;
        }
    } catch (e) {
        return false;
    }
    
    return true;
}

async function analyzeCurrentTab(tabId, url) {
    // Skip if extension is disabled
    if (!extensionEnabled) {
        setIcon(tabId, 'default');
        return;
    }

    if (!shouldAnalyzeURL(url)) {
        setIcon(tabId, 'default');
        return;
    }

    // Set default icon while analyzing
    setIcon(tabId, 'default');

    try {
        const result = await analyzeURL(url);

        if (result.success && result.data) {
            const analysis = result.data;

            // Store state for this tab
            tabStates.set(tabId, {
                url: url,
                verdict: analysis.verdict,
                confidence: analysis.confidence,
                risk_score: analysis.risk_score,
                reasons: analysis.reasons || [],
                summary: analysis.summary || '',
                category: analysis.category || 'unknown',
                timestamp: Date.now()
            });

            // Update icon based on verdict
            if (analysis.verdict === 'safe') {
                setIcon(tabId, 'safe');
            } else if (analysis.verdict === 'suspicious' || analysis.verdict === 'dangerous') {
                setIcon(tabId, 'danger');
                // Show notification for suspicious/dangerous sites
                showNotification(url, analysis);
            } else {
                setIcon(tabId, 'default');
            }
        } else {
            // API failed — store error state
            tabStates.set(tabId, {
                url: url,
                verdict: 'unknown',
                confidence: 0,
                risk_score: 0,
                reasons: ['Analysis could not be completed'],
                summary: result.error || 'API call failed',
                category: 'unknown',
                timestamp: Date.now()
            });
            setIcon(tabId, 'default');
        }
    } catch (error) {
        console.error('PhishGuard: Analysis error:', error);
        setIcon(tabId, 'default');
    }
}

// ============================================================
// Notifications
// ============================================================
function showNotification(url, analysis) {
    const hostname = new URL(url).hostname;
    const isEmoji = analysis.verdict === 'dangerous';

    chrome.notifications.create(`phishguard-${Date.now()}`, {
        type: 'basic',
        iconUrl: isEmoji ? 'icons/danger-128.png' : 'icons/danger-128.png',
        title: `⚠️ PhishGuard Alert — ${analysis.verdict.toUpperCase()}`,
        message: `${hostname}\n${analysis.summary || 'This website may be suspicious.'}`,
        priority: 2,
        requireInteraction: analysis.verdict === 'dangerous'
    });
}

// ============================================================
// Context Menu
// ============================================================
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'phishguard-check-text',
        title: '🛡️ Check with PhishGuard',
        contexts: ['selection']
    });
    
    // Pre-fetch OpenPhish database on install
    if (typeof fetchOpenPhishDatabase === 'function') {
        fetchOpenPhishDatabase().then(() => {
            console.log('PhishGuard: OpenPhish database pre-loaded on install');
        });
    }
});

// Pre-fetch OpenPhish database on service worker startup
if (typeof fetchOpenPhishDatabase === 'function') {
    fetchOpenPhishDatabase().then(() => {
        console.log('PhishGuard: OpenPhish database pre-loaded on startup');
    });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'phishguard-check-text' && info.selectionText) {
        // Store selected text for the popup to retrieve
        await chrome.storage.local.set({
            selectedText: info.selectionText,
            selectedTextTimestamp: Date.now()
        });

        // Open the popup by invoking the action
        // Since we can't programmatically open popup, we use a workaround:
        // Send message to content script to show inline notification
        // and set a badge to alert user
        chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
        chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#ff6b35' });

        // Auto-analyze the selected text
        const result = await analyzeText(info.selectionText);

        if (result.success && result.data) {
            await chrome.storage.local.set({
                lastTextAnalysis: result.data,
                lastTextAnalysisTimestamp: Date.now()
            });

            // Notify through content script
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'TEXT_ANALYSIS_RESULT',
                    data: result.data,
                    originalText: info.selectionText.substring(0, 100) + (info.selectionText.length > 100 ? '...' : '')
                });
            } catch (e) {
                console.error('PhishGuard: Could not send to content script:', e);
            }

            // Show browser notification for suspicious text
            if (result.data.verdict !== 'safe') {
                chrome.notifications.create(`phishguard-text-${Date.now()}`, {
                    type: 'basic',
                    iconUrl: 'icons/danger-128.png',
                    title: `⚠️ PhishGuard — Suspicious Text Detected`,
                    message: result.data.summary || 'The selected text may contain phishing or spam content.',
                    priority: 2
                });
            }
        }

        // Clear badge after a delay
        setTimeout(() => {
            chrome.action.setBadgeText({ tabId: tab.id, text: '' });
        }, 5000);
    }
});

// ============================================================
// Tab Navigation Listeners
// ============================================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        analyzeCurrentTab(tabId, tab.url);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            // Check if we already have a cached result
            const cachedState = tabStates.get(activeInfo.tabId);
            if (cachedState && cachedState.url === tab.url) {
                // Restore icon from cache
                if (cachedState.verdict === 'safe') {
                    setIcon(activeInfo.tabId, 'safe');
                } else if (cachedState.verdict === 'suspicious' || cachedState.verdict === 'dangerous') {
                    setIcon(activeInfo.tabId, 'danger');
                } else {
                    setIcon(activeInfo.tabId, 'default');
                }
            } else {
                analyzeCurrentTab(activeInfo.tabId, tab.url);
            }
        }
    } catch (e) {
        console.error('PhishGuard: Tab activation error:', e);
    }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
});

// ============================================================
// Message Handling (from popup / content scripts)
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'toggleExtension') {
        extensionEnabled = message.enabled;
        // Update all tab icons when disabled
        if (!extensionEnabled) {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    setIcon(tab.id, 'default');
                });
            });
        } else {
            // Re-analyze active tab when re-enabled
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url) {
                    analyzeCurrentTab(tabs[0].id, tabs[0].url);
                }
            });
        }
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'GET_TAB_STATE') {
        // Popup requesting current tab analysis state
        chrome.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
            if (tabs[0]) {
                const state = tabStates.get(tabs[0].id);
                sendResponse({
                    state: state || null,
                    url: tabs[0].url,
                    title: tabs[0].title
                });
            } else {
                sendResponse({ state: null, url: '', title: '' });
            }
        });
        return true; // Keep message channel open for async response
    }

    if (message.type === 'ANALYZE_URL') {
        analyzeURL(message.url).then(result => {
            sendResponse(result);
        });
        return true;
    }

    if (message.type === 'ANALYZE_TEXT') {
        analyzeText(message.text).then(result => {
            sendResponse(result);
        });
        return true;
    }

    if (message.type === 'ANALYZE_EMAIL') {
        // Email content from Gmail content script
        analyzeText(message.emailContent).then(async (result) => {
            if (result.success && result.data) {
                // Store in tab state so popup can display it
                try {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tabs[0]) {
                        tabStates.set(tabs[0].id, {
                            url: tabs[0].url,
                            verdict: result.data.verdict,
                            confidence: result.data.confidence,
                            risk_score: result.data.risk_score,
                            reasons: result.data.reasons || [],
                            summary: result.data.summary || '',
                            category: result.data.category || 'unknown',
                            red_flags: result.data.red_flags || [],
                            recommended_action: result.data.recommended_action || '',
                            isEmailAnalysis: true,
                            emailSubject: message.subject || '',
                            emailSender: message.sender || '',
                            timestamp: Date.now()
                        });

                        // Update icon based on email verdict
                        if (result.data.verdict === 'safe') {
                            setIcon(tabs[0].id, 'safe');
                        } else if (result.data.verdict === 'suspicious' || result.data.verdict === 'dangerous') {
                            setIcon(tabs[0].id, 'danger');
                            // Notify for dangerous emails
                            showNotification(tabs[0].url, result.data);
                        }
                    }
                } catch (e) {
                    console.error('PhishGuard: Could not update tab state for email:', e);
                }
            }
            sendResponse(result);
        });
        return true;
    }

    if (message.type === 'REANALYZE_TAB') {
        chrome.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
            if (tabs[0] && tabs[0].url) {
                // Clear cached state
                tabStates.delete(tabs[0].id);
                // Re-analyze
                await analyzeCurrentTab(tabs[0].id, tabs[0].url);
                const newState = tabStates.get(tabs[0].id);
                sendResponse({ state: newState || null });
            } else {
                sendResponse({ state: null });
            }
        });
        return true;
    }

    if (message.type === 'GET_SELECTED_TEXT') {
        chrome.storage.local.get(['selectedText', 'selectedTextTimestamp', 'lastTextAnalysis', 'lastTextAnalysisTimestamp'], (data) => {
            sendResponse(data);
        });
        return true;
    }

    if (message.type === 'SUBMIT_FEEDBACK') {
        // User is reporting a website as safe or phishing
        const { hostname, reportedVerdict, currentVerdict, tier } = message;
        
        // Don't allow overriding hardcoded safe domains, dangerous keywords, or confirmed phishing
        const protectedTiers = ['safe_domain', 'dangerous_keyword', 'openphish_database'];
        if (!message.canOverride || protectedTiers.includes(tier)) {
            sendResponse({ 
                success: false, 
                error: 'Cannot override verified safe domains or confirmed phishing sites.' 
            });
            return true;
        }
        
        // Save user feedback (will take effect on next page load)
        saveUserFeedback(hostname, reportedVerdict, currentVerdict, tier).then(success => {
            if (success) {
                // RULE 2: Do NOT update UI instantly
                // The feedback will take effect when the page is reloaded or opened in a new tab
                sendResponse({ 
                    success: true, 
                    message: 'Feedback saved. Changes will apply on next page load.'
                });
            } else {
                sendResponse({ success: false, error: 'Thank you for the feedback' });
            }
        });
        return true;
    }
});

console.log('🧅 PhishGuard service worker initialized');

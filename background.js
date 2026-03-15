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
        console.error('PhishGuard: Error setting icon:', e);
    }
}

// ============================================================
// URL Analysis
// ============================================================
function shouldAnalyzeURL(url) {
    if (!url) return false;
    // Skip internal browser pages and extension pages
    const skipPatterns = [
        'chrome://', 'chrome-extension://', 'about:', 'edge://',
        'brave://', 'opera://', 'vivaldi://', 'moz-extension://',
        'chrome-search://', 'devtools://', 'view-source:'
    ];
    return !skipPatterns.some(pattern => url.startsWith(pattern));
}

async function analyzeCurrentTab(tabId, url) {
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
});

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
});

console.log('🧅 PhishGuard service worker initialized');

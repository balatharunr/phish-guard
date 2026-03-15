/**
 * PhishGuard — Popup Controller
 * Handles UI interactions, tab communication, and result rendering
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // DOM References
    // ============================================================
    const elements = {
        // Header
        headerLogo: document.getElementById('headerLogo'),
        statusDot: document.getElementById('statusDot'),
        statusText: document.getElementById('statusText'),

        // Tabs
        tabWebsite: document.getElementById('tabWebsite'),
        tabText: document.getElementById('tabText'),
        panelWebsite: document.getElementById('panelWebsite'),
        panelText: document.getElementById('panelText'),

        // Website panel
        siteUrl: document.getElementById('siteUrl'),
        siteTitle: document.getElementById('siteTitle'),
        verdictCard: document.getElementById('verdictCard'),
        verdictLoading: document.getElementById('verdictLoading'),
        verdictResult: document.getElementById('verdictResult'),
        verdictIcon: document.getElementById('verdictIcon'),
        verdictLabel: document.getElementById('verdictLabel'),
        verdictSummary: document.getElementById('verdictSummary'),
        confidenceValue: document.getElementById('confidenceValue'),
        confidenceFill: document.getElementById('confidenceFill'),
        riskValue: document.getElementById('riskValue'),
        riskFill: document.getElementById('riskFill'),
        detailsSection: document.getElementById('detailsSection'),
        detailsToggle: document.getElementById('detailsToggle'),
        detailsContent: document.getElementById('detailsContent'),
        detailCategory: document.getElementById('detailCategory'),
        reasonsList: document.getElementById('reasonsList'),
        btnReanalyze: document.getElementById('btnReanalyze'),

        // Text panel
        textInput: document.getElementById('textInput'),
        btnAnalyze: document.getElementById('btnAnalyze'),
        textResult: document.getElementById('textResult'),
        textResultIcon: document.getElementById('textResultIcon'),
        textResultVerdict: document.getElementById('textResultVerdict'),
        textResultSummary: document.getElementById('textResultSummary'),
        textConfidenceValue: document.getElementById('textConfidenceValue'),
        textConfidenceFill: document.getElementById('textConfidenceFill'),
        redFlags: document.getElementById('redFlags'),
        flagsList: document.getElementById('flagsList'),
        textReasons: document.getElementById('textReasons'),
        recommendedAction: document.getElementById('recommendedAction'),
        actionText: document.getElementById('actionText'),
        textLoading: document.getElementById('textLoading')
    };

    // ============================================================
    // Tab Switching
    // ============================================================
    function switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

        if (tabName === 'website') {
            elements.tabWebsite.classList.add('active');
            elements.panelWebsite.classList.add('active');
        } else {
            elements.tabText.classList.add('active');
            elements.panelText.classList.add('active');
        }
    }

    elements.tabWebsite.addEventListener('click', () => switchTab('website'));
    elements.tabText.addEventListener('click', () => switchTab('text'));

    // ============================================================
    // Details Toggle
    // ============================================================
    elements.detailsToggle.addEventListener('click', () => {
        elements.detailsToggle.classList.toggle('open');
        elements.detailsContent.classList.toggle('hidden');
    });

    // ============================================================
    // Website Analysis Display
    // ============================================================
    function displayWebsiteResult(state, url, title) {
        // Show site info
        try {
            const urlObj = new URL(url);
            elements.siteUrl.textContent = urlObj.hostname;
        } catch {
            elements.siteUrl.textContent = url || 'Unknown';
        }
        elements.siteTitle.textContent = title || '';

        if (!state) {
            // Still loading or no result
            elements.verdictLoading.classList.remove('hidden');
            elements.verdictResult.classList.add('hidden');
            elements.detailsSection.classList.add('hidden');
            setHeaderStatus('analyzing', 'Analyzing...');
            return;
        }

        // Hide loading, show result
        elements.verdictLoading.classList.add('hidden');
        elements.verdictResult.classList.remove('hidden');

        const verdict = state.verdict || 'unknown';

        // Set verdict card styling
        elements.verdictCard.className = 'verdict-card';
        if (verdict === 'safe') {
            elements.verdictCard.classList.add('safe');
            elements.verdictIcon.textContent = '✅';
            elements.verdictLabel.textContent = 'SAFE';
            elements.verdictLabel.className = 'verdict-label safe';
            elements.headerLogo.textContent = '✅';
            setHeaderStatus('safe', 'Verified Safe');
        } else if (verdict === 'suspicious') {
            elements.verdictCard.classList.add('suspicious');
            elements.verdictIcon.textContent = '⚠️';
            elements.verdictLabel.textContent = 'SUSPICIOUS';
            elements.verdictLabel.className = 'verdict-label suspicious';
            elements.headerLogo.textContent = '❌';
            setHeaderStatus('danger', 'Suspicious');
        } else if (verdict === 'dangerous') {
            elements.verdictCard.classList.add('danger');
            elements.verdictIcon.textContent = '❌';
            elements.verdictLabel.textContent = 'DANGEROUS';
            elements.verdictLabel.className = 'verdict-label dangerous';
            elements.headerLogo.textContent = '❌';
            setHeaderStatus('danger', 'Dangerous!');
        } else {
            elements.verdictIcon.textContent = '🧅';
            elements.verdictLabel.textContent = 'UNKNOWN';
            elements.verdictLabel.className = 'verdict-label';
            elements.headerLogo.textContent = '🧅';
            setHeaderStatus('analyzing', 'Unknown');
        }

        elements.verdictSummary.textContent = state.summary || 'No summary available.';

        // Confidence bar
        const confidence = state.confidence || 0;
        elements.confidenceValue.textContent = `${confidence}%`;
        setTimeout(() => {
            elements.confidenceFill.style.width = `${confidence}%`;
        }, 100);

        // Risk bar
        const risk = state.risk_score || 0;
        elements.riskValue.textContent = `${risk}/100`;
        elements.riskFill.className = 'risk-fill';
        if (risk < 30) elements.riskFill.classList.add('low');
        else if (risk < 70) elements.riskFill.classList.add('medium');
        else elements.riskFill.classList.add('high');
        setTimeout(() => {
            elements.riskFill.style.width = `${risk}%`;
        }, 200);

        // Details section
        elements.detailsSection.classList.remove('hidden');
        elements.detailCategory.textContent = (state.category || 'unknown').charAt(0).toUpperCase() + (state.category || 'unknown').slice(1);

        // Reasons list
        elements.reasonsList.innerHTML = '';
        if (state.reasons && state.reasons.length > 0) {
            state.reasons.forEach(reason => {
                const item = document.createElement('div');
                item.className = 'reason-item';
                item.innerHTML = `<span class="reason-bullet">●</span><span>${escapeHtml(reason)}</span>`;
                elements.reasonsList.appendChild(item);
            });
        }
    }

    function setHeaderStatus(state, text) {
        elements.statusDot.className = `status-dot ${state}`;
        elements.statusText.textContent = text;
    }

    // ============================================================
    // Text Analysis
    // ============================================================
    elements.btnAnalyze.addEventListener('click', async () => {
        const text = elements.textInput.value.trim();
        if (!text) {
            elements.textInput.focus();
            elements.textInput.style.borderColor = 'var(--accent-red)';
            setTimeout(() => {
                elements.textInput.style.borderColor = '';
            }, 1500);
            return;
        }

        // Show loading
        elements.btnAnalyze.disabled = true;
        elements.textResult.classList.add('hidden');
        elements.textLoading.classList.remove('hidden');

        try {
            const result = await chrome.runtime.sendMessage({
                type: 'ANALYZE_TEXT',
                text: text
            });

            elements.textLoading.classList.add('hidden');
            elements.btnAnalyze.disabled = false;

            if (result && result.success && result.data) {
                displayTextResult(result.data);
            } else {
                displayTextResult({
                    verdict: 'unknown',
                    confidence: 0,
                    summary: result?.error || 'Analysis failed. Please try again.',
                    reasons: [],
                    red_flags: [],
                    recommended_action: 'Try again later or verify the content manually.'
                });
            }
        } catch (error) {
            elements.textLoading.classList.add('hidden');
            elements.btnAnalyze.disabled = false;
            displayTextResult({
                verdict: 'unknown',
                confidence: 0,
                summary: 'Error: ' + error.message,
                reasons: [],
                red_flags: [],
                recommended_action: 'Please try again.'
            });
        }
    });

    function displayTextResult(data) {
        elements.textResult.classList.remove('hidden');

        const verdict = data.verdict || 'unknown';

        // Icon and verdict
        if (verdict === 'safe') {
            elements.textResultIcon.textContent = '✅';
            elements.textResultVerdict.textContent = 'SAFE';
            elements.textResultVerdict.className = 'text-result-verdict safe';
        } else if (verdict === 'suspicious') {
            elements.textResultIcon.textContent = '⚠️';
            elements.textResultVerdict.textContent = 'SUSPICIOUS';
            elements.textResultVerdict.className = 'text-result-verdict suspicious';
        } else if (verdict === 'dangerous') {
            elements.textResultIcon.textContent = '❌';
            elements.textResultVerdict.textContent = 'DANGEROUS';
            elements.textResultVerdict.className = 'text-result-verdict dangerous';
        } else {
            elements.textResultIcon.textContent = '🧅';
            elements.textResultVerdict.textContent = 'UNKNOWN';
            elements.textResultVerdict.className = 'text-result-verdict';
        }

        elements.textResultSummary.textContent = data.summary || '';

        // Confidence
        const confidence = data.confidence || 0;
        elements.textConfidenceValue.textContent = `${confidence}%`;
        setTimeout(() => {
            elements.textConfidenceFill.style.width = `${confidence}%`;
        }, 100);

        // Red flags
        if (data.red_flags && data.red_flags.length > 0) {
            elements.redFlags.classList.remove('hidden');
            elements.flagsList.innerHTML = '';
            data.red_flags.forEach(flag => {
                const li = document.createElement('li');
                li.textContent = flag;
                elements.flagsList.appendChild(li);
            });
        } else {
            elements.redFlags.classList.add('hidden');
        }

        // Reasons
        elements.textReasons.innerHTML = '';
        if (data.reasons && data.reasons.length > 0) {
            data.reasons.forEach(reason => {
                const item = document.createElement('div');
                item.className = 'reason-item';
                item.innerHTML = `<span class="reason-bullet">●</span><span>${escapeHtml(reason)}</span>`;
                elements.textReasons.appendChild(item);
            });
        }

        // Recommended action
        if (data.recommended_action) {
            elements.recommendedAction.classList.remove('hidden');
            elements.actionText.textContent = data.recommended_action;
        } else {
            elements.recommendedAction.classList.add('hidden');
        }
    }

    // ============================================================
    // Re-analyze
    // ============================================================
    elements.btnReanalyze.addEventListener('click', async () => {
        elements.verdictLoading.classList.remove('hidden');
        elements.verdictResult.classList.add('hidden');
        elements.detailsSection.classList.add('hidden');
        setHeaderStatus('analyzing', 'Re-analyzing...');
        elements.headerLogo.textContent = '🧅';

        try {
            const result = await chrome.runtime.sendMessage({ type: 'REANALYZE_TAB' });
            if (result && result.state) {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                displayWebsiteResult(result.state, tabs[0]?.url || '', tabs[0]?.title || '');
            }
        } catch (error) {
            console.error('Re-analyze error:', error);
            setHeaderStatus('danger', 'Error');
        }
    });

    // ============================================================
    // Check for context menu selected text
    // ============================================================
    async function checkSelectedText() {
        try {
            const data = await chrome.runtime.sendMessage({ type: 'GET_SELECTED_TEXT' });
            if (data && data.selectedText && data.selectedTextTimestamp) {
                // Only use if recent (within 30 seconds)
                if (Date.now() - data.selectedTextTimestamp < 30000) {
                    switchTab('text');
                    elements.textInput.value = data.selectedText;

                    // If we have a pre-computed result, display it
                    if (data.lastTextAnalysis && data.lastTextAnalysisTimestamp &&
                        Date.now() - data.lastTextAnalysisTimestamp < 30000) {
                        displayTextResult(data.lastTextAnalysis);
                    }

                    // Clear the stored text
                    chrome.storage.local.remove(['selectedText', 'selectedTextTimestamp']);
                }
            }
        } catch (e) {
            // No selected text, that's fine
        }
    }

    // ============================================================
    // Initialize
    // ============================================================
    async function init() {
        setHeaderStatus('analyzing', 'Loading...');

        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_TAB_STATE' });

            if (response) {
                if (response.state) {
                    displayWebsiteResult(response.state, response.url, response.title);
                } else if (response.url) {
                    // No cached state — analysis might be in progress
                    try {
                        const urlObj = new URL(response.url);
                        elements.siteUrl.textContent = urlObj.hostname;
                    } catch {
                        elements.siteUrl.textContent = response.url || 'Unknown';
                    }
                    elements.siteTitle.textContent = response.title || '';
                    elements.verdictLoading.classList.remove('hidden');
                    elements.verdictResult.classList.add('hidden');
                    setHeaderStatus('analyzing', 'Analyzing...');

                    // Wait a bit and try again
                    setTimeout(async () => {
                        try {
                            const retryResponse = await chrome.runtime.sendMessage({ type: 'GET_TAB_STATE' });
                            if (retryResponse && retryResponse.state) {
                                displayWebsiteResult(retryResponse.state, retryResponse.url, retryResponse.title);
                            }
                        } catch (e) { /* ignore */ }
                    }, 3000);
                }
            }
        } catch (error) {
            console.error('Init error:', error);
            setHeaderStatus('danger', 'Error');
            elements.siteUrl.textContent = 'Unable to connect';
        }

        // Check for selected text from context menu
        checkSelectedText();
    }

    // ============================================================
    // Utility
    // ============================================================
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // Start
    init();
});

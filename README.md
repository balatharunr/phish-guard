# 🧅 PhishGuard — AI-Powered Phishing & Spam Detector

<div align="center">

**A Chrome extension that uses AI to detect phishing websites, spam emails, and suspicious text in real-time.**

🧅 Default &nbsp;|&nbsp; ✅ Safe &nbsp;|&nbsp; ❌ Dangerous

</div>

---

## 🎯 Features

### 🌐 Automatic Website Analysis
- Automatically analyzes every website you visit for phishing, scams, and malicious intent
- **Dynamic extension icon** changes based on verdict:
  - 🧅 **Onion** — Default/Analyzing
  - ✅ **Check mark** — Website is verified safe
  - ❌ **Cross** — Website is suspicious or dangerous
- **Browser notifications** alert you only when suspicious sites are detected

### 📧 Text & Email Analysis
- Paste any email content, message, or suspicious text into the popup to analyze it
- Detects phishing indicators, spam patterns, social engineering tactics
- Shows **red flags**, **risk score**, and **recommended actions**

### 📝 Right-Click Context Menu
- Select any text on any webpage → right-click → **"Check with PhishGuard"**
- Instantly analyzes the selected text for phishing/spam
- Shows results as an inline toast notification and in the extension popup

### 🎨 Premium Dark UI
- Glassmorphism design with animated micro-interactions
- Confidence meters with animated progress bars
- Detailed risk breakdowns and analysis reports

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Extension Type** | Chrome Extension (Manifest V3) |
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Styling** | Custom CSS with Glassmorphism, CSS Animations |
| **Typography** | Google Fonts — Inter |
| **AI Model** | `nvidia/nemotron-3-super-120b-a12b:free` |
| **API Provider** | [OpenRouter](https://openrouter.ai/) |
| **Icons** | Canvas-generated emoji PNGs (via Node.js `canvas` package) |
| **Architecture** | Service Worker (background) + Content Scripts + Popup |

---

## 📁 Project Structure

```
email-web-spam-detector/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker — URL analysis, icons, notifications, context menu
├── content.js             # Content script — inline toast alerts, text selection handling
├── api.js                 # OpenRouter API utility — URL and text analysis functions
├── popup.html             # Popup UI structure
├── popup.css              # Popup styling — dark glassmorphism theme
├── popup.js               # Popup controller — tab switching, result rendering
├── generate-icons.js      # Node.js script to generate PNG icons from emoji
├── icons/                 # Generated icon assets
│   ├── default-16.png     # 🧅 Onion icons (16/32/48/128px)
│   ├── default-32.png
│   ├── default-48.png
│   ├── default-128.png
│   ├── safe-16.png        # ✅ Safe icons (16/32/48/128px)
│   ├── safe-32.png
│   ├── safe-48.png
│   ├── safe-128.png
│   ├── danger-16.png      # ❌ Danger icons (16/32/48/128px)
│   ├── danger-32.png
│   ├── danger-48.png
│   └── danger-128.png
├── package.json
└── README.md
```

---

## 🚀 Installation

### Prerequisites
- Google Chrome (or any Chromium-based browser)
- Node.js (only required if regenerating icons)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/email-web-spam-detector.git
   cd email-web-spam-detector
   ```

2. **Generate icons** (only if icons aren't already present)
   ```bash
   npm install canvas
   node generate-icons.js
   ```

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer Mode** (toggle in the top-right)
   - Click **"Load unpacked"**
   - Select the `email-web-spam-detector` folder
   - The extension should appear with the 🧅 onion icon in your toolbar

4. **Pin the extension** (recommended)
   - Click the puzzle piece icon in the toolbar
   - Find "PhishGuard" and click the pin icon

---

## 📖 Usage Guide

### 1. Automatic Website Checking
Simply browse the web as usual. PhishGuard automatically analyzes every page you visit:
- Watch the extension icon change based on the website's safety verdict
- If a suspicious site is detected, you'll receive a **browser notification**
- Click the extension icon to see detailed analysis

### 2. Manual Text Analysis
1. Click the PhishGuard extension icon
2. Switch to the **"Text Analysis"** tab
3. Paste the suspicious email, message, or text
4. Click **"Analyze Text"**
5. View the verdict, confidence score, red flags, and recommended actions

### 3. Right-Click Text Check
1. Select any suspicious text on a webpage
2. Right-click and choose **"🛡️ Check with PhishGuard"**
3. A toast notification will appear with the analysis result
4. Click the extension icon for detailed results

### 4. Re-analyze a Page
Click the **"Re-analyze"** button in the popup to force a fresh analysis of the current page.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    BROWSER TAB                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Content Script (content.js)                     │ │
│  │  • Displays inline toast alerts                  │ │
│  │  • Receives analysis results from background     │ │
│  └─────────────┬───────────────────────────────────┘ │
└────────────────┼─────────────────────────────────────┘
                 │ chrome.runtime messages
                 ▼
┌──────────────────────────────────────────────────────┐
│         Background Service Worker (background.js)     │
│  • Listens for tab navigation events                  │
│  • Calls OpenRouter API via api.js                    │
│  • Updates extension icon dynamically                 │
│  • Fires browser notifications                        │
│  • Manages context menu                               │
│  • Caches analysis results per tab                    │
└────────────────┬─────────────────────────────────────┘
                 │ chrome.runtime messages
                 ▼
┌──────────────────────────────────────────────────────┐
│            Popup (popup.html/css/js)                   │
│  • Displays website analysis verdict                  │
│  • Text analysis input & results                      │
│  • Confidence meters & risk scores                    │
│  • Details accordion with reasons                     │
└──────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│           OpenRouter API (api.js)                      │
│  • Model: nvidia/nemotron-3-super-120b-a12b:free      │
│  • Endpoint: openrouter.ai/api/v1/chat/completions    │
│  • Structured JSON responses                          │
└──────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuration

### Changing the AI Model
Edit the `API_CONFIG` object in `api.js`:
```javascript
const API_CONFIG = {
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: 'YOUR_API_KEY',
  model: 'nvidia/nemotron-3-super-120b-a12b:free', // Change this
  siteName: 'PhishGuard Extension',
  siteUrl: 'https://github.com/phishguard'
};
```

### Supported Free Models on OpenRouter
- `nvidia/nemotron-3-super-120b-a12b:free` (default)
- `meta-llama/llama-3.1-8b-instruct:free`
- `google/gemma-2-9b-it:free`
- `mistralai/mistral-7b-instruct:free`

---

## 🔒 Privacy & Security

- **No data collection**: PhishGuard does not store or transmit your browsing data to any server other than OpenRouter for analysis
- **Local processing**: All URL and text analysis requests go directly to OpenRouter's API
- **No tracking**: The extension does not include any analytics or tracking code
- **Open source**: All code is available for inspection

---

## 🧪 How It Works

1. **URL Analysis**: When you visit a website, the background service worker captures the URL and sends it to the AI model. The model evaluates the URL for phishing patterns, typosquatting, suspicious TLDs, and known malicious indicators.

2. **Text Analysis**: When you paste text or select text via the context menu, it's sent to the AI model with a specialized prompt that checks for social engineering, phishing indicators, spam patterns, and suspicious links.

3. **Verdict System**: The AI returns a structured JSON response with:
   - **Verdict**: `safe`, `suspicious`, or `dangerous`
   - **Confidence**: 0-100% certainty score
   - **Risk Score**: 0-100 risk assessment
   - **Reasons**: List of specific findings
   - **Category**: Type of threat (phishing, scam, spam, malware, etc.)

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

<div align="center">

**Built with 🧅 by PhishGuard**

*Stay safe online. Trust but verify.*

</div>

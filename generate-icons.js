/**
 * PhishGuard — Icon Generator
 * Generates PNG icons from emoji for all three states and sizes.
 * 
 * Usage: node generate-icons.js
 * Requires: npm install canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'icons');

const ICON_CONFIGS = [
    { name: 'default', emoji: '🧅', bg: '#1a1a2e' },
    { name: 'safe', emoji: '✅', bg: '#0a2e1a' },
    { name: 'danger', emoji: '❌', bg: '#2e0a0a' }
];

const SIZES = [16, 32, 48, 128];

function generateIcon(emoji, size, bgColor) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background with rounded corners effect
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Draw emoji centered
    const fontSize = Math.floor(size * 0.7);
    ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + (size * 0.05));

    return canvas.toBuffer('image/png');
}

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Generate all icons
for (const config of ICON_CONFIGS) {
    for (const size of SIZES) {
        const filename = `${config.name}-${size}.png`;
        const filepath = path.join(ICONS_DIR, filename);
        const buffer = generateIcon(config.emoji, size, config.bg);
        fs.writeFileSync(filepath, buffer);
        console.log(`✓ Generated ${filename}`);
    }
}

console.log('\nAll icons generated successfully!');

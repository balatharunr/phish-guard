/**
 * PhishGuard — Icon Generator
 * Generates PNG icons from SVG shapes for all three states and sizes.
 * Uses basic canvas drawing (no emoji fonts) for cross-platform compatibility.
 * 
 * Usage: node generate-icons.js
 * Requires: npm install canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'icons');

const SIZES = [16, 32, 48, 128];

// ============================================================
// Drawing functions for each icon state
// ============================================================

/**
 * Default icon — Onion/Shield shape (purple-blue)
 */
function drawDefaultIcon(ctx, size) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);

    // Shield/onion body
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r * 0.9, cy - r * 0.6, cx + r * 0.9, cy + r * 0.3, cx, cy + r);
    ctx.bezierCurveTo(cx - r * 0.9, cy + r * 0.3, cx - r * 0.9, cy - r * 0.6, cx, cy - r);
    ctx.closePath();

    // Gradient fill
    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, '#818cf8');
    grad.addColorStop(1, '#6366f1');
    ctx.fillStyle = grad;
    ctx.fill();

    // Inner highlight
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.55);
    ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.3, cx + r * 0.5, cy + r * 0.15, cx, cy + r * 0.55);
    ctx.bezierCurveTo(cx - r * 0.5, cy + r * 0.15, cx - r * 0.5, cy - r * 0.3, cx, cy - r * 0.55);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();

    // Question mark in center (small)
    const fontSize = Math.max(Math.floor(size * 0.3), 6);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('?', cx, cy + size * 0.02);
}

/**
 * Safe icon — Green circle with white checkmark
 */
function drawSafeIcon(ctx, size) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.4;

    // Background
    ctx.fillStyle = '#0a1e14';
    ctx.fillRect(0, 0, size, size);

    // Green circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    grad.addColorStop(0, '#34d399');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.fill();

    // White checkmark
    const lw = Math.max(size * 0.08, 1.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy + r * 0.05);
    ctx.lineTo(cx - r * 0.05, cy + r * 0.4);
    ctx.lineTo(cx + r * 0.45, cy - r * 0.35);
    ctx.stroke();
}

/**
 * Danger icon — Red circle with white X
 */
function drawDangerIcon(ctx, size) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.4;

    // Background
    ctx.fillStyle = '#1e0a0a';
    ctx.fillRect(0, 0, size, size);

    // Red circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    grad.addColorStop(0, '#f87171');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.fill();

    // White X
    const lw = Math.max(size * 0.08, 1.5);
    const xr = r * 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - xr, cy - xr);
    ctx.lineTo(cx + xr, cy + xr);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + xr, cy - xr);
    ctx.lineTo(cx - xr, cy + xr);
    ctx.stroke();
}

// ============================================================
// Icon Configs
// ============================================================
const ICON_CONFIGS = [
    { name: 'default', draw: drawDefaultIcon },
    { name: 'safe', draw: drawSafeIcon },
    { name: 'danger', draw: drawDangerIcon }
];

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Generate all icons
for (const config of ICON_CONFIGS) {
    for (const size of SIZES) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Enable anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        config.draw(ctx, size);

        const filename = `${config.name}-${size}.png`;
        const filepath = path.join(ICONS_DIR, filename);
        fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
        console.log(`✓ Generated ${filename}`);
    }
}

console.log('\nAll icons generated successfully!');

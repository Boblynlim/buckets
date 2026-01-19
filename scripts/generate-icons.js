const fs = require('fs');
const path = require('path');

// Simple SVG icon template for Buckets app
// Features a bucket/container shape with the app theme color
const generateSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#4747FF" rx="${size * 0.2}"/>

  <!-- Bucket shape in white -->
  <g transform="translate(${size * 0.2}, ${size * 0.25})">
    <!-- Top rim -->
    <rect x="0" y="0" width="${size * 0.6}" height="${size * 0.08}" fill="#F5F3F0" rx="${size * 0.02}"/>

    <!-- Bucket body (trapezoid shape) -->
    <path d="M ${size * 0.05} ${size * 0.08}
             L ${size * 0.55} ${size * 0.08}
             L ${size * 0.5} ${size * 0.55}
             L ${size * 0.1} ${size * 0.55} Z"
          fill="#F5F3F0"/>

    <!-- Handle -->
    <path d="M ${size * 0.15} ${size * 0.02}
             Q ${size * 0.3} ${size * -0.08}, ${size * 0.45} ${size * 0.02}"
          stroke="#F5F3F0" stroke-width="${size * 0.04}" fill="none" stroke-linecap="round"/>

    <!-- $ Symbol in bucket -->
    <text x="${size * 0.3}" y="${size * 0.38}"
          font-family="Space Mono, monospace"
          font-size="${size * 0.2}"
          font-weight="bold"
          fill="#4747FF"
          text-anchor="middle">$</text>
  </g>
</svg>
`;

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons
const sizes = [192, 512];
sizes.forEach(size => {
  const svg = generateSVG(size);
  const filename = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(filename, svg.trim());
  console.log(`Created ${filename}`);
});

// Generate apple-touch-icon (180x180)
const appleTouchIcon = generateSVG(180);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.svg'), appleTouchIcon.trim());
console.log('Created apple-touch-icon.svg');

// Generate favicon (32x32)
const favicon = generateSVG(32);
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), favicon.trim());
console.log('Created favicon.svg');

console.log('\nSVG icons generated successfully!');
console.log('\nNote: Modern browsers support SVG icons directly.');
console.log('If you need PNG versions, you can convert them using:');
console.log('  - Online tools like cloudconvert.com');
console.log('  - ImageMagick: convert icon.svg icon.png');
console.log('  - Or use a package like sharp: npm install sharp');

// Original illustrative SVG placeholders for the spa categories (3 variants each).
// Replace the files in public/images with real spa photos when available.
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('public/images');
fs.mkdirSync(out, { recursive: true });

const palettes = {
  massage: [['#fff1e6', '#d9a066', '#8b5e34'], ['#fdf2f8', '#e8a0bf', '#9d4f73'], ['#f1f5ee', '#9bb88a', '#4f6b3f']],
  facial: [['#fff0f5', '#f7a8c4', '#c2547f'], ['#f0fdf4', '#86efac', '#2f8f5b'], ['#fefce8', '#f5d56b', '#b08a12']],
  body: [['#ecfdf5', '#6ee7b7', '#2a8c68'], ['#fff7ed', '#fdba74', '#c2692a'], ['#f5f3ff', '#c4b5fd', '#6d4fc2']],
  waxing: [['#fffbeb', '#fcd34d', '#b7791f'], ['#fdf2f8', '#f9a8d4', '#b83280'], ['#f0f9ff', '#7dd3fc', '#2b7aa8']],
  'hand-foot-spa': [['#eff6ff', '#93c5fd', '#3b6fb6'], ['#fdf4ff', '#e9a8f2', '#9b3fa8'], ['#f0fdfa', '#5eead4', '#1f8a7c']],
};

const W = 800, H = 600;
const frame = (bg, mid, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mid}" stop-opacity=".5"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>${inner}</svg>`;

const draw = {
  massage: (bg, mid, dark) => `
    <ellipse cx="400" cy="470" rx="260" ry="38" fill="${dark}" opacity=".12"/>
    <ellipse cx="400" cy="420" rx="170" ry="58" fill="${dark}"/><ellipse cx="392" cy="405" rx="120" ry="30" fill="#fff" opacity=".18"/>
    <ellipse cx="402" cy="340" rx="125" ry="46" fill="${mid}"/><ellipse cx="395" cy="328" rx="85" ry="22" fill="#fff" opacity=".25"/>
    <ellipse cx="400" cy="275" rx="80" ry="34" fill="${dark}" opacity=".8"/>
    <path d="M110 520q70-26 140 0t140 0 140 0 140 0" fill="none" stroke="${mid}" stroke-width="6" opacity=".6"/>`,
  facial: (bg, mid, dark) => `
    <ellipse cx="400" cy="300" rx="120" ry="150" fill="#fff" opacity=".75" stroke="${dark}" stroke-width="6"/>
    <path d="M340 270q20-18 40 0M420 270q20-18 40 0" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>
    <path d="M370 360q30 24 60 0" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>
    <path d="M150 470q60-90 120-20-30 70-120 20zM650 130q-60 90-120 20 30-70 120-20z" fill="${mid}"/>
    <circle cx="560" cy="460" r="12" fill="${mid}"/><circle cx="600" cy="430" r="8" fill="${dark}" opacity=".5"/><circle cx="210" cy="150" r="10" fill="${mid}"/>`,
  body: (bg, mid, dark) => `
    <path d="M400 110q150 120 0 340Q250 230 400 110z" fill="${mid}"/><path d="M400 130v300" stroke="${dark}" stroke-width="5" opacity=".6"/>
    <path d="M250 250q-120 60-60 190 120-30 60-190zM550 250q120 60 60 190-120-30-60-190z" fill="${dark}" opacity=".35"/>
    <path d="M90 520q80-30 160 0t160 0 160 0 160 0" fill="none" stroke="${dark}" stroke-width="6" opacity=".45"/>`,
  waxing: (bg, mid, dark) => `
    <path d="M60 220q120-90 240 0t240 0 200 0" fill="none" stroke="${mid}" stroke-width="14" stroke-linecap="round"/>
    <path d="M60 300q120-90 240 0t240 0 200 0" fill="none" stroke="${dark}" stroke-width="10" stroke-linecap="round" opacity=".6"/>
    <path d="M60 380q120-90 240 0t240 0 200 0" fill="none" stroke="${mid}" stroke-width="14" stroke-linecap="round"/>
    <path d="M400 430q60 70 0 110-60-40 0-110z" fill="${dark}"/><circle cx="385" cy="505" r="9" fill="#fff" opacity=".5"/>`,
  'hand-foot-spa': (bg, mid, dark) => `
    <path d="M190 330h420q-10 140-210 150-200-10-210-150z" fill="${dark}"/><ellipse cx="400" cy="330" rx="210" ry="48" fill="${mid}"/>
    <ellipse cx="400" cy="328" rx="180" ry="34" fill="#fff" opacity=".45"/>
    <g fill="#fff" opacity=".9"><ellipse cx="350" cy="320" rx="26" ry="12" transform="rotate(-20 350 320)"/><ellipse cx="430" cy="330" rx="26" ry="12" transform="rotate(25 430 330)"/><ellipse cx="395" cy="305" rx="22" ry="10"/></g>
    <path d="M330 250q20-40 0-70M400 240q20-40 0-80M470 250q20-40 0-70" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round" opacity=".4"/>`,
};

for (const [key, variants] of Object.entries(palettes)) {
  variants.forEach(([bg, mid, dark], i) => {
    fs.writeFileSync(path.join(out, `cat-${key}-${i + 1}.svg`), frame(bg, mid, draw[key](bg, mid, dark)));
  });
}
console.log('Generated spa placeholders');

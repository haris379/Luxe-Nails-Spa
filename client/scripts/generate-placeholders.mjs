// Generates original illustrative SVG placeholders (no third-party imagery).
// Replace the files in public/images with real salon photos when available.
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('public/images');
fs.mkdirSync(out, { recursive: true });

const palettes = {
  manicure: ['#fde4ea', '#f9a8c0', '#ffffff'],
  gel: ['#ffd6e4', '#ff5c9a', '#ff8fb8'],
  acrylic: ['#e8f0ff', '#7aa2ff', '#c9d8ff'],
  art: ['#fff0e6', '#ff8a5c', '#a855f7'],
  pedicure: ['#e6fff4', '#34d399', '#a7f3d0'],
  chrome: ['#1f2937', '#cbd5e1', '#f8fafc'],
  extensions: ['#fff7d6', '#e6b84a', '#fde68a'],
  repair: ['#f3e8ff', '#c084fc', '#e9d5ff'],
  polish: ['#ffe4e6', '#e11d48', '#fb7185'],
  hero: ['#3b1030', '#ff6eb4', '#ffd3e0'],
  about: ['#fff0f5', '#ff8fb8', '#ffffff'],
};

function art([bg, main, light], seed, w = 800, h = 600) {
  const r = (n) => { seed = (seed * 9301 + 49297) % 233280; return (seed / 233280) * n; };
  const nails = [];
  const cx = w / 2, base = h * 0.95;
  for (let i = 0; i < 5; i++) {
    const a = (-32 + i * 16 + r(4) - 2) * (Math.PI / 180);
    const len = h * (0.5 + (i === 2 ? 0.1 : i === 0 || i === 4 ? -0.08 : 0.03));
    const x = cx + Math.sin(a) * len * 0.9;
    const y = base - Math.cos(a) * len;
    const nw = w * 0.085, nh = w * 0.12;
    const deg = (a * 180) / Math.PI;
    const tone = i % 2 ? main : light;
    nails.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})">
      <rect x="${-nw * 0.62}" y="${nh * 0.55}" width="${nw * 1.24}" height="${len * 0.75}" rx="${nw * 0.6}" fill="#000" opacity=".10"/>
      <rect x="${-nw / 2}" y="${-nh / 2}" width="${nw}" height="${nh}" rx="${nw * 0.48}" fill="${tone}"/>
      <rect x="${-nw / 2 + 4}" y="${-nh / 2 + 5}" width="${nw * 0.28}" height="${nh * 0.6}" rx="6" fill="#fff" opacity=".45"/>
    </g>`);
  }
  const dots = Array.from({ length: 14 }, () =>
    `<circle cx="${r(w).toFixed(0)}" cy="${r(h * 0.6).toFixed(0)}" r="${(r(5) + 2).toFixed(1)}" fill="${light}" opacity=".35"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${main}" stop-opacity=".55"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>${dots}
  <ellipse cx="${cx}" cy="${h * 0.98}" rx="${w * 0.3}" ry="${h * 0.2}" fill="${light}" opacity=".5"/>
  ${nails.join('\n')}
</svg>`;
}

const write = (name, svg) => fs.writeFileSync(path.join(out, name), svg);

let seed = 11;
for (const key of ['manicure', 'gel', 'acrylic', 'art', 'pedicure', 'chrome', 'extensions', 'repair', 'polish']) {
  write(`service-${key}.svg`, art(palettes[key], (seed += 17)));
}
write('hero.svg', art(palettes.hero, 5, 1600, 900));
write('about.svg', art(palettes.about, 77, 900, 1000));

const galleryKeys = ['gel', 'manicure', 'art', 'polish', 'chrome', 'acrylic', 'extensions', 'repair', 'pedicure', 'art', 'gel', 'acrylic'];
galleryKeys.forEach((k, i) => write(`gallery-${String(i + 1).padStart(2, '0')}.svg`, art(palettes[k], 100 + i * 31, 600, 600)));
console.log('Generated placeholders in', out);

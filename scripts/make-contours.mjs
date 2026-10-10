// Generates public/img/contours.svg: topographic rings used as a decorative background.
import fs from 'node:fs';
const peaks = [{ x: 520, y: 150, n: 11, r0: 28, step: 34 }, { x: 140, y: 420, n: 9, r0: 22, step: 36 }, { x: 330, y: 300, n: 5, r0: 18, step: 30 }];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let out = '';
for (const p of peaks) {
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < p.n; i++) {
    const r = p.r0 + i * p.step; const pts = [];
    for (let a = 0; a <= 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      const wob = 1 + 0.12 * Math.sin(3 * t + ph[0] + i * 0.25) + 0.07 * Math.sin(5 * t + ph[1]) + 0.05 * Math.sin(2 * t + ph[2]);
      pts.push([p.x + Math.cos(t) * r * wob * 1.25, p.y + Math.sin(t) * r * wob * 0.85]);
    }
    out += `<path d="M${pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' L')}Z"/>`;
  }
}
fs.writeFileSync(new URL('../public/img/contours.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 420"><g id="c" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5">${out}</g></svg>\n`);

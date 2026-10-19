// Génère les icônes de l'application (PWA, Apple) à partir du logo vectoriel.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const mark = (size, padding) => {
  const inner = size - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0B6E4F"/>
  <g transform="translate(${padding} ${padding}) scale(${inner / 32})">
    <path d="M21.6 11.4c-.9-1.7-2.9-2.8-5.5-2.8-3.2 0-5.3 1.6-5.3 3.9 0 5.4 11 2.5 11 8 0 2.5-2.3 4.4-5.8 4.4-2.7 0-4.8-1.1-5.8-2.9" fill="none" stroke="#fff" stroke-width="3.1" stroke-linecap="round"/>
    <circle cx="24.6" cy="7.6" r="2.4" fill="#F59E0B"/>
  </g>
</svg>`;
};

const targets = [
  ["public/icon-192.png", 192, 8],
  ["public/icon-512.png", 512, 20],
  ["public/icon-maskable-512.png", 512, 110],
  ["src/app/apple-icon.png", 180, 10],
];
for (const [file, size, padding] of targets) {
  writeFileSync(file, await sharp(Buffer.from(mark(size, padding))).png().toBuffer());
  console.log("ok", file);
}

// G?n?re les ic?nes de l'application (PWA, Apple) ? partir du logo vectoriel.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const mark = (size, padding) => {
  const inner = size - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0B6E4F"/>
  <g transform="translate(${padding} ${padding}) scale(${inner / 32})">
    <path d="M16 7.5 24 11.75v8.5L16 24.5 8 20.25v-8.5Z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    <path d="M8 11.75 16 16l8-4.25M16 16v8.5" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="24.5" cy="7.5" r="3.25" fill="#F59E0B" stroke="#0B6E4F" stroke-width="1.5"/>
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

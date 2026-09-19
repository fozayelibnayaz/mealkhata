import fs from 'node:fs';
import crypto from 'node:crypto';
const assets=fs.readdirSync('dist/assets').map(f=>'/assets/'+f);
const fonts=fs.readdirSync('dist/fonts').filter(f=>/\.(ttf|woff2?)$/.test(f)).map(f=>'/fonts/'+f);
const files=[...assets,...fonts];
const version=crypto.createHash('sha256').update(files.join('|')).digest('hex').slice(0,12);
const source=fs.readFileSync('public/sw.js','utf8').replace("const CACHE='mealkhata-shell-v3';",`const CACHE='mealkhata-shell-${version}';`).replace('const PRECACHE=[];',`const PRECACHE=${JSON.stringify(files)};`);
fs.writeFileSync('dist/sw.js',source);
console.log('Generated public-only service-worker manifest:',files.length,'assets.');

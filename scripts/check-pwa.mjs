import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
try {
 await page.goto('http://127.0.0.1:4173/workspace');await page.getByLabel('Your sandbox name').fill('PWA tester');await page.getByRole('button',{name:'Create isolated sandbox account'}).click();await page.getByRole('button',{name:'Create your first mess'}).click();await page.getByLabel('Mess name',{exact:true}).fill('PWA Kitchen');await page.getByRole('button',{name:'Create mess',exact:true}).click();
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('checkbox',{name:'Remember the last khata'}).check();
 await expect.poll(()=>page.evaluate(async()=>new Promise(resolve=>{const r=indexedDB.open('mealkhata-device-cache');r.onsuccess=()=>{const q=r.result.transaction('snapshots').objectStore('snapshots').get('last');q.onsuccess=()=>{resolve(!!q.result);r.result.close();};};}))).toBe(true);
 const privateCached=await page.evaluate(async()=>{const keys=await caches.keys();for(const key of keys){const requests=await(await caches.open(key)).keys();if(requests.some(r=>new URL(r.url).pathname.startsWith('/api/')))return true;}return false;});expect(privateCached).toBe(false);
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'View saved khata read-only'}).click();await expect(page.getByText('Saved device copy — not live.')).toBeVisible();await expect(page.locator('h1')).toContainText('Good to see you');
 await context.setOffline(false);await page.getByRole('button',{name:'Reconnect',exact:true}).click();await expect(page.getByText('Saved device copy — not live.')).toHaveCount(0);
 fs.writeFileSync('docs/pwa-test-results.txt','PASS: production service worker ready; private API responses absent from shell cache; offline reload served app shell; opt-in IndexedDB copy opened read-only; reconnect restored live session.\n');console.log('PASS: production PWA offline reload, private-cache exclusion, saved read-only view and reconnect.');
}finally{await browser.close();}

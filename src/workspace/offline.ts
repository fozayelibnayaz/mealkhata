// Explicitly opt-in device storage; not a shared backup and not an authentication source.
const DB = "mealkhata-device-cache";
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("snapshots");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function storeSnapshot(value: unknown) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").put({ savedAt: Date.now(), value }, "last");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function readSnapshot() {
  const db = await open();
  const r = await new Promise<any>((resolve, reject) => {
    const req = db
      .transaction("snapshots")
      .objectStore("snapshots")
      .get("last");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return r && Date.now() - r.savedAt < 7 * 86400000 ? r : null;
}
export async function clearSnapshot() {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  localStorage.removeItem("mk-cache-opt-in");
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith("mk-meal-draft:")) sessionStorage.removeItem(key);
}

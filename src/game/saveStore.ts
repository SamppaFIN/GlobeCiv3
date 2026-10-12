/**
 * saveStore.ts — the saved game in the browser's IndexedDB (STORY-036): one slot, "auto".
 * Every call fails softly (a private window, blocked storage): the game goes on unsaved.
 * What comes back is unchecked; validateSave() in save.ts checks it before any use.
 */
const DB = 'globeciv3';
const STORE = 'saves';
const KEY = 'auto';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The stored save as it is, or null. */
export async function loadSave(): Promise<unknown> {
  try {
    return (await run('readonly', s => s.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

/** Store the save; false when the browser does not let it. */
export async function storeSave(data: object): Promise<boolean> {
  try {
    await run('readwrite', s => s.put(data, KEY));
    return true;
  } catch {
    return false;
  }
}

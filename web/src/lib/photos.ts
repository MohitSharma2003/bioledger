/**
 * Browser-side photo cache.
 *
 * When the server cannot be reached, the browser runtime still keeps the
 * observation (in the outbox) and the photo here, so the field note is not
 * lost. The server's own filesystem stays the source of truth whenever it is
 * available; this is only a fallback for the offline path.
 */

const DB_NAME = "bioledger-photos";
const STORE = "photos";
const VERSION = 1;

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function putPhoto(id: number, blob: Blob): Promise<void> {
  if (!hasIDB()) return;
  await run("readwrite", (store) => store.put(blob, id));
}

export async function hasPhoto(id: number): Promise<boolean> {
  if (!hasIDB()) return false;
  try {
    const key = await run<IDBValidKey | undefined>("readonly", (store) => store.getKey(id));
    return key !== undefined;
  } catch {
    return false;
  }
}

/** A local object URL for a cached photo, or null. Caller revokes it. */
export async function getPhotoURL(id: number): Promise<string | null> {
  if (!hasIDB()) return null;
  try {
    const blob = await run<Blob | undefined>("readonly", (store) => store.get(id));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export async function removePhoto(id: number): Promise<void> {
  if (!hasIDB()) return;
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    /* nothing cached to clear */
  }
}

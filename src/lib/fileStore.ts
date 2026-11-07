/** IndexedDB storage for teacher PDF attachments (homework, lesson plans). */

const DB_NAME = "classbridge-files-v1";
const STORE = "blobs";
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export type StoredFileMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
};

type StoredRecord = StoredFileMeta & { blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open file database"));
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error("File store request failed"));
      }),
  );
}

export function assertPdfFile(file: File): void {
  const okMime = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!okMime) throw new Error("Only PDF files are allowed.");
  if (file.size <= 0) throw new Error("File is empty.");
  if (file.size > MAX_BYTES) throw new Error("PDF must be 12 MB or smaller.");
}

export async function savePdfFile(file: File): Promise<StoredFileMeta> {
  if (typeof indexedDB === "undefined") throw new Error("File storage is not available in this browser.");
  assertPdfFile(file);
  const meta: StoredFileMeta = {
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type || "application/pdf",
    size: file.size,
    createdAt: new Date().toISOString(),
  };
  const record: StoredRecord = { ...meta, blob: file };
  await withStore("readwrite", (store) => store.put(record));
  return meta;
}

export async function getPdfRecord(id: string): Promise<StoredRecord | null> {
  if (!id || typeof indexedDB === "undefined") return null;
  const row = await withStore<StoredRecord | undefined>("readonly", (store) => store.get(id));
  return row ?? null;
}

/** Create an object URL for viewing/downloading. Caller should revoke when done if short-lived. */
export async function getPdfObjectUrl(id: string): Promise<string | null> {
  const row = await getPdfRecord(id);
  if (!row) return null;
  return URL.createObjectURL(row.blob);
}

export async function deletePdfFile(id: string): Promise<void> {
  if (!id || typeof indexedDB === "undefined") return;
  await withStore("readwrite", (store) => store.delete(id));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

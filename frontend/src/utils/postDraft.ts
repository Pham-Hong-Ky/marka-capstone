const DB_NAME = 'marka-drafts';
const DB_VERSION = 1;
const STORE = 'pending-files';
const META_PREFIX = 'marka:post-draft:';

export interface PostDraft {
  title: string;
  content: unknown;
  savedAt: number;
}

export const draftKey = (workspaceId: string, postId: string | null): string =>
  `${workspaceId}:${postId ?? 'new'}`;

export const saveDraft = (key: string, draft: PostDraft): void => {
  try {
    localStorage.setItem(META_PREFIX + key, JSON.stringify(draft));
  } catch (error) {
    console.warn('Không lưu được bản nháp tạm vào localStorage:', error);
  }
};

export const loadDraft = (key: string): PostDraft | null => {
  try {
    const raw = localStorage.getItem(META_PREFIX + key);
    return raw ? (JSON.parse(raw) as PostDraft) : null;
  } catch (error) {
    console.warn('Không đọc được bản nháp tạm:', error);
    return null;
  }
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runFileStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest
): Promise<T> => {
  const db = await openDb();

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

export const savePendingFiles = async (key: string, files: File[]): Promise<void> => {
  try {
    await runFileStore('readwrite', (store) => store.put(files, key));
  } catch (error) {
    console.warn('Không lưu được ảnh chờ vào IndexedDB:', error);
  }
};

export const loadPendingFiles = async (key: string): Promise<File[]> => {
  try {
    return (await runFileStore<File[] | undefined>('readonly', (store) => store.get(key))) ?? [];
  } catch (error) {
    console.warn('Không đọc được ảnh chờ:', error);
    return [];
  }
};

export const clearDraft = async (key: string): Promise<void> => {
  try {
    localStorage.removeItem(META_PREFIX + key);
  } catch (error) {
    console.warn('Không xoá được bản nháp tạm:', error);
  }

  try {
    await runFileStore('readwrite', (store) => store.delete(key));
  } catch (error) {
    console.warn('Không xoá được ảnh chờ:', error);
  }
};

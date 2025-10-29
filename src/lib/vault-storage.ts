import { VaultData } from './types';

// Storage adapter using IndexedDB for local storage
export class VaultStorage {
  private dbName = 'passkodeVault';
  private storeName = 'vaults';

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore(this.storeName, { keyPath: 'email' });
      };
    });
  }

  async saveVault(email: string, vaultData: Omit<VaultData, 'email'>) {
    const db = await this.init();
    return new Promise<void>((resolve, reject) => {
      const transaction = (db as IDBDatabase).transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.put({ email, ...vaultData });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getVault(email: string): Promise<VaultData | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = (db as IDBDatabase).transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.get(email);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}
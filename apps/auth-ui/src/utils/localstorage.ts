/**
 * LocalStorage utility functions with error handling
 */

export class LocalStorageUtil {
  /**
   * Check if localStorage is available
   */
  private static isAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get item from localStorage
   */
  static get<T = any>(key: string, defaultValue?: T): T | null {
    if (!this.isAvailable()) {
      console.warn('localStorage is not available');
      return defaultValue || null;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return defaultValue || null;
      }
      
      // Try to parse as JSON, otherwise return as string
      try {
        return JSON.parse(item) as T;
      } catch {
        return item as unknown as T;
      }
    } catch (error) {
      console.error(`Error getting item from localStorage: ${key}`, error);
      return defaultValue || null;
    }
  }

  /**
   * Set item in localStorage
   */
  static set(key: string, value: any): boolean {
    if (!this.isAvailable()) {
      console.warn('localStorage is not available');
      return false;
    }

    try {
      const serializedValue = typeof value === 'string' 
        ? value 
        : JSON.stringify(value);
      
      window.localStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error(`Error setting item in localStorage: ${key}`, error);
      return false;
    }
  }

  /**
   * Remove item from localStorage
   */
  static remove(key: string): boolean {
    if (!this.isAvailable()) {
      console.warn('localStorage is not available');
      return false;
    }

    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing item from localStorage: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all items from localStorage
   */
  static clear(): boolean {
    if (!this.isAvailable()) {
      console.warn('localStorage is not available');
      return false;
    }

    try {
      window.localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage', error);
      return false;
    }
  }

  /**
   * Get all keys from localStorage
   */
  static keys(): string[] {
    if (!this.isAvailable()) {
      console.warn('localStorage is not available');
      return [];
    }

    try {
      return Object.keys(window.localStorage);
    } catch (error) {
      console.error('Error getting keys from localStorage', error);
      return [];
    }
  }

  /**
   * Check if a key exists in localStorage
   */
  static has(key: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      return window.localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }
}

// Export convenience functions
export const storage = {
  get: LocalStorageUtil.get.bind(LocalStorageUtil),
  set: LocalStorageUtil.set.bind(LocalStorageUtil),
  remove: LocalStorageUtil.remove.bind(LocalStorageUtil),
  clear: LocalStorageUtil.clear.bind(LocalStorageUtil),
  keys: LocalStorageUtil.keys.bind(LocalStorageUtil),
  has: LocalStorageUtil.has.bind(LocalStorageUtil),
};

// Export as localStorageUtils for compatibility
export const localStorageUtils = storage;
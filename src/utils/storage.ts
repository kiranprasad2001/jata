import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Save a value to AsyncStorage.
 * @param key The storage key
 * @param value The value to store (string, number, boolean, or object)
 */
export const saveToStorage = async (key: string, value: string | number | boolean | object) => {
    try {
        if (typeof value === 'object') {
            await AsyncStorage.setItem(key, JSON.stringify(value));
        } else {
            await AsyncStorage.setItem(key, String(value));
        }
    } catch (e) {
        console.error(`Error saving to storage for key ${key}`, e);
    }
};

/**
 * Retrieve a string from AsyncStorage.
 * @param key The storage key
 * @returns The string value or undefined
 */
export const getString = async (key: string): Promise<string | undefined> => {
    try {
        const value = await AsyncStorage.getItem(key);
        return value !== null ? value : undefined;
    } catch (e) {
        console.error(`Error getting string for key ${key}`, e);
        return undefined;
    }
};

/**
 * Retrieve a number from AsyncStorage.
 * @param key The storage key
 * @returns The number value or undefined
 */
export const getNumber = async (key: string): Promise<number | undefined> => {
    try {
        const value = await AsyncStorage.getItem(key);
        return value !== null ? Number(value) : undefined;
    } catch (e) {
        console.error(`Error getting number for key ${key}`, e);
        return undefined;
    }
};

/**
 * Retrieve a boolean from AsyncStorage.
 * @param key The storage key
 * @returns The boolean value or undefined
 */
export const getBoolean = async (key: string): Promise<boolean | undefined> => {
    try {
        const value = await AsyncStorage.getItem(key);
        return value !== null ? value === 'true' : undefined;
    } catch (e) {
        console.error(`Error getting boolean for key ${key}`, e);
        return undefined;
    }
};

/**
 * Retrieve and parse a JSON object from AsyncStorage.
 * @param key The storage key
 * @returns The parsed object or undefined
 */
export const getObject = async <T,>(key: string): Promise<T | undefined> => {
    try {
        const jsonString = await AsyncStorage.getItem(key);
        if (jsonString) {
            return JSON.parse(jsonString) as T;
        }
    } catch (e) {
        console.error(`Error parsing JSON for key ${key}`, e);
    }
    return undefined;
};

/**
 * Delete a value from AsyncStorage.
 * @param key The storage key
 */
export const deleteFromStorage = async (key: string) => {
    try {
        await AsyncStorage.removeItem(key);
    } catch (e) {
        console.error(`Error deleting storage for key ${key}`, e);
    }
};

/**
 * Clear all values from AsyncStorage.
 */
export const clearStorage = async () => {
    try {
        await AsyncStorage.clear();
    } catch (e) {
        console.error(`Error clearing storage`, e);
    }
};

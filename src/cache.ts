import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const CACHE_GENERAL = 'magic_sf_api_cache';
const CACHE_LOG_ANALYSIS = 'magic_sf_api_cache_log_analysis';

function getCachePath(cacheType: string) {
    if (!vscode.workspace.workspaceFolders) {
        return '';
    }
    return path.normalize(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.sf', `${cacheType}.json`));
}

function loadCache(cacheType: string) {
    if (fs.existsSync(getCachePath(cacheType))) {
        return JSON.parse(fs.readFileSync(getCachePath(cacheType), 'utf8'));
    }
    return {};
}

function saveCache(cache: any, cacheType: string) {
    fs.writeFileSync(getCachePath(cacheType), JSON.stringify(cache, null, 2), 'utf8');
}

function isCacheValid(cacheKey: string, cache: { [x: string]: { lastFetched: number; }; }) {
    const cacheDuration = vscode.workspace.getConfiguration('magicSF').get('cacheDuration', 1000 * 60 * 60 * 24); // Default 24 hours
    if (cache[cacheKey] && (new Date().getTime() - cache[cacheKey].lastFetched < cacheDuration)) {
        return true;
    }
    return false;
}

/**
 * Decorator to cache the result of a method
 * @param keyPart A string that will be used to generate the cache key
 * @returns A decorator function that will cache the result of the method
 * @example
 * ```typescript
 * class MyClass {
 *   @useCache('myMethod')
 *   async myMethod() {
 *    return 'Hello World';
 *   }
 * }
 * ```
 */
export function useCache(keyPart: string) {
    return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const cacheKey = `${keyPart}-${args.join('-')}`;
            const cache = loadCache(CACHE_GENERAL);

            if (cache[cacheKey] && isCacheValid(cacheKey, cache)) {
                return cache[cacheKey].data;
            }

            const result = await originalMethod.apply(this, args);
            cache[cacheKey] = {
                lastFetched: new Date().getTime(),
                data: result
            };

            saveCache(cache, CACHE_GENERAL);
            return result;
        };

        return descriptor;
    };
}

export function clearCache() {
    if (fs.existsSync(getCachePath(CACHE_GENERAL))) {
        fs.unlinkSync(getCachePath(CACHE_GENERAL));
    }

    if (fs.existsSync(getCachePath(CACHE_LOG_ANALYSIS))) {
        fs.unlinkSync(getCachePath(CACHE_LOG_ANALYSIS));
    }
}

export function useCacheLog(keyPart: string) {
    return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const cacheKey = `${keyPart}-${args[0]}`;
            const cache = loadCache(CACHE_LOG_ANALYSIS);

            if (cache && cache !== '' && cache[cacheKey] && cache[cacheKey]['data'] !== null && isCacheValid(cacheKey, cache)) {
                return cache[cacheKey].data;
            }

            const result = originalMethod.apply(this, args);
            cache[cacheKey] = {
                lastFetched: new Date().getTime(),
                data: result
            };

            saveCache(cache, CACHE_LOG_ANALYSIS);
            return result;
        };

        return descriptor;
    };
}

import axios from 'axios';
import appConfig from '@/config';
import { RequestCache } from './request-cache';
import CryptoJS from 'crypto-js';
import stringify from 'json-stable-stringify';
import { appEndpoints } from './api-endpoints';
import { localStorageUtils } from '@/utils/localstorage';

// Types
export interface DataOptions {
  lastItem?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  sortType?: 'asc' | 'desc';
  enrich?: boolean;
  refresh?: boolean;
}

export interface AuthSession {
  refreshToken: string;
  token: string;
  orgId: string;
  user: any;
}

// Simple active session implementation for auth
export const activeSession = (): AuthSession => (localStorageUtils.get('session') || {}) as AuthSession;

export class ResponseError extends Error {
  public response: Response;
  constructor(response: Response) {
    super(response.statusText);
    this.response = response;
  }
}

export const getResourcePath = (resource: string) => {
  if (!Object.keys(appEndpoints).includes(resource)) {
    throw new Error('Invalid api resource path: ' + resource);
  }
  return `${appConfig.appengine.host}/${appEndpoints[resource as keyof typeof appEndpoints]?.path}`;
};

export const getHeaders = () => {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: activeSession().token ? `Bearer ${activeSession().token}` : '',
      orgid: activeSession().orgId || '',
    },
  };
};

// Helper functions
const isRetryableError = (error: any): boolean => {
  if (!error.response) return true;
  if (error.response.status >= 500 && error.response.status < 600) return true;
  if (error.code === 'ECONNABORTED') return true;
  return false;
};

const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const getObjectHash = (query: any) => {
  const serializedQuery = stringify(query) || '';
  const hash = CryptoJS.SHA256(serializedQuery).toString();
  return hash;
};

// Map to track in-flight requests
const inFlightRequests = new Map<string, Promise<any>>();

const getRequestKey = (method: string, path: string, data?: any): string => {
  return `${method}:${path}:${data ? getObjectHash(data) : ''}`;
};

let refreshingToken = false;
let authRefreshRetries = 0;

export const callServer = async (
  method: string,
  fullPath: string,
  data?: any,
  cache?: 'none' | 'short' | 'long' | 'forever' | number,
  maxRetries = 3
): Promise<any> => {
  let header = getHeaders();
  let retries = 0;

  // Create a unique key for this request
  const requestKey = getRequestKey(method, fullPath, data);

  // Check if there's already an identical request in flight
  if (inFlightRequests.has(requestKey)) {
    try {
      return await inFlightRequests.get(requestKey);
    } catch (error) {
      // If the original request failed, we'll try again
    }
  }

  if (refreshingToken) {
    await wait(2000);
    return callServer(method, fullPath, data, cache, maxRetries);
  }

  const executeRequest = async (): Promise<any> => {
    try {
      header = getHeaders();
      method = method.toLowerCase();
      
      const requestCacheService = RequestCache.getInstance();
      
      if (method === 'post') {
        if (cache && cache !== 'none') {
          const queryHash = getObjectHash({ method, path: fullPath, ...data });
          const cachedResult = requestCacheService.get(queryHash);
          if (cachedResult) {
            cachedResult.cached = true;
            return cachedResult;
          }
        }
        
        const result = await axios.post(fullPath, data, header);
        
        if (cache && cache !== 'none' && result.data) {
          const queryHash = getObjectHash({ method, path: fullPath, ...data });
          const cacheTtl = typeof cache === 'number' ? cache : appConfig.cache.defaultTTL;
          requestCacheService.set(queryHash, result, cacheTtl);
        }
        
        return result;
      } else if (method === 'get') {
        if (cache !== 'none') {
          const cachedResult = requestCacheService.get(fullPath);
          if (cachedResult) {
            cachedResult.cached = true;
            return cachedResult;
          }
        }
        
        const result = await axios.get(fullPath, header);
        const cacheTtl = cache === 'none' || !cache ? appConfig.cache.defaultTTL : 
          typeof cache === 'number' ? cache : appConfig.cache.defaultTTL;
        requestCacheService.set(fullPath, result, cacheTtl);
        return result;
      } else if (method === 'put') {
        return await axios.put(fullPath, data, header);
      } else if (method === 'delete' || method === 'del') {
        return await axios.delete(fullPath, header);
      } else {
        throw new Error(`Invalid method: ${method}`);
      }
    } catch (error: any) {
      // Handle 401 errors with token refresh
      if (error.response?.status === 401 && !refreshingToken && authRefreshRetries < 2 && activeSession().refreshToken) {
        authRefreshRetries++;
        refreshingToken = true;

        try {
          const headers = {
            headers: {
              'Content-Type': 'application/json',
              orgid: activeSession().orgId || '',
            },
          };

          const path = getResourcePath('refresh_token');
          const tResponse: any = await axios.post(
            path, 
            { refresh_token: activeSession().refreshToken }, 
            headers
          );

          if (tResponse && tResponse.data) {
            const session = activeSession();
            session.token = tResponse.data.token;
            session.user = tResponse.data.user;
            localStorageUtils.set('session', session);
            retries++;
            return executeRequest();
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        } finally {
          refreshingToken = false;
        }
      }

      if (error.response?.status === 401) {
        performLogout();
        throw error;
      }

      // Retry logic for retryable errors
      if (isRetryableError(error) && retries < maxRetries) {
        retries++;
        const delay = Math.min(1000 * Math.pow(2, retries), 10000);
        await wait(delay);
        return executeRequest();
      }

      throw error;
    }
  };

  // Create the promise for this request
  const requestPromise = executeRequest();

  // Store the promise in the map
  inFlightRequests.set(requestKey, requestPromise);

  try {
    const result = await requestPromise;
    authRefreshRetries = 0;
    return result;
  } finally {
    inFlightRequests.delete(requestKey);
    refreshingToken = false;
  }
};

export const getResponseErrorMessage = (e: any) => {
  if (!e) return '';
  if (e.constructor.name !== 'AxiosError') return e.message;
  let errMsg = e.response?.data?.message || e.response?.data?.error || '';
  let errPath = e.response?.data?.path || '';
  let message = `${errMsg} ${errPath} ${e.message}`.trim();
  if (message.indexOf('/') > 1) {
    message = message.split('/')[0];
  }
  return message;
};

// Basic data operations for auth
export async function getData(datatype: string, uid: string, cache?: 'none' | 'short' | 'long' | 'forever' | number) {
  const apiName = appEndpoints.get.name;
  const path = `${getResourcePath(apiName)}/${datatype}/${uid}`;
  const rt = await callServer('get', path, null, cache);
  return rt?.data;
}

export async function insertData<T>(data: T) {
  const apiName = appEndpoints.create.name;
  const rt = await callServer('put', getResourcePath(apiName), data);
  return rt?.data;
}

export async function updateData<T>(data: T & { sk: string }) {
  const apiName = appEndpoints.update.name;
  const path = `${getResourcePath(apiName)}/${data.sk}`;
  const rt = await callServer('post', path, data);
  return rt?.data;
}

export async function processDataRequest(
  apiName: string, 
  data?: any, 
  urlPath?: string, 
  cache?: 'none' | 'short' | 'long' | 'forever' | number
) {
  const path = getResourcePath(apiName);
  const method = appEndpoints[apiName as keyof typeof appEndpoints].method;
  let fullPath = urlPath ? `${path}/${urlPath}` : `${path}`;
  let rt = await callServer(method, fullPath, data, cache);
  return rt?.data;
}

export const performLogout = async () => {
      // Set logout flag to prevent auto-login
      localStorageUtils.set('logout_in_progress', 'true');
      
      // Clear all localStorage completely
      localStorageUtils.clear();
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear cookies with same attributes as when they were set
      const cookieOptions = '; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      const cookiesToClear = ['authToken', 'email', 'orgid', 'orgId', 'username', 'token'];
      
      cookiesToClear.forEach(cookieName => {
        // Clear for current domain
        document.cookie = cookieName + '=' + cookieOptions;
        // Clear for hostname domain
        document.cookie = cookieName + '=' + cookieOptions + '; domain=' + window.location.hostname;
        // Clear for parent domain (if subdomain)
        const parts = window.location.hostname.split('.');
        if (parts.length > 2) {
          const parentDomain = '.' + parts.slice(-2).join('.');
          document.cookie = cookieName + '=' + cookieOptions + '; domain=' + parentDomain;
        }
      });
      
      // Small delay to ensure all clearing operations complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clear URL parameters that might trigger auto-login
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
      localStorage.removeItem('logout_in_progress');
    };
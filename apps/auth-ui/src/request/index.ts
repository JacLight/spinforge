import appConfig from '@/config';
import * as appEngineRequest from './appengine';

const { getResourcePath } = appEngineRequest;
const restAPI = appConfig.useAppEngine ? appEngineRequest : appEngineRequest;

const requestWithMonitor = async (apiToCall: Function) => {
  let isLoading = true;
  let error: string | null = null;
  
  const apiWithMonitor = async (...params: any[]) => {
    try {
      const response = await apiToCall(...params);
      return response;
    } catch (e: any) {
      console.error('error', e);
      error = appEngineRequest.getResponseErrorMessage(e);
      return e;
    } finally {
      isLoading = false;
    }
  };
  
  return { isLoading, error, apiWithMonitor };
};

export { restAPI, requestWithMonitor, getResourcePath };
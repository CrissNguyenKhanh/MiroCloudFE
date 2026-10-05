import { apiConfig, assertRealApiConfig } from './config'
import { httpApi } from './http'
import { mockApi, resetMockApi } from './mock/mockAdapter'

export const isMockMode = apiConfig.useMock

if (!isMockMode) assertRealApiConfig()

export const api = isMockMode ? mockApi : httpApi

export function resetMockDemo() {
  return resetMockApi()
}

export { ApiError, getErrorMessage } from './errors'

/**
 * Unified API response type.
 */
export interface ApiResponse<T = unknown> {
  status: string
  data?: T
  message?: string
}

/**
 * Unified error response type.
 */
export interface ApiErrorResponse {
  status: 'error'
  code: string
  message: string
}

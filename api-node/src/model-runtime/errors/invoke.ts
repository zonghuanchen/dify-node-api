/**
 * Invoke error hierarchy for model runtime.
 * Mirrors Python graphon.model_runtime.errors.invoke.
 */

/** Base class for all LLM invocation errors. */
export class InvokeError extends Error {
  description: string

  constructor(description?: string) {
    super(description)
    this.name = 'InvokeError'
    this.description = description ?? ''
  }
}

/** Connection error during model invocation. */
export class InvokeConnectionError extends InvokeError {
  constructor(description?: string) {
    super(description ?? 'Connection Error')
    this.name = 'InvokeConnectionError'
  }
}

/** Server unavailable during model invocation. */
export class InvokeServerUnavailableError extends InvokeError {
  constructor(description?: string) {
    super(description ?? 'Server Unavailable Error')
    this.name = 'InvokeServerUnavailableError'
  }
}

/** Rate limit exceeded during model invocation. */
export class InvokeRateLimitError extends InvokeError {
  constructor(description?: string) {
    super(description ?? 'Rate Limit Error')
    this.name = 'InvokeRateLimitError'
  }
}

/** Incorrect credentials during model invocation. */
export class InvokeAuthorizationError extends InvokeError {
  constructor(description?: string) {
    super(description ?? 'Incorrect model credentials provided, please check and try again.')
    this.name = 'InvokeAuthorizationError'
  }
}

/** Bad request during model invocation. */
export class InvokeBadRequestError extends InvokeError {
  constructor(description?: string) {
    super(description ?? 'Bad Request Error')
    this.name = 'InvokeBadRequestError'
  }
}

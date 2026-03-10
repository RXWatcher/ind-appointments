// Retry utilities with exponential backoff and jitter

import { NOTIFICATIONS } from './constants';

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number;
  /** Whether to add jitter to prevent thundering herd */
  jitter?: boolean;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called before each retry */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Default function to determine if an error is retryable
 */
function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors are typically retryable
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed')
    ) {
      return true;
    }
  }

  // HTTP response errors
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    // 5xx errors and 429 (rate limit) are retryable
    return status >= 500 || status === 429;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at maximum delay
  delay = Math.min(delay, maxDelayMs);

  // Add jitter (0.5 to 1.5 multiplier) to prevent thundering herd
  if (jitter) {
    delay = delay * (0.5 + Math.random());
  }

  return Math.round(delay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = NOTIFICATIONS.MAX_RETRY_ATTEMPTS,
    initialDelayMs = NOTIFICATIONS.INITIAL_RETRY_DELAY_MS,
    maxDelayMs = NOTIFICATIONS.MAX_RETRY_DELAY_MS,
    backoffMultiplier = 2,
    jitter = true,
    isRetryable = defaultIsRetryable,
    onRetry,
  } = options;

  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    attempts = attempt + 1;

    try {
      const result = await fn();
      return { success: true, data: result, attempts };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's the last attempt or error is not retryable, don't retry
      if (attempt === maxAttempts - 1 || !isRetryable(error)) {
        break;
      }

      // Calculate delay for next attempt
      const delayMs = calculateDelay(
        attempt,
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
        jitter
      );

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  return { success: false, error: lastError, attempts };
}

/**
 * Retry wrapper specifically for HTTP fetch requests
 *
 * IMPORTANT: The request body must be a string, ArrayBuffer, or Blob - NOT a ReadableStream.
 * Streams are consumed on first read and cannot be re-sent on retry.
 * For JSON payloads, always use JSON.stringify() which creates a string body.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  // Validate that body is retryable (not a stream that gets consumed)
  if (options.body !== undefined && options.body !== null) {
    const body = options.body;
    const isRetryableBody =
      typeof body === 'string' ||
      body instanceof ArrayBuffer ||
      body instanceof Blob ||
      body instanceof URLSearchParams ||
      body instanceof FormData;

    if (!isRetryableBody) {
      // ReadableStream or other non-retryable body type
      throw new Error(
        'fetchWithRetry: Request body must be a string, ArrayBuffer, Blob, URLSearchParams, or FormData. ' +
        'ReadableStream bodies cannot be retried because they are consumed on first read.'
      );
    }
  }

  const result = await withRetry(
    async () => {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(30000),
      });

      // Throw for non-ok responses so they can be evaluated for retry
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & {
          status: number;
          response: Response;
        };
        error.status = response.status;
        error.response = response;
        throw error;
      }

      return response;
    },
    {
      ...retryOptions,
      isRetryable: (error) => {
        // Check for HTTP status-based retry
        if (typeof error === 'object' && error !== null && 'status' in error) {
          const status = (error as { status: number }).status;
          // Retry on 5xx and 429 (rate limit)
          return status >= 500 || status === 429;
        }
        // Fall back to default retry logic for network errors
        return defaultIsRetryable(error);
      },
    }
  );

  if (!result.success || !result.data) {
    throw result.error || new Error('Request failed after retries');
  }

  return result.data;
}

/**
 * Create a circuit breaker wrapper
 * Opens circuit after consecutive failures, allows test requests after cooldown
 */
export function createCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: {
    failureThreshold?: number;
    cooldownMs?: number;
    onStateChange?: (state: 'closed' | 'open' | 'half-open') => void;
  } = {}
) {
  const { failureThreshold = 5, cooldownMs = 60000, onStateChange } = options;

  let failures = 0;
  let state: 'closed' | 'open' | 'half-open' = 'closed';
  let lastFailureTime = 0;

  return async (): Promise<T> => {
    const now = Date.now();

    // If circuit is open, check if we should try again
    if (state === 'open') {
      if (now - lastFailureTime >= cooldownMs) {
        state = 'half-open';
        onStateChange?.('half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();

      // Success - reset failures and close circuit
      if (state === 'half-open') {
        state = 'closed';
        onStateChange?.('closed');
      }
      failures = 0;

      return result;
    } catch (error) {
      failures++;
      lastFailureTime = now;

      // Open circuit if threshold exceeded
      if (failures >= failureThreshold && state === 'closed') {
        state = 'open';
        onStateChange?.('open');
      }

      throw error;
    }
  };
}

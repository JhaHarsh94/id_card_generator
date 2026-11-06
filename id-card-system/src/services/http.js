export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Bound both the connection and response body; never accept an HTML SPA fallback as data. */
export async function requestJson(url, { method = 'GET', body, timeout = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method, credentials: 'same-origin', signal: controller.signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let payload;
    try {
      payload = await res.json();
    } catch {
      if (controller.signal.aborted) throw new ApiError('TIMEOUT', 'The server took too long to respond. Please try again.');
      throw new ApiError('INVALID_RESPONSE', 'The server returned an invalid response. Please try again.', res.status);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ApiError('INVALID_RESPONSE', 'The server returned an invalid response. Please try again.', res.status);
    }
    if (!res.ok) {
      if (res.status === 401 && payload.code === 'UNAUTHENTICATED' && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('idcms:auth-expired'));
      }
      throw new ApiError(payload.code || `HTTP_${res.status}`, payload.message || 'Something went wrong. Please try again.', res.status);
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('TIMEOUT', 'The server took too long to respond. Please try again.');
    throw new ApiError('NETWORK', 'Cannot reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}

export const DEFAULT_ERROR_MESSAGE = 'There was a problem connecting to the server';

const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|network request failed|connection refused|network changed|cancelled/i;

export function getErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (error instanceof Error) {
    const message = error.message || fallback;
    return NETWORK_ERROR_PATTERN.test(message) ? fallback : message;
  }

  if (typeof error === 'string') {
    return error || fallback;
  }

  return fallback;
}

export async function extractResponseErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await res.json().catch(() => null);
    if (body && typeof body === 'object') {
      return (
        body.message ||
        body.title ||
        body.detail ||
        Object.values(body.errors || {}).flat().join(', ') ||
        DEFAULT_ERROR_MESSAGE
      );
    }
    if (typeof body === 'string') {
      return body || DEFAULT_ERROR_MESSAGE;
    }
  }

  const text = await res.text().catch(() => '');
  return text || DEFAULT_ERROR_MESSAGE;
}

export async function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(DEFAULT_ERROR_MESSAGE);
  }
}

import { getToken, logout } from '@/api/auth'

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { detail?: string; message?: string }
    if (typeof body.detail === 'string') return body.detail
    if (typeof body.message === 'string') return body.message
  } catch {
    // Response body is not JSON.
  }

  return response.statusText || 'Request failed'
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const token = getToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(input, {
    ...init,
    headers,
  })

  if (response.status === 401) {
    logout()
    window.dispatchEvent(new CustomEvent('auth:logout'))
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return response
}

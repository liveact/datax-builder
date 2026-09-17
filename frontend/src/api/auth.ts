import type { TokenResponse } from '@/types/auth'

const TOKEN_KEY = 'access_token'
const USERNAME_KEY = 'username'

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    let message = response.statusText || 'Login failed'

    try {
      const body = (await response.json()) as { detail?: string; message?: string }
      if (typeof body.detail === 'string') message = body.detail
      else if (typeof body.message === 'string') message = body.message
    } catch {
      // Response body is not JSON.
    }

    throw new Error(message)
  }

  const data = (await response.json()) as TokenResponse
  localStorage.setItem(TOKEN_KEY, data.access_token)

  const base64 = data.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const payload = JSON.parse(atob(base64)) as { sub?: string }
  if (payload.sub) {
    localStorage.setItem(USERNAME_KEY, payload.sub)
  }
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}

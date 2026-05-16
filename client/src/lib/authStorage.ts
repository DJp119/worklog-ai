export interface StoredTokens {
  accessToken: string | null
  refreshToken: string | null
}

function browserLocalStorage(): Storage {
  return window.localStorage
}

function browserSessionStorage(): Storage {
  return window.sessionStorage
}

export function getStoredTokens(
  local: Storage = browserLocalStorage(),
  session: Storage = browserSessionStorage()
): StoredTokens {
  return {
    accessToken: local.getItem('accessToken') || session.getItem('accessToken'),
    refreshToken: local.getItem('refreshToken') || session.getItem('refreshToken'),
  }
}

export function storeStoredTokens(
  tokens: { accessToken: string; refreshToken: string },
  local: Storage = browserLocalStorage(),
  session: Storage = browserSessionStorage()
) {
  const storage = local.getItem('refreshToken') ? local : session
  storage.setItem('accessToken', tokens.accessToken)
  storage.setItem('refreshToken', tokens.refreshToken)
}

export function clearStoredTokens(
  local: Storage = browserLocalStorage(),
  session: Storage = browserSessionStorage()
) {
  local.removeItem('accessToken')
  local.removeItem('refreshToken')
  session.removeItem('accessToken')
  session.removeItem('refreshToken')
}

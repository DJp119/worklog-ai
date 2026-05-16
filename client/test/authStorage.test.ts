import assert from 'node:assert/strict'
import test from 'node:test'
import { clearStoredTokens, getStoredTokens, storeStoredTokens } from '../src/lib/authStorage'

function createStorage(seed: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(seed))

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

test('getStoredTokens reads session storage when local storage is empty', () => {
  const local = createStorage()
  const session = createStorage({
    accessToken: 'session-access',
    refreshToken: 'session-refresh',
  })

  assert.deepEqual(getStoredTokens(local, session), {
    accessToken: 'session-access',
    refreshToken: 'session-refresh',
  })
})

test('storeStoredTokens preserves the existing storage location', () => {
  const local = createStorage()
  const session = createStorage({ refreshToken: 'old-session-refresh' })

  storeStoredTokens(
    { accessToken: 'new-access', refreshToken: 'new-refresh' },
    local,
    session
  )

  assert.equal(local.getItem('accessToken'), null)
  assert.equal(session.getItem('accessToken'), 'new-access')
  assert.equal(session.getItem('refreshToken'), 'new-refresh')
})

test('clearStoredTokens clears both browser storage locations', () => {
  const local = createStorage({ accessToken: 'local-access', refreshToken: 'local-refresh' })
  const session = createStorage({ accessToken: 'session-access', refreshToken: 'session-refresh' })

  clearStoredTokens(local, session)

  assert.equal(local.getItem('accessToken'), null)
  assert.equal(local.getItem('refreshToken'), null)
  assert.equal(session.getItem('accessToken'), null)
  assert.equal(session.getItem('refreshToken'), null)
})

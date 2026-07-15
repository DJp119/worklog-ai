import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  useEffect: vi.fn(),
  useState: vi.fn(),
}))

vi.mock('react', () => ({
  useEffect: mocks.useEffect,
  useState: mocks.useState,
}))

vi.mock('../src/lib/api', () => ({
  apiRequest: mocks.apiRequest,
}))

import { useHasOrg } from '../src/hooks/useHasOrg'

describe('useHasOrg', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset()
    mocks.apiRequest.mockResolvedValue([])
    mocks.useState.mockReturnValue([false, vi.fn()])
    mocks.useEffect.mockImplementation((effect) => {
      effect()
    })
  })

  it('does not request protected organization data for guests', () => {
    useHasOrg(false)

    expect(mocks.apiRequest).not.toHaveBeenCalled()
  })

  it('requests organization data without redirecting guests on a 401', () => {
    useHasOrg(true)

    expect(mocks.apiRequest).toHaveBeenCalledWith('/api/orgs', {
      ignoreAuthRedirect: true,
    })
  })
})

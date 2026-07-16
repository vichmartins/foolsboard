import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import LoginScreen from './LoginScreen'
import * as api from '../api'
import { useAuth } from '../auth'

vi.mock('./ThemeToggle', () => ({ default: () => null }))
vi.mock('../api', () => ({
  apiError: (_e: unknown, fallback: string) => fallback,
  getSetupStatus: vi.fn(),
}))
vi.mock('../auth', () => ({ useAuth: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(), register: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>)
})

describe('LoginScreen', () => {
  it('shows the first-run "create the admin account" flow when the instance is empty', async () => {
    vi.mocked(api.getSetupStatus).mockResolvedValue({ needs_setup: true })
    render(<LoginScreen />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create Admin Account' })).toBeInTheDocument(),
    )
    // Sets up an admin: email + username + password, and explains the role.
    expect(screen.getByText(/set up your foolsboard/i)).toBeInTheDocument()
    expect(screen.getByText(/administrator/i)).toBeInTheDocument()
    // First-run has no invite field and no login/register toggle.
    expect(screen.queryByText('Invite code')).not.toBeInTheDocument()
    expect(screen.queryByText(/Have an account/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Need an account/i)).not.toBeInTheDocument()
  })

  it('shows the normal sign-in form when accounts already exist', async () => {
    vi.mocked(api.getSetupStatus).mockResolvedValue({ needs_setup: false })
    render(<LoginScreen />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument(),
    )
    expect(screen.getByText('Email or username')).toBeInTheDocument()
    expect(screen.getByText('Need an account? Register')).toBeInTheDocument()
  })
})

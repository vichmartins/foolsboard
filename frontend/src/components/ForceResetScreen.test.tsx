import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ForceResetScreen from './ForceResetScreen'
import { useAuth } from '../auth'

vi.mock('./ThemeToggle', () => ({ default: () => null }))
vi.mock('../api', () => ({ apiError: (_e: unknown, fallback: string) => fallback }))
vi.mock('../auth', () => ({ useAuth: vi.fn() }))

const completeReset = vi.fn()
const logout = vi.fn()

function mockAuth() {
  vi.mocked(useAuth).mockReturnValue({
    user: { username: 'bob' },
    completeReset,
    logout,
  } as unknown as ReturnType<typeof useAuth>)
}

describe('ForceResetScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('greets the signed-in user and asks for a new password', () => {
    render(<ForceResetScreen />)
    expect(screen.getByText('Choose a new password')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByText(/reset by an administrator/i)).toBeInTheDocument()
  })

  it('blocks a mismatch and a too-short password, then submits a valid one', async () => {
    render(<ForceResetScreen />)
    const [pw, confirm] = screen.getAllByLabelText(/password/i) as HTMLInputElement[]

    fireEvent.change(pw, { target: { value: 'longenough1' } })
    fireEvent.change(confirm, { target: { value: 'different1' } })
    fireEvent.click(screen.getByRole('button', { name: /Set Password/i }))
    expect(screen.getByText(/don.t match/i)).toBeInTheDocument()
    expect(completeReset).not.toHaveBeenCalled()

    fireEvent.change(pw, { target: { value: 'short' } })
    fireEvent.change(confirm, { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /Set Password/i }))
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(completeReset).not.toHaveBeenCalled()

    fireEvent.change(pw, { target: { value: 'myrealpass1' } })
    fireEvent.change(confirm, { target: { value: 'myrealpass1' } })
    fireEvent.click(screen.getByRole('button', { name: /Set Password/i }))
    await waitFor(() => expect(completeReset).toHaveBeenCalledWith('myrealpass1'))
  })

  it('lets the user bail out to sign in as someone else', () => {
    render(<ForceResetScreen />)
    fireEvent.click(screen.getByRole('button', { name: /sign in as someone else/i }))
    expect(logout).toHaveBeenCalled()
  })
})

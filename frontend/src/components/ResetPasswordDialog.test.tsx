import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ResetPasswordDialog from './ResetPasswordDialog'
import * as api from '../api'
import type { AdminUser } from '../types'

vi.mock('../api', () => ({
  apiError: (_e: unknown, fallback: string) => fallback,
  adminResetPassword: vi.fn(),
}))

const user: AdminUser = {
  id: 'u1', email: 'bob@example.com', username: 'bob', is_admin: false,
  is_active: true, created_at: '', must_change_password: false,
}

describe('ResetPasswordDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults to the temporary-password option and reveals the generated password once', async () => {
    vi.mocked(api.adminResetPassword).mockResolvedValue({
      mode: 'temp', must_change_password: true,
      temp_password: 'Ab3Kd9Mn2Pq4', temp_password_expires_at: '2026-07-17T12:00:00Z',
    })
    const onReset = vi.fn()
    render(<ResetPasswordDialog user={user} onClose={() => {}} onReset={onReset} />)

    expect(screen.getByText('Reset Password')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Generate Password' }))

    await waitFor(() => expect(screen.getByText('Ab3Kd9Mn2Pq4')).toBeInTheDocument())
    expect(api.adminResetPassword).toHaveBeenCalledWith('u1', { mode: 'temp' })
    expect(onReset).toHaveBeenCalledWith(true)
    expect(screen.getByText(/won.t be shown again/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('sets a password directly when that mode is chosen (with force-change on by default)', async () => {
    vi.mocked(api.adminResetPassword).mockResolvedValue({
      mode: 'set', must_change_password: true, temp_password: null, temp_password_expires_at: null,
    })
    const onClose = vi.fn()
    const onReset = vi.fn()
    render(<ResetPasswordDialog user={user} onClose={onClose} onReset={onReset} />)

    fireEvent.click(screen.getByText('Set a password for them'))
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'brandnew123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }))

    await waitFor(() =>
      expect(api.adminResetPassword).toHaveBeenCalledWith('u1', {
        mode: 'set', password: 'brandnew123', require_change: true,
      }),
    )
    expect(onReset).toHaveBeenCalledWith(true)
    expect(onClose).toHaveBeenCalled() // set mode closes (nothing to reveal)
  })

  it('rejects a too-short direct password before calling the API', () => {
    render(<ResetPasswordDialog user={user} onClose={() => {}} onReset={() => {}} />)
    fireEvent.click(screen.getByText('Set a password for them'))
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }))
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(api.adminResetPassword).not.toHaveBeenCalled()
  })
})

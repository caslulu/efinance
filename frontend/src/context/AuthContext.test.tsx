import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('../api/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

import { AuthProvider, useAuth } from './AuthContext';

const Consumer = () => {
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isAuthLoading ? 'loading' : 'done'}</span>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="user">{user?.username ?? 'anon'}</span>
      <button onClick={() => logout()}>sair</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('marca usuário como autenticado quando /auth/profile responde com dados', async () => {
    apiGetMock.mockResolvedValueOnce({ data: { id: 1, username: 'lucas', email: 'l@x.com' } });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('done');
    });
    expect(screen.getByTestId('auth').textContent).toBe('yes');
    expect(screen.getByTestId('user').textContent).toBe('lucas');
  });

  it('mantém isAuthenticated=false quando /auth/profile retorna 401', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('401'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('done');
    });
    expect(screen.getByTestId('auth').textContent).toBe('no');
  });

  it('limpa o estado do usuário ao fazer logout', async () => {
    apiGetMock.mockResolvedValueOnce({ data: { id: 1, username: 'lucas' } });
    apiPostMock.mockResolvedValueOnce({ data: {} });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('yes');
    });

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'sair' }));
    });

    expect(apiPostMock).toHaveBeenCalledWith('/auth/logout');
    expect(screen.getByTestId('auth').textContent).toBe('no');
    expect(screen.getByTestId('user').textContent).toBe('anon');
  });

  it('remove tokens legados do storage ao inicializar', async () => {
    localStorage.setItem('session_token', 'legacy');
    sessionStorage.setItem('session_token', 'legacy');
    apiGetMock.mockRejectedValueOnce(new Error('401'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('done');
    });
    expect(localStorage.getItem('session_token')).toBeNull();
    expect(sessionStorage.getItem('session_token')).toBeNull();
  });
});

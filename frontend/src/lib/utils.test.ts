import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { cn, formatCurrency, getErrorMessage } from './utils';

describe('cn', () => {
  it('mescla classes condicionais', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('aplica twMerge para classes Tailwind conflitantes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('formatCurrency', () => {
  it('formata valor positivo em BRL', () => {
    const out = formatCurrency(1234.5);
    expect(out).toMatch(/R\$/);
    expect(out).toContain('1.234,50');
  });

  it('formata zero', () => {
    expect(formatCurrency(0)).toContain('0,00');
  });

  it('formata valor negativo', () => {
    const out = formatCurrency(-50);
    expect(out).toContain('50,00');
    expect(out).toMatch(/-/);
  });
});

describe('getErrorMessage', () => {
  it('retorna fallback quando o erro é desconhecido', () => {
    expect(getErrorMessage(null, 'falhou')).toBe('falhou');
    expect(getErrorMessage(undefined, 'falhou')).toBe('falhou');
    expect(getErrorMessage('string solta', 'falhou')).toBe('falhou');
  });

  it('extrai mensagem de Error nativo', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('extrai mensagem string do AxiosError', () => {
    const err = new AxiosError('req fail');
    err.response = {
      data: { message: 'Email já cadastrado' },
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    };
    expect(getErrorMessage(err)).toBe('Email já cadastrado');
  });

  it('extrai a primeira mensagem quando AxiosError traz array', () => {
    const err = new AxiosError('req fail');
    err.response = {
      data: { message: ['campo obrigatório', 'outro erro'] },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    };
    expect(getErrorMessage(err)).toBe('campo obrigatório');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const Boom = () => {
  throw new Error('falha proposital');
};

const Ok = () => <div>conteudo</div>;

describe('ErrorBoundary', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Silencia o react error log esperado durante esses testes
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  it('renderiza children quando não há erro', () => {
    render(
      <ErrorBoundary>
        <Ok />
      </ErrorBoundary>,
    );
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });

  it('renderiza fallback padrão ao capturar um erro', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /voltar ao início/i }),
    ).toBeInTheDocument();
  });

  it('usa fallback customizado quando informado', () => {
    render(
      <ErrorBoundary fallback={<div>fallback custom</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback custom')).toBeInTheDocument();
  });
});

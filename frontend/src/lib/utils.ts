import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { AxiosError } from 'axios';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export function getErrorMessage(error: unknown, fallback: string = 'Ocorreu um erro inesperado'): string {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message[0];
    if (typeof message === 'string') return message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

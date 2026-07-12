import { describe, expect, it } from 'vitest';
import { advanceRecurringDate } from './recurrence';

describe('advanceRecurringDate', () => {
  it.each([
    ['2025-01-31T12:00:00', 'MONTHLY', '2025-02-28'],
    ['2024-01-31T12:00:00', 'MONTHLY', '2024-02-29'],
    ['2026-01-30T12:00:00', 'MONTHLY', '2026-02-28'],
    ['2026-01-29T12:00:00', 'MONTHLY', '2026-02-28'],
  ] as const)('projects %s safely', (input, frequency, expected) => {
    const current = new Date(input);
    expect(
      advanceRecurringDate(current, frequency, current.getDate())
        .toISOString()
        .slice(0, 10),
    ).toBe(expected);
  });
});

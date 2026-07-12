import { addMonthsSafe } from './finance-date';

describe('addMonthsSafe', () => {
  it.each([
    ['2025-01-31T12:00:00.000Z', 1, '2025-02-28'],
    ['2024-01-31T12:00:00.000Z', 1, '2024-02-29'],
    ['2026-01-30T12:00:00.000Z', 1, '2026-02-28'],
    ['2026-01-29T12:00:00.000Z', 1, '2026-02-28'],
  ])('advances %s safely', (input, months, expected) => {
    expect(
      addMonthsSafe(new Date(input), months).toISOString().slice(0, 10),
    ).toBe(expected);
  });
});

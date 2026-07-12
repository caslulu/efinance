export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export function advanceRecurringDate(
  current: Date,
  frequency: RecurrenceFrequency,
  anchorDay = current.getDate(),
): Date {
  const next = new Date(current);
  if (frequency === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
    return next;
  }

  const months = frequency === 'MONTHLY' ? 1 : frequency === 'QUARTERLY' ? 3 : 12;
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(anchorDay, lastDay));
  return next;
}

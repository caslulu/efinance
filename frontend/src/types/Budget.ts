import type { Category } from './Category';

export interface Budget {
  id: number;
  user_id: number;
  category_id: number;
  limit: number;
  category?: Category;
}

export interface BudgetStatusItem {
  id: number;
  category_id: number;
  categoryName: string;
  categoryIcon?: string;
  limit: number;
  spent: number;
  remaining: number;
  percentage: number;
}

import { useEffect, useState } from 'react';
import { api } from '../../../api/api';
import type { Category } from '../../../types/Category';
import { CreateCategoryModal } from '../components/CreateCategoryModal';

export const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      if (Array.isArray(res.data)) {
        setCategories(res.data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure? This might affect transactions.')) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (error) {
      alert('Failed to delete category');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + New Category
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow max-w-2xl">
        <ul className="divide-y divide-gray-200">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <span className="text-sm font-medium text-gray-900">{category.name}</span>
              <button
                onClick={() => handleDelete(category.id)}
                className="text-sm font-medium text-red-600 hover:text-red-900"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        {categories.length === 0 && !loading && (
          <div className="p-6 text-center text-gray-500">No categories found.</div>
        )}
      </div>

      <CreateCategoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchCategories}
      />
    </div>
  );
};

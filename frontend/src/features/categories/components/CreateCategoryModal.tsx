import { useState } from 'react';
import { api } from '../../../api/api';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateCategoryModal = ({ isOpen, onClose, onSuccess }: CreateCategoryModalProps) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/categories', { name });
      onSuccess();
      onClose();
      setName('');
    } catch (error) {
      alert('Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">New Category</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              className="mt-1 block w-full rounded border p-2"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Food, Transport"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

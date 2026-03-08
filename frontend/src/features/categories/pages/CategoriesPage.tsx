import { useState } from 'react';
import { toast } from 'sonner';
import { useCategories, useDeleteCategory } from '@/hooks';
import type { Category } from '@/types/Category';
import { UpsertCategoryModal } from '../components/UpsertCategoryModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Pencil, Plus, Tags, Layers } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';

const tileColors = [
  'from-emerald-500/10 to-teal-500/6 hover:from-emerald-500/20 hover:to-teal-500/14 border-emerald-500/15 hover:border-emerald-500/30',
  'from-blue-500/10 to-indigo-500/6 hover:from-blue-500/20 hover:to-indigo-500/14 border-blue-500/15 hover:border-blue-500/30',
  'from-violet-500/10 to-purple-500/6 hover:from-violet-500/20 hover:to-purple-500/14 border-violet-500/15 hover:border-violet-500/30',
  'from-amber-500/10 to-orange-500/6 hover:from-amber-500/20 hover:to-orange-500/14 border-amber-500/15 hover:border-amber-500/30',
  'from-rose-500/10 to-pink-500/6 hover:from-rose-500/20 hover:to-pink-500/14 border-rose-500/15 hover:border-rose-500/30',
  'from-cyan-500/10 to-sky-500/6 hover:from-cyan-500/20 hover:to-sky-500/14 border-cyan-500/15 hover:border-cyan-500/30',
];

const iconColors = [
  'text-emerald-600 dark:text-emerald-400',
  'text-blue-600 dark:text-blue-400',
  'text-violet-600 dark:text-violet-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-cyan-600 dark:text-cyan-400',
];

export const CategoriesPage = () => {
  const { data: categories = [], isLoading: loading, refetch: refetchCategories } = useCategories();
  const deleteCategory = useDeleteCategory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteCategory.mutateAsync(id);
    } catch {
      toast.error('Falha ao excluir categoria');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
            <Tags className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Categorias</h1>
            <p className="text-sm text-muted-foreground">
              {categories.length} categoria{categories.length !== 1 ? 's' : ''} registrada{categories.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      {loading ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-[168px] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {/* Add Category Tile */}
          <button
            onClick={handleCreate}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-violet-500/50 p-6 transition-all duration-300 hover:bg-violet-500/5 min-h-[168px]"
          >
            <div className="p-3.5 rounded-xl bg-muted/50 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-all duration-300 group-hover:scale-110">
              <Plus className="h-6 w-6 text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
            </div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Nova Categoria
            </span>
          </button>

          {/* Category Tiles */}
          {categories.map((category, index) => {
            const colorIndex = index % tileColors.length;
            return (
              <div
                key={category.id}
                className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border bg-gradient-to-br ${tileColors[colorIndex]} p-6 transition-all duration-500 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-1 min-h-[168px] cursor-default`}
              >
                {/* Hover Actions */}
                <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg bg-white/70 dark:bg-black/30 backdrop-blur-sm hover:bg-white dark:hover:bg-black/50 shadow-sm"
                    onClick={() => handleEdit(category)}
                  >
                    <Pencil className="h-3 w-3 text-slate-700 dark:text-slate-300" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg bg-white/70 dark:bg-black/30 backdrop-blur-sm hover:bg-red-100 dark:hover:bg-red-900/50 shadow-sm"
                    onClick={() => setConfirmDeleteId(category.id)}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>

                {/* Icon */}
                <div className="p-3.5 rounded-xl bg-white/60 dark:bg-white/10 shadow-sm transition-transform duration-500 group-hover:scale-110">
                  <CategoryIcon name={category.icon} className={`h-7 w-7 ${iconColors[colorIndex]}`} />
                </div>

                {/* Name */}
                <span className="text-sm font-semibold text-foreground text-center leading-tight">
                  {category.name}
                </span>
              </div>
            );
          })}

          {/* Empty State */}
          {categories.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-2xl text-muted-foreground">
              <div className="p-4 rounded-2xl bg-muted/50 mb-4">
                <Layers className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <p className="font-semibold text-lg mb-1">Nenhuma categoria</p>
              <p className="text-sm">Crie categorias para organizar suas transações</p>
            </div>
          )}
        </div>
      )}

      <UpsertCategoryModal
        isOpen={isModalOpen}
        category={editingCategory}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetchCategories()}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Excluir Categoria"
        description="Tem certeza? Isso pode afetar transações existentes."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (confirmDeleteId !== null) handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

import { useState } from 'react';
import { toast } from 'sonner';
import { useCategories, useDeleteCategory } from '@/hooks';
import type { Category } from '@/types/Category';
import { UpsertCategoryModal } from '../components/UpsertCategoryModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash2, Pencil } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';

export const CategoriesPage = () => {
  const { data: categories = [], isLoading: loading, refetch: refetchCategories } = useCategories();
  const deleteCategory = useDeleteCategory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteCategory.mutateAsync(id);
    } catch (error) {
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
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
        <Button onClick={handleCreate}>
          + Nova Categoria
        </Button>
      </div>

      <div className="rounded-md border max-w-2xl bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ícone</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <div className="p-2 w-fit rounded-lg bg-slate-100">
                    <CategoryIcon name={category.icon} className="h-5 w-5 text-slate-600" />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      <Pencil className="h-4 w-4 text-slate-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setConfirmDeleteId(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  Nenhuma categoria encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

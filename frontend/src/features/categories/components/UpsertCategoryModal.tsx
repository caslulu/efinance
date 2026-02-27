import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconPicker } from '@/components/IconPicker';
import type { Category } from '@/types/Category';

interface UpsertCategoryModalProps {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const UpsertCategoryModal = ({ isOpen, category, onClose, onSuccess }: UpsertCategoryModalProps) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('HelpCircle');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setIcon(category.icon || 'HelpCircle');
      } else {
        setName('');
        setIcon('HelpCircle');
      }
    }
  }, [isOpen, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (category) {
        await api.patch(`/categories/${category.id}`, { name, icon });
      } else {
        await api.post('/categories', { name, icon });
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Falha ao ${category ? 'atualizar' : 'criar'} categoria`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          <DialogDescription>
            {category ? 'Altere as informações da categoria abaixo.' : 'Preencha as informações para criar uma nova categoria.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="ex: Alimentação, Transporte"
            />
          </div>
          <div className="grid gap-2">
            <Label>Ícone</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : category ? 'Salvar Alterações' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

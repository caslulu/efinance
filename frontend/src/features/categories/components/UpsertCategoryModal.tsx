import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconPicker } from '@/components/IconPicker';
import type { Category } from '@/types/Category';
import { Tags, Pencil } from 'lucide-react';

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
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-lg ${category ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25' : 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/25'}`}>
              {category ? <Pencil className="h-5 w-5 text-white" /> : <Tags className="h-5 w-5 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-xl">{category ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
              <DialogDescription className="mt-1">
                {category ? 'Altere as informações da categoria abaixo.' : 'Preencha as informações para criar uma nova categoria.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent -mx-6 my-1" />
        <form onSubmit={handleSubmit} className="grid gap-5 pt-2">
          <div className="flex items-end gap-3">
            <div className="grid gap-2 shrink-0">
              <Label>Ícone</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div className="grid gap-2 flex-1">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="ex: Alimentação, Transporte"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
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

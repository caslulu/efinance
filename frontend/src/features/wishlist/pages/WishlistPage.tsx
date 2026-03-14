import { useCallback, useMemo, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import {
  isSupportedWishlistProductUrl,
  normalizeWishlistScrapeResponse,
  parseWishlistPrice,
} from '@/features/wishlist/utils';
import {
  useCreateWishlist,
  useCreateWishlistProduct,
  useDeleteWishlist,
  useDeleteWishlistProduct,
  useScrapeProductUrl,
  useUpdateWishlist,
  useUpdateWishlistProduct,
  useWishlists,
} from '@/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Gift, Loader2, Pencil, Plus, Trash2, ExternalLink, Bell, BellOff, History } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useWishlistProductHistory } from '@/hooks/useWishlists';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const WishlistPage = () => {
  const { data: wishlists = [], isLoading } = useWishlists();
  const createWishlist = useCreateWishlist();
  const updateWishlist = useUpdateWishlist();
  const deleteWishlist = useDeleteWishlist();
  const createProduct = useCreateWishlistProduct();
  const updateProduct = useUpdateWishlistProduct();
  const deleteProduct = useDeleteWishlistProduct();
  const scrapeUrl = useScrapeProductUrl();

  const [newWishlistName, setNewWishlistName] = useState('');
  const [selectedWishlistId, setSelectedWishlistId] = useState<number | null>(null);

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductUrl, setNewProductUrl] = useState('');
  const [newProductSendPriceAlerts, setNewProductSendPriceAlerts] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDeleteWishlistId, setConfirmDeleteWishlistId] = useState<number | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<{ wishlistId: number; productId: number } | null>(null);

  // Rename wishlist modal state
  const [renameModal, setRenameModal] = useState<{ wishlistId: number; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Edit product modal state
  const [editProductModal, setEditProductModal] = useState<{
    wishlistId: number;
    productId: number;
    currentName: string;
    currentPrice: number;
    currentUrl: string | null;
    currentAlerts: boolean;
  } | null>(null);
  const [editProductName, setEditProductName] = useState('');
  const [editProductPrice, setEditProductPrice] = useState('');
  const [editProductUrl, setEditProductUrl] = useState('');
  const [editProductSendPriceAlerts, setEditProductSendPriceAlerts] = useState(false);

  // History modal state
  const [historyModal, setHistoryModal] = useState<{
    wishlistId: number;
    productId: number;
    productName: string;
  } | null>(null);

  const { data: productHistory = [], isLoading: loadingHistory } = useWishlistProductHistory(
    historyModal?.wishlistId || 0,
    historyModal?.productId || 0,
  );

  const handleUrlChange = useCallback(
    (url: string) => {
      setNewProductUrl(url);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const trimmed = url.trim();
      if (!trimmed || !trimmed.startsWith('http')) return;
      if (!isSupportedWishlistProductUrl(trimmed)) return;

      debounceTimerRef.current = setTimeout(async () => {
        setScrapeLoading(true);
        try {
          const result = normalizeWishlistScrapeResponse(
            await scrapeUrl.mutateAsync(trimmed),
            trimmed,
          );
          if (result.price && result.price > 0) {
            setNewProductPrice(result.price.toFixed(2));
          }
          if (result.name && !newProductName.trim()) {
            setNewProductName(result.name);
          }
        } catch (error) {
          console.error('Falha no preenchimento automático:', error);
        } finally {
          setScrapeLoading(false);
        }
      }, 600);
    },
    [scrapeUrl, newProductName],
  );

  const activeWishlistId = useMemo(() => {
    if (wishlists.length === 0) return null;
    if (selectedWishlistId && wishlists.some((wishlist) => wishlist.id === selectedWishlistId)) {
      return selectedWishlistId;
    }
    return wishlists[0].id;
  }, [selectedWishlistId, wishlists]);

  const selectedWishlist = useMemo(
    () => wishlists.find((wishlist) => wishlist.id === activeWishlistId),
    [wishlists, activeWishlistId],
  );

  const wishlistTotal = useMemo(() => {
    if (!selectedWishlist) return 0;
    return selectedWishlist.products.reduce((sum, product) => sum + Number(product.price), 0);
  }, [selectedWishlist]);

  const handleCreateWishlist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newWishlistName.trim()) return;

    try {
      await createWishlist.mutateAsync({ name: newWishlistName.trim() });
      setNewWishlistName('');
    } catch {
      toast.error('Falha ao criar lista de desejo');
    }
  };

  const openRenameModal = (wishlistId: number, currentName: string) => {
    setRenameValue(currentName);
    setRenameModal({ wishlistId, currentName });
  };

  const handleRenameWishlist = async () => {
    if (!renameModal || !renameValue.trim()) return;
    try {
      await updateWishlist.mutateAsync({ id: renameModal.wishlistId, data: { name: renameValue.trim() } });
      setRenameModal(null);
    } catch {
      toast.error('Falha ao atualizar lista de desejo');
    }
  };

  const handleDeleteWishlist = async (wishlistId: number) => {
    try {
      await deleteWishlist.mutateAsync(wishlistId);
    } catch {
      toast.error('Falha ao excluir lista de desejo');
    }
  };

  const handleCreateProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeWishlistId) return;
    const parsedPrice = parseWishlistPrice(newProductPrice);
    if (!newProductName.trim() || parsedPrice === null) {
      toast.warning('Informe um nome e um preco valido');
      return;
    }

    try {
      await createProduct.mutateAsync({
        wishlistId: activeWishlistId,
        data: {
          name_product: newProductName.trim(),
          price: parsedPrice,
          send_price_alerts: newProductSendPriceAlerts,
          ...(newProductUrl.trim() ? { url: newProductUrl.trim() } : {}),
        },
      });

      setNewProductName('');
      setNewProductPrice('');
      setNewProductUrl('');
      setNewProductSendPriceAlerts(false);
    } catch {
      toast.error('Falha ao adicionar item na wishlist');
    }
  };

  const openEditProductModal = (
    wishlistId: number,
    productId: number,
    currentName: string,
    currentPrice: number,
    currentUrl: string | null,
    currentAlerts: boolean,
  ) => {
    setEditProductName(currentName);
    setEditProductPrice(String(currentPrice));
    setEditProductUrl(currentUrl || '');
    setEditProductSendPriceAlerts(currentAlerts);
    setEditProductModal({ wishlistId, productId, currentName, currentPrice, currentUrl, currentAlerts });
  };

  const handleUpdateProduct = async () => {
    if (!editProductModal || !editProductName.trim()) return;

    const parsedPrice = parseWishlistPrice(editProductPrice);
    if (parsedPrice === null) {
      toast.warning('Preço inválido');
      return;
    }

    try {
      await updateProduct.mutateAsync({
        wishlistId: editProductModal.wishlistId,
        productId: editProductModal.productId,
        data: {
          name_product: editProductName.trim(),
          price: parsedPrice,
          url: editProductUrl.trim() || undefined,
          send_price_alerts: editProductSendPriceAlerts,
        },
      });
      setEditProductModal(null);
    } catch {
      toast.error('Falha ao atualizar item da wishlist');
    }
  };

  const handleDeleteProduct = async (wishlistId: number, productId: number) => {
    try {
      await deleteProduct.mutateAsync({ wishlistId, productId });
    } catch {
      toast.error('Falha ao remover item da wishlist');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Wishlist</h1>
            <p className="text-sm text-muted-foreground">
              {wishlists.length} lista{wishlists.length !== 1 ? 's' : ''} de desejo
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleCreateWishlist} className="flex gap-3 max-w-xl">
        <Input
          value={newWishlistName}
          onChange={(event) => setNewWishlistName(event.target.value)}
          placeholder="Nome da lista (ex: Viagem, Setup)"
          className="h-10"
        />
        <Button type="submit" disabled={createWishlist.isPending} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Nova Lista
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-4 pt-4">
          <Skeleton className="h-[50px] w-full" />
          <Skeleton className="h-[250px] w-full" />
        </div>
      ) : wishlists.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed rounded-2xl text-muted-foreground">
          <div className="p-4 rounded-2xl bg-muted/50 inline-block mb-4">
            <Gift className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-lg mb-1">Nenhuma lista de desejo</p>
          <p className="text-sm">Crie a primeira lista acima para começar.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Minhas Listas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {wishlists.map((wishlist) => {
                const isActive = wishlist.id === activeWishlistId;

                return (
                  <div
                    key={wishlist.id}
                    className={`group rounded-xl border p-3 transition-all duration-200 ${isActive ? 'border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-900/20 shadow-sm shadow-emerald-500/10' : 'border-border/50 hover:border-border hover:bg-muted/50'}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setSelectedWishlistId(wishlist.id)}
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100">{wishlist.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {wishlist.products.length} item(ns)
                      </p>
                    </button>
                    <div className="mt-2 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openRenameModal(wishlist.id, wishlist.name)}
                      >
                        <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 dark:text-red-400"
                        onClick={() => setConfirmDeleteWishlistId(wishlist.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedWishlist?.name || 'Selecione uma lista'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Total estimado: <span className="font-semibold text-foreground">{formatCurrency(wishlistTotal)}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleCreateProduct} className="space-y-3 rounded-xl border border-border/50 p-4 bg-muted/30">
                <p className="text-sm font-semibold text-foreground">Adicionar item</p>
                <div className="relative">
                  <Input
                    value={newProductUrl}
                    onChange={(event) => handleUrlChange(event.target.value)}
                    placeholder="URL do produto (cole o link da Amazon ou Mercado Livre)"
                    className="pr-10"
                  />
                  {scrapeLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-500 dark:text-emerald-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Suporta links da Amazon e Mercado Livre para preenchimento automático.
                </p>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                  <Input
                    value={newProductName}
                    onChange={(event) => setNewProductName(event.target.value)}
                    placeholder="Nome do item"
                  />
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={newProductPrice}
                    onChange={(event) => setNewProductPrice(event.target.value)}
                    placeholder="Preco"
                  />
                  <Button type="submit" disabled={!activeWishlistId || createProduct.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={newProductSendPriceAlerts}
                    onCheckedChange={(checked) => setNewProductSendPriceAlerts(Boolean(checked))}
                  />
                  Enviar alertas de preço
                </label>
              </form>

              <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Alertas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWishlist?.products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name_product}</TableCell>
                        <TableCell>{formatCurrency(Number(product.price))}</TableCell>
                        <TableCell>
                          {product.url ? (
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 text-sm"
                              title={product.url}
                            >
                              <ExternalLink className="h-3 w-3" /> Acessar
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {product.send_price_alerts ? (
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                              <Bell className="h-3 w-3 mr-1" /> Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                              <BellOff className="h-3 w-3 mr-1" /> Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                openEditProductModal(
                                  selectedWishlist.id,
                                  product.id,
                                  product.name_product,
                                  Number(product.price),
                                  product.url,
                                  product.send_price_alerts
                                )
                              }
                            >
                              <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setHistoryModal({
                                wishlistId: selectedWishlist.id,
                                productId: product.id,
                                productName: product.name_product
                              })}
                            >
                              <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 dark:text-red-400"
                              onClick={() => setConfirmDeleteProduct({ wishlistId: selectedWishlist.id, productId: product.id })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!selectedWishlist?.products.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                          Nenhum item nesta lista ainda.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteWishlistId !== null}
        title="Excluir Lista de Desejo"
        description="Deseja excluir esta lista de desejo e todos os itens dela?"
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (confirmDeleteWishlistId !== null) handleDeleteWishlist(confirmDeleteWishlistId);
          setConfirmDeleteWishlistId(null);
        }}
        onCancel={() => setConfirmDeleteWishlistId(null)}
      />

      <ConfirmDialog
        open={confirmDeleteProduct !== null}
        title="Remover Item"
        description="Deseja remover este item da wishlist?"
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          if (confirmDeleteProduct) handleDeleteProduct(confirmDeleteProduct.wishlistId, confirmDeleteProduct.productId);
          setConfirmDeleteProduct(null);
        }}
        onCancel={() => setConfirmDeleteProduct(null)}
      />

      {/* Rename Wishlist Modal */}
      <Dialog open={renameModal !== null} onOpenChange={(open) => !open && setRenameModal(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                <Pencil className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Renomear Lista</DialogTitle>
                <DialogDescription className="mt-1">Altere o nome da sua lista de desejo.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent -mx-6 my-1" />
          <div className="grid gap-4 pt-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Novo nome da lista"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRenameWishlist()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameModal(null)}>Cancelar</Button>
            <Button onClick={handleRenameWishlist} disabled={!renameValue.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={editProductModal !== null} onOpenChange={(open) => !open && setEditProductModal(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <Pencil className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Editar Item</DialogTitle>
                <DialogDescription className="mt-1">Atualize o nome e preço do item.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent -mx-6 my-1" />
          <div className="grid gap-4 pt-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nome do item</label>
              <Input
                value={editProductName}
                onChange={(e) => setEditProductName(e.target.value)}
                placeholder="Nome do item"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Preço</label>
              <Input
                type="text"
                inputMode="decimal"
                value={editProductPrice}
                onChange={(e) => setEditProductPrice(e.target.value)}
                placeholder="Preço alvo"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Link do Produto (Opcional)</label>
              <Input
                value={editProductUrl}
                onChange={(e) => setEditProductUrl(e.target.value)}
                placeholder="https://amazon.com.br/..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={editProductSendPriceAlerts}
                onCheckedChange={(checked) => setEditProductSendPriceAlerts(Boolean(checked))}
              />
              Enviar alertas de preço quando houver queda
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProductModal(null)}>Cancelar</Button>
            <Button onClick={handleUpdateProduct} disabled={!editProductName.trim() || !editProductPrice}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyModal !== null} onOpenChange={(open) => !open && setHistoryModal(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/25">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Histórico de Preço</DialogTitle>
                <DialogDescription className="mt-1">
                  {historyModal?.productName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent -mx-6 my-1" />
          <div className="py-4">
            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500 dark:text-emerald-400" />
              </div>
            ) : productHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                <div className="p-3 rounded-xl bg-muted/50 inline-block mb-3">
                  <History className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-medium">Nenhum histórico de preço registrado ainda.</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={productHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="created_at"
                      tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: ptBR })}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(value) => formatCurrency(value)}
                      fontSize={12}
                      width={80}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), 'Preço']}
                      labelFormatter={(label) => format(new Date(label), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

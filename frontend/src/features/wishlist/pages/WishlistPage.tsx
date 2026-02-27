import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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

      // Only scrape Amazon and Mercado Livre URLs
      const isSupported =
        /amazon\.com\.br/i.test(trimmed) || /mercadolivre\.com\.br|mercadolibre\.com/i.test(trimmed);
      if (!isSupported) return;

      debounceTimerRef.current = setTimeout(async () => {
        setScrapeLoading(true);
        try {
          const result = await scrapeUrl.mutateAsync(trimmed);
          if (result.price && result.price > 0) {
            setNewProductPrice(String(result.price));
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
    if (!newProductName.trim() || !newProductPrice.trim()) return;

    try {
      await createProduct.mutateAsync({
        wishlistId: activeWishlistId,
        data: {
          name_product: newProductName.trim(),
          price: Number(newProductPrice),
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

    const parsedPrice = Number(editProductPrice);
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Gift className="text-blue-600" />
          Wishlist
        </h1>
      </div>

      <form onSubmit={handleCreateWishlist} className="flex gap-2 max-w-xl">
        <Input
          value={newWishlistName}
          onChange={(event) => setNewWishlistName(event.target.value)}
          placeholder="Nome da lista (ex: Viagem, Setup)"
        />
        <Button type="submit" disabled={createWishlist.isPending}>
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
        <div className="py-20 text-center border-2 border-dashed rounded-xl text-muted-foreground">
          Você ainda não tem listas de desejo. Crie a primeira acima.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Minhas Listas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {wishlists.map((wishlist) => {
                const isActive = wishlist.id === activeWishlistId;

                return (
                  <div
                    key={wishlist.id}
                    className={`rounded-lg border p-3 transition ${isActive ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setSelectedWishlistId(wishlist.id)}
                    >
                      <p className="font-medium text-slate-900">{wishlist.name}</p>
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
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600"
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

          <Card>
            <CardHeader>
              <CardTitle>
                {selectedWishlist?.name || 'Selecione uma lista'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Total estimado: {formatCurrency(wishlistTotal)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateProduct} className="space-y-3 rounded-lg border p-4 bg-slate-50">
                <p className="text-sm font-medium text-slate-700">Adicionar item</p>
                <div className="relative">
                  <Input
                    value={newProductUrl}
                    onChange={(event) => handleUrlChange(event.target.value)}
                    onPaste={(event) => {
                      const pasted = event.clipboardData.getData('text');
                      if (pasted) {
                        // Let the onChange fire, but also trigger immediately for paste
                        setTimeout(() => handleUrlChange(pasted), 0);
                      }
                    }}
                    placeholder="URL do produto (cole o link da Amazon ou Mercado Livre)"
                    className="pr-10"
                  />
                  {scrapeLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
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
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newProductPrice}
                    onChange={(event) => setNewProductPrice(event.target.value)}
                    placeholder="Preço"
                  />
                  <Button type="submit" disabled={!activeWishlistId || createProduct.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={newProductSendPriceAlerts}
                    onCheckedChange={(checked) => setNewProductSendPriceAlerts(Boolean(checked))}
                  />
                  Enviar alertas de preço
                </label>
              </form>

              <div className="rounded-md border bg-white">
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
                              className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-sm"
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
                            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                              <Bell className="h-3 w-3 mr-1" /> Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
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
                              <Pencil className="h-4 w-4 text-blue-600" />
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
                              <History className="h-4 w-4 text-purple-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Renomear Lista</DialogTitle>
            <DialogDescription>Altere o nome da sua lista de desejo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
            <DialogDescription>Atualize o nome e preço do item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                type="number"
                step="0.01"
                min="0.01"
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
            <label className="flex items-center gap-2 text-sm text-slate-700">
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
          <DialogHeader>
            <DialogTitle>Histórico de Preço</DialogTitle>
            <DialogDescription>
              {historyModal?.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : productHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                Nenhum histórico de preço registrado ainda.
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
                      formatter={(value: number) => [formatCurrency(value), 'Preço']}
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

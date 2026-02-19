import { useMemo, useState } from 'react';
import {
  useCreateWishlist,
  useCreateWishlistProduct,
  useDeleteWishlist,
  useDeleteWishlistProduct,
  useSearchStoreProducts,
  useUpdateWishlist,
  useUpdateWishlistProduct,
  useWishlists,
} from '@/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WishlistStore, WishlistStoreSearchResult } from '@/types/Wishlist';
import { ExternalLink, Gift, Pencil, Plus, Search, Trash2 } from 'lucide-react';

const STORE_LABELS: Record<WishlistStore, string> = {
  AMAZON: 'Amazon',
  MERCADOLIVRE: 'Mercado Livre',
  SHOPEE: 'Shopee',
  SHEIN: 'Shein',
};

export const WishlistPage = () => {
  const { data: wishlists = [], isLoading } = useWishlists();
  const createWishlist = useCreateWishlist();
  const updateWishlist = useUpdateWishlist();
  const deleteWishlist = useDeleteWishlist();
  const createProduct = useCreateWishlistProduct();
  const updateProduct = useUpdateWishlistProduct();
  const deleteProduct = useDeleteWishlistProduct();
  const searchStoreProducts = useSearchStoreProducts();

  const [newWishlistName, setNewWishlistName] = useState('');
  const [selectedWishlistId, setSelectedWishlistId] = useState<number | null>(null);

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStore, setSearchStore] = useState<WishlistStore>('MERCADOLIVRE');
  const [searchResults, setSearchResults] = useState<WishlistStoreSearchResult[]>([]);

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
      alert('Falha ao criar lista de desejo');
    }
  };

  const handleRenameWishlist = async (wishlistId: number, currentName: string) => {
    const nextName = prompt('Novo nome da lista:', currentName);
    if (!nextName || !nextName.trim()) return;

    try {
      await updateWishlist.mutateAsync({ id: wishlistId, data: { name: nextName.trim() } });
    } catch {
      alert('Falha ao atualizar lista de desejo');
    }
  };

  const handleDeleteWishlist = async (wishlistId: number) => {
    if (!confirm('Deseja excluir esta lista de desejo e todos os itens dela?')) return;

    try {
      await deleteWishlist.mutateAsync(wishlistId);
    } catch {
      alert('Falha ao excluir lista de desejo');
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
        },
      });

      setNewProductName('');
      setNewProductPrice('');
    } catch {
      alert('Falha ao adicionar item na wishlist');
    }
  };

  const handleSearchProducts = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const results = await searchStoreProducts.mutateAsync({
        query: searchQuery.trim(),
        store: searchStore,
      });

      setSearchResults(results);
    } catch {
      alert('Falha ao pesquisar produtos na loja');
    }
  };

  const handleAddSearchedProduct = async (product: WishlistStoreSearchResult) => {
    if (!activeWishlistId) {
      alert('Selecione uma lista de desejo primeiro');
      return;
    }

    let priceToUse = product.price;

    if (!priceToUse || priceToUse <= 0) {
      const typedPrice = prompt(
        `Preço não encontrado para ${product.name}. Informe o preço manualmente:`,
      );
      if (!typedPrice) return;

      const parsedPrice = Number(typedPrice.replace(',', '.'));
      if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
        alert('Preço inválido');
        return;
      }

      priceToUse = parsedPrice;
    }

    try {
      await createProduct.mutateAsync({
        wishlistId: activeWishlistId,
        data: {
          name_product: `${product.name} (${STORE_LABELS[product.store]})`,
          price: priceToUse,
        },
      });
    } catch {
      alert('Falha ao adicionar produto pesquisado na wishlist');
    }
  };

  const handleUpdateProduct = async (
    wishlistId: number,
    productId: number,
    currentName: string,
    currentPrice: number,
  ) => {
    const nextName = prompt('Novo nome do item:', currentName);
    if (!nextName || !nextName.trim()) return;

    const nextPriceRaw = prompt('Novo preço do item:', String(currentPrice));
    if (!nextPriceRaw) return;

    const parsedPrice = Number(nextPriceRaw);
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      alert('Preço inválido');
      return;
    }

    try {
      await updateProduct.mutateAsync({
        wishlistId,
        productId,
        data: {
          name_product: nextName.trim(),
          price: parsedPrice,
        },
      });
    } catch {
      alert('Falha ao atualizar item da wishlist');
    }
  };

  const handleDeleteProduct = async (wishlistId: number, productId: number) => {
    if (!confirm('Deseja remover este item da wishlist?')) return;

    try {
      await deleteProduct.mutateAsync({ wishlistId, productId });
    } catch {
      alert('Falha ao remover item da wishlist');
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
        <div className="text-center py-10">Carregando wishlist...</div>
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
                const isActive = wishlist.id === selectedWishlistId;

                return (
                  <div
                    key={wishlist.id}
                    className={`rounded-lg border p-3 transition ${
                      isActive ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'
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
                        onClick={() => handleRenameWishlist(wishlist.id, wishlist.name)}
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600"
                        onClick={() => handleDeleteWishlist(wishlist.id)}
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
              <form
                onSubmit={handleSearchProducts}
                className="grid gap-3 rounded-lg border p-3 bg-slate-50 sm:grid-cols-[170px_1fr_auto]"
              >
                <Select
                  value={searchStore}
                  onValueChange={(value) => setSearchStore(value as WishlistStore)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMAZON">Amazon</SelectItem>
                    <SelectItem value="MERCADOLIVRE">Mercado Livre</SelectItem>
                    <SelectItem value="SHOPEE">Shopee</SelectItem>
                    <SelectItem value="SHEIN">Shein</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Pesquisar por nome do produto"
                />
                <Button type="submit" disabled={searchStoreProducts.isPending}>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
              </form>

              {searchResults.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {searchResults.map((result) => (
                    <Card key={`${result.store}-${result.url}`} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="aspect-square bg-slate-100 border-b overflow-hidden">
                          {result.image ? (
                            <img
                              src={result.image}
                              alt={result.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                              Sem imagem
                            </div>
                          )}
                        </div>
                        <div className="p-4 space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">{STORE_LABELS[result.store]}</p>
                            <p className="font-medium text-sm line-clamp-2">{result.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-3 mt-1">
                              {result.description}
                            </p>
                          </div>

                          <p className="text-lg font-bold text-slate-900">
                            {result.price ? formatCurrency(result.price) : 'Preço não encontrado'}
                          </p>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => window.open(result.url, '_blank', 'noopener,noreferrer')}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleAddSearchedProduct(result)}
                              disabled={!activeWishlistId || createProduct.isPending}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <form onSubmit={handleCreateProduct} className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
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
              </form>

              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWishlist?.products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name_product}</TableCell>
                        <TableCell>{formatCurrency(Number(product.price))}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                handleUpdateProduct(
                                  selectedWishlist.id,
                                  product.id,
                                  product.name_product,
                                  Number(product.price),
                                )
                              }
                            >
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => handleDeleteProduct(selectedWishlist.id, product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!selectedWishlist?.products.length && (
                      <TableRow>
                        <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
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
    </div>
  );
};

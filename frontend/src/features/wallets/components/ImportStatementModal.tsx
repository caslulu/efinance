import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  Loader2,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import {
  useCategories,
  useConfirmStatementImport,
  usePreviewStatementImport,
} from "@/hooks";
import type { Category } from "@/types/Category";
import type {
  StatementImportPreview,
  StatementImportPreviewRow,
} from "@/types/Transaction";
import type { Wallet } from "@/types/Wallet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EditableImportRow = StatementImportPreviewRow & {
  category_id: string;
  selected: boolean;
  value_input: string;
  description_input: string;
  date_input: string;
};

interface ImportStatementModalProps {
  wallet: Wallet | null;
  open: boolean;
  onClose: () => void;
}

export function ImportStatementModal({
  wallet,
  open,
  onClose,
}: ImportStatementModalProps) {
  const previewImport = usePreviewStatementImport();
  const confirmImport = useConfirmStatementImport();
  const { data: categories = [] } = useCategories();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatementImportPreview | null>(null);
  const [rows, setRows] = useState<EditableImportRow[]>([]);

  const resetState = () => {
    setSelectedFile(null);
    setPreview(null);
    setRows([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const rowsToImport = useMemo(
    () => rows.filter((row) => row.selected),
    [rows],
  );
  const duplicateRows = useMemo(
    () => rows.filter((row) => row.duplicateMatches.length > 0),
    [rows],
  );
  const selectedDuplicates = useMemo(
    () => duplicateRows.filter((row) => row.selected).length,
    [duplicateRows],
  );

  const updateRow = (
    sourceId: string,
    updater: (row: EditableImportRow) => EditableImportRow,
  ) => {
    setRows((current) =>
      current.map((row) => (row.source_id === sourceId ? updater(row) : row)),
    );
  };

  const handlePreview = async () => {
    if (!wallet || !selectedFile) {
      toast.warning("Selecione um arquivo OFX ou CSV.");
      return;
    }

    try {
      const result = await previewImport.mutateAsync({
        walletId: wallet.id,
        file: selectedFile,
      });

      setPreview(result);
      setRows(
        result.rows.map((row) => ({
          ...row,
          category_id: "",
          selected: row.duplicateMatches.length === 0,
          value_input: row.value.toFixed(2),
          description_input: row.description || "",
          date_input: row.transaction_date,
        })),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Falha ao ler o extrato."));
    }
  };

  const handleConfirm = async () => {
    if (!wallet) return;

    if (rowsToImport.length === 0) {
      toast.message("Nenhuma transação selecionada para importação.");
      return;
    }

    const parsedRows = [];

    for (const row of rowsToImport) {
      const value = parseImportValue(row.value_input);
      if (value === null) {
        toast.warning(
          `Valor inválido na linha ${row.description_input || row.source_id}.`,
        );
        return;
      }

      if (!row.date_input) {
        toast.warning(
          `Data inválida na linha ${row.description_input || row.source_id}.`,
        );
        return;
      }

      parsedRows.push({
        transaction_date: `${row.date_input}T12:00:00.000Z`,
        value,
        transaction_type: row.transaction_type,
        description: row.description_input.trim() || null,
        category_id: row.category_id ? Number(row.category_id) : null,
        is_recurring: row.is_recurring || false,
        installment_total: row.installment_total || undefined,
        installment_number: row.installment_number || undefined,
      });
    }

    try {
      const result = await confirmImport.mutateAsync({
        walletId: wallet.id,
        rows: parsedRows,
      });

      if (result.failedCount > 0) {
        toast.warning(
          `${result.importedCount} importadas e ${result.failedCount} com falha.`,
        );
      } else {
        toast.success(`${result.importedCount} transação(ões) importadas.`);
      }

      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "Falha ao confirmar importação."));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent className="max-w-7xl overflow-hidden border-emerald-500/20 bg-slate-950 text-slate-50">
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            Importar extrato em {wallet?.name || "carteira"}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            CSV e OFX agora caem em uma mesa de revisão editável. Ajuste nome,
            valor, data e categoria antes de trazer cada linha para a carteira.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="grid gap-5 py-5">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(6,95,70,0.08),rgba(15,23,42,0.94))] p-6">
              <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="relative grid gap-4 md:grid-cols-[1.15fr_0.85fr] md:items-end">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">
                    Mapping Table
                  </p>
                  <h3 className="text-3xl font-semibold leading-tight text-white">
                    Cada transação do arquivo vira uma linha editável antes de
                    entrar na carteira.
                  </h3>
                  <p className="max-w-2xl text-sm leading-6 text-slate-300">
                    Para CSV, isso resolve o principal problema: você enxerga o
                    mapeamento real em tabela e decide linha por linha o que
                    entra, com um botão de adição na direita.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Arquivo
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed border-emerald-400/30 bg-emerald-400/5 p-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                      <UploadCloud className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Input
                        type="file"
                        accept=".ofx,.csv"
                        className="border-white/10 bg-transparent text-slate-100 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-100 hover:file:bg-emerald-500/30"
                        onChange={(event) => {
                          setSelectedFile(event.target.files?.[0] || null);
                        }}
                      />
                      <p className="mt-2 truncate text-xs text-slate-400">
                        {selectedFile?.name ||
                          "Selecione um arquivo OFX ou CSV."}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="mt-4 w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                    disabled={!selectedFile || previewImport.isPending}
                    onClick={handlePreview}
                  >
                    {previewImport.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Lendo arquivo
                      </>
                    ) : (
                      "Abrir tabela"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard
                label="Entrada"
                value="OFX + CSV"
                helper="CSV vai para edição direta em tabela"
              />
              <MetricCard
                label="Edição"
                value="valor, data, nome, categoria"
                helper="todos ajustáveis antes da confirmação"
              />
              <MetricCard
                label="Ação"
                value="+ na direita"
                helper="linha selecionada entra na importação"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-5 py-5">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                label="Arquivo"
                value={preview.fileName}
                helper={preview.format}
              />
              <MetricCard
                label="Linhas"
                value={String(preview.summary.totalRows)}
                helper="lidas do arquivo"
              />
              <MetricCard
                label="Duplicadas"
                value={String(duplicateRows.length)}
                helper={`${selectedDuplicates} marcadas para importar`}
                alert={duplicateRows.length > 0}
              />
              <MetricCard
                label="Importação"
                value={String(rowsToImport.length)}
                helper="selecionadas na tabela"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    Tabela de mapeamento
                  </p>
                  <p className="text-xs text-slate-400">
                    Linhas com possível duplicidade já começam fora da
                    importação. Se quiser trazê-las mesmo assim, clique no `+`
                    da coluna final.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-white/10 bg-transparent text-slate-200 hover:bg-white/10"
                  onClick={() => {
                    setPreview(null);
                    setRows([]);
                  }}
                >
                  Trocar arquivo
                </Button>
              </div>

              <div className="max-h-[56vh] overflow-auto">
                <Table className="min-w-[1180px]">
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="w-[110px] text-slate-300">
                        Tipo
                      </TableHead>
                      <TableHead className="w-[140px] text-slate-300">
                        Data
                      </TableHead>
                      <TableHead className="w-[160px] text-slate-300">
                        Valor
                      </TableHead>
                      <TableHead className="min-w-[280px] text-slate-300">
                        Nome
                      </TableHead>
                      <TableHead className="w-[220px] text-slate-300">
                        Categoria
                      </TableHead>
                      <TableHead className="min-w-[240px] text-slate-300">
                        Conflito
                      </TableHead>
                      <TableHead className="w-[90px] text-right text-slate-300">
                        Add
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const isExpense = row.transaction_type === "EXPENSE";

                      return (
                        <TableRow
                          key={row.source_id}
                          className={`border-white/10 ${
                            row.selected ? "bg-emerald-400/5" : "bg-transparent"
                          }`}
                        >
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`border-0 ${
                                isExpense
                                  ? "bg-rose-400/15 text-rose-200"
                                  : "bg-emerald-400/15 text-emerald-200"
                              }`}
                            >
                              {isExpense ? (
                                <ArrowDownLeft className="mr-1 h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
                              )}
                              {isExpense ? "Despesa" : "Receita"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={row.date_input}
                              className="border-white/10 bg-black/20 text-slate-100"
                              onChange={(event) =>
                                updateRow(row.source_id, (current) => ({
                                  ...current,
                                  date_input: event.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={row.value_input}
                              className="border-white/10 bg-black/20 text-slate-100"
                              onChange={(event) =>
                                updateRow(row.source_id, (current) => ({
                                  ...current,
                                  value_input: event.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Input
                                type="text"
                                value={row.description_input}
                                className="border-white/10 bg-black/20 text-slate-100"
                                placeholder="Nome da transação"
                                onChange={(event) =>
                                  updateRow(row.source_id, (current) => ({
                                    ...current,
                                    description_input: event.target.value,
                                  }))
                                }
                              />
                              {row.duplicateMatches.length > 0 && (
                                <p className="text-[11px] leading-5 text-amber-100/80">
                                  Já existe {row.duplicateMatches.length}{" "}
                                  transação(ões) com mesma data e valor.
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <CategorySelect
                              categories={categories}
                              value={row.category_id}
                              onChange={(value) =>
                                updateRow(row.source_id, (current) => ({
                                  ...current,
                                  category_id: value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {row.duplicateMatches.length > 0 ? (
                              <div className="space-y-2">
                                <Badge
                                  variant="outline"
                                  className="border-amber-300/25 bg-amber-300/10 text-amber-100"
                                >
                                  possível duplicado
                                </Badge>
                                <div className="space-y-1 text-xs text-slate-400">
                                  {row.duplicateMatches.map((match) => (
                                    <p key={match.id}>
                                      #{match.id} ·{" "}
                                      {match.description ||
                                        "Transação existente"}{" "}
                                      ·{" "}
                                      {new Date(
                                        `${match.transaction_date}T12:00:00`,
                                      ).toLocaleDateString("pt-BR")}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">
                                sem conflito
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              aria-label={
                                row.selected
                                  ? "Remover da importação"
                                  : "Adicionar à importação"
                              }
                              className={`ml-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors ${
                                row.selected
                                  ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
                                  : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                              }`}
                              onClick={() =>
                                updateRow(row.source_id, (current) => ({
                                  ...current,
                                  selected: !current.selected,
                                }))
                              }
                            >
                              {row.selected ? (
                                <Plus className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-300">
                {rowsToImport.length} linha(s) selecionadas para importação. Use
                o botão da direita para incluir ou remover cada transação.
              </p>
              <Button
                className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                disabled={confirmImport.isPending || rowsToImport.length === 0}
                onClick={handleConfirm}
              >
                {confirmImport.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando
                  </>
                ) : (
                  `Importar ${rowsToImport.length}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="flex h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-300/40"
    >
      <option value="">Outro / automático</option>
      {categories.map((category) => (
        <option key={category.id} value={String(category.id)}>
          {category.name}
        </option>
      ))}
    </select>
  );
}

function parseImportValue(value: string): number | null {
  const sanitized = value.trim().replace(/[^\d,.-]/g, "");
  if (!sanitized) return null;

  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");

  let normalized = sanitized;
  if (hasComma && hasDot) {
    normalized = sanitized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = sanitized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function MetricCard({
  label,
  value,
  helper,
  alert = false,
}: {
  label: string;
  value: string;
  helper: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        alert
          ? "border-amber-300/25 bg-amber-300/5"
          : "border-white/10 bg-white/5"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 truncate text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

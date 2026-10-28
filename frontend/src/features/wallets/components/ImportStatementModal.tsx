import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  Files,
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
  useAnalyzeStatementImport,
} from "@/hooks";
import type { Category } from "@/types/Category";
import type {
  StatementImportPreview,
  StatementImportPreviewRow,
  StatementImportConfirmRow,
} from "@/types/Transaction";
import type { Card } from "@/types/Card";
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

type EditableImportRow = Omit<StatementImportPreviewRow, "category_id"> & {
  category_id: string;
  selected: boolean;
  batchDuplicate: boolean;
  value_input: string;
  description_input: string;
  date_input: string;
};

interface ImportStatementModalProps {
  wallet: Wallet | null;
  card?: Card | null;
  open: boolean;
  onClose: () => void;
}

export function ImportStatementModal({
  wallet,
  card,
  open,
  onClose,
}: ImportStatementModalProps) {
  const previewImport = usePreviewStatementImport();
  const confirmImport = useConfirmStatementImport();
  const analyzeImport = useAnalyzeStatementImport();
  const { data: categories = [] } = useCategories();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<StatementImportPreview[]>([]);
  const [rows, setRows] = useState<EditableImportRow[]>([]);
  const [sourceType, setSourceType] = useState<"file" | "text">("file");
  const [mode, setMode] = useState<"conventional" | "assisted" | "automatic">(
    "assisted",
  );
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [clarifications, setClarifications] = useState<Record<number, string>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);

  const resetState = () => {
    requestVersion.current++;
    setSelectedFiles([]);
    setPreviews([]);
    setRows([]);
    setMessage("");
    setAnswers({});
    setClarifications({});
    setBusy(false);
  };

  const handleClose = () => {
    if (confirmImport.isPending) return;
    resetState();
    onClose();
  };

  const rowsToImport = useMemo(
    () => rows.filter((row) => row.selected),
    [rows],
  );
  const duplicateRows = useMemo(
    () =>
      rows.filter(
        (row) => row.duplicateMatches.length > 0 || row.batchDuplicate,
      ),
    [rows],
  );
  const selectedDuplicates = useMemo(
    () => duplicateRows.filter((row) => row.selected).length,
    [duplicateRows],
  );
  const walletGuidance = getWalletImportGuidance(wallet, card);
  const importTargetName = card?.name || wallet?.name || "carteira";

  const updateRow = (
    sourceId: string,
    updater: (row: EditableImportRow) => EditableImportRow,
  ) => {
    setRows((current) =>
      current.map((row) => (row.source_id === sourceId ? updater(row) : row)),
    );
  };

  const handlePreview = async () => {
    if (
      !wallet ||
      (sourceType === "file" ? selectedFiles.length === 0 : !message.trim())
    ) {
      toast.warning("Selecione um arquivo ou descreva seus lançamentos.");
      return;
    }
    const version = ++requestVersion.current;
    setBusy(true);
    try {
      const results: StatementImportPreview[] = [];
      if (sourceType === "text") {
        results.push(
          await analyzeImport.mutateAsync({
            walletId: wallet.id,
            cardId: card?.id,
            message,
            mode: mode === "automatic" ? "automatic" : "assisted",
          }),
        );
      } else {
        for (const file of selectedFiles) {
          if (version !== requestVersion.current) return;
          if (mode === "conventional") {
            results.push(
              await previewImport.mutateAsync({
                walletId: wallet.id,
                cardId: card?.id,
                file,
              }),
            );
          } else {
            results.push(
              await analyzeImport.mutateAsync({
                walletId: wallet.id,
                cardId: card?.id,
                file,
                mode,
              }),
            );
          }
        }
      }
      if (version !== requestVersion.current) return;
      setPreviews(results);
      setRows(buildEditableBatchRows(results));
      setAnswers({});
      setClarifications({});
    } catch (error) {
      if (version === requestVersion.current)
        toast.error(getErrorMessage(error, "Falha ao ler os lançamentos."));
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  };

  const handleClarify = async (index: number) => {
    if (!wallet || !answers[index]?.trim()) return;
    const clarification = [
      clarifications[index],
      `Perguntas: ${(previews[index].questions || []).join("; ")}\nResposta: ${answers[index]}`,
    ]
      .filter(Boolean)
      .join("\n");
    if (clarification.length > 20000) {
      toast.warning(
        "As respostas ficaram muito longas. Reinicie a análise com um texto mais curto.",
      );
      return;
    }
    const version = ++requestVersion.current;
    setBusy(true);
    try {
      const result = await analyzeImport.mutateAsync({
        walletId: wallet.id,
        cardId: card?.id,
        file: sourceType === "file" ? selectedFiles[index] : undefined,
        message: sourceType === "text" ? message : undefined,
        clarification,
        mode: "assisted",
      });
      if (version !== requestVersion.current) return;
      const next = previews.map((preview, i) =>
        i === index ? result : preview,
      );
      setPreviews(next);
      setRows((current) => {
        const unchanged = new Map(
          current
            .filter((row) => !row.source_id.startsWith(`${index}::`))
            .map((row) => [row.source_id, row]),
        );
        return buildEditableBatchRows(next).map(
          (row) => unchanged.get(row.source_id) || row,
        );
      });
      setClarifications((current) => ({ ...current, [index]: clarification }));
      setAnswers((current) => ({ ...current, [index]: "" }));
    } catch (error) {
      if (version === requestVersion.current)
        toast.error(getErrorMessage(error, "Falha ao atualizar a análise."));
    } finally {
      if (version === requestVersion.current) setBusy(false);
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

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date_input) ||
        Number.isNaN(Date.parse(row.date_input)) ||
        new Date(row.date_input).toISOString().slice(0, 10) !== row.date_input
      ) {
        toast.warning(
          `Data inválida na linha ${row.description_input || row.source_id}.`,
        );
        return;
      }

      if (!row.transaction_type) {
        toast.warning(
          "Escolha receita ou despesa para os lançamentos selecionados.",
        );
        return;
      }
      if (
        (row.installment_total &&
          (!Number.isInteger(row.installment_total) ||
            row.installment_total < 2 ||
            row.installment_total > 600)) ||
        (row.installment_number &&
          (!Number.isInteger(row.installment_number) ||
            row.installment_number < 1 ||
            row.installment_number > (row.installment_total || 1)))
      ) {
        toast.warning(
          "Confira o número e o total de parcelas dos lançamentos selecionados.",
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
        cardId: card?.id,
        rows: parsedRows,
      });

      if (result.failedCount > 0) {
        toast.warning(
          `${result.importedCount} importadas e ${result.failedCount} com falha.`,
        );
        // Keep only failed rows selected so a retry cannot import successful rows again.
        const failures = new Map<string, number>();
        const rowKey = (row: Partial<StatementImportConfirmRow>) =>
          JSON.stringify([
            row.transaction_date,
            row.value,
            row.transaction_type,
            row.description || "",
            row.category_id ?? null,
            row.is_recurring || false,
            row.installment_total ?? null,
            row.installment_number ?? null,
          ]);
        result.failures.forEach(({ row }) =>
          failures.set(rowKey(row), (failures.get(rowKey(row)) || 0) + 1),
        );
        const failedIds = new Set<string>();
        for (let i = 0; i < parsedRows.length; i++) {
          const key = rowKey(parsedRows[i]);
          if ((failures.get(key) || 0) > 0) {
            failedIds.add(rowsToImport[i].source_id);
            failures.set(key, failures.get(key)! - 1);
          }
        }
        setRows((current) =>
          current.filter((row) => failedIds.has(row.source_id)),
        );
        return;
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
      <DialogContent className="max-h-[92dvh] max-w-7xl overflow-y-auto border-emerald-500/20 bg-slate-950 text-slate-50">
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            Adicionar lançamentos em {importTargetName}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            {walletGuidance.description}
          </DialogDescription>
        </DialogHeader>

        {previews.length === 0 ? (
          <div className="grid gap-5 py-5">
            <div className="grid gap-4 rounded-2xl border border-white/10 p-4 md:grid-cols-2">
              <div>
                <label htmlFor="import-source" className="mb-2 block text-sm">
                  Como deseja adicionar?
                </label>
                <select
                  id="import-source"
                  value={sourceType}
                  disabled={busy}
                  onChange={(event) =>
                    setSourceType(event.target.value as "file" | "text")
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900 p-3"
                >
                  <option value="file">Importar arquivos</option>
                  <option value="text">Descrever em texto</option>
                </select>
              </div>
              <div>
                <label htmlFor="import-mode" className="mb-2 block text-sm">
                  Modo de leitura
                </label>
                <select
                  id="import-mode"
                  value={
                    sourceType === "text" && mode === "conventional"
                      ? "assisted"
                      : mode
                  }
                  disabled={busy}
                  onChange={(event) =>
                    setMode(event.target.value as typeof mode)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900 p-3"
                >
                  <option value="assisted">
                    IA assistida — pergunta quando houver dúvidas
                  </option>
                  <option value="automatic">
                    IA automática — prepara a prévia sem perguntas
                  </option>
                  {sourceType === "file" && (
                    <option value="conventional">
                      Convencional — OFX/CSV sem IA
                    </option>
                  )}
                </select>
              </div>
              <p className="text-xs text-slate-400 md:col-span-2">
                {mode === "conventional" && sourceType === "file"
                  ? "Leitura de OFX/CSV sem envio para IA."
                  : "O conteúdo enviado e os nomes das suas categorias serão analisados pelo serviço de IA configurado. Revise os valores antes de salvar."}
              </p>
            </div>
            {sourceType === "text" ? (
              <div className="space-y-3 rounded-2xl border border-emerald-500/20 p-5">
                <label htmlFor="import-message" className="block font-medium">
                  Descreva suas entradas e gastos
                </label>
                <textarea
                  id="import-message"
                  value={message}
                  disabled={busy}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={20000}
                  rows={5}
                  placeholder="Ontem gastei R$ 85,90 no mercado e hoje recebi R$ 3.000 de salário."
                  className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm"
                />
                <Button
                  disabled={busy || !message.trim()}
                  onClick={handlePreview}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analisando
                    </>
                  ) : (
                    "Organizar lançamentos"
                  )}
                </Button>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(6,95,70,0.08),rgba(15,23,42,0.94))] p-6">
                <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
                <div className="relative grid gap-4 md:grid-cols-[1.15fr_0.85fr] md:items-end">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">
                      Importação revisada
                    </p>
                    <h3 className="text-3xl font-semibold leading-tight text-white">
                      {walletGuidance.title}
                    </h3>
                    <p className="max-w-2xl text-sm leading-6 text-slate-300">
                      {walletGuidance.helper}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                    <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Arquivos
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-emerald-400/30 bg-emerald-400/5 p-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                        {selectedFiles.length > 1 ? (
                          <Files className="h-5 w-5" />
                        ) : (
                          <UploadCloud className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Input
                          type="file"
                          accept={
                            mode === "conventional"
                              ? ".ofx,.csv"
                              : ".ofx,.csv,.xlsx,.txt"
                          }
                          disabled={busy}
                          aria-label="Arquivos para importar"
                          multiple
                          className="border-white/10 bg-transparent text-slate-100 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-100 hover:file:bg-emerald-500/30"
                          onChange={(event) => {
                            setSelectedFiles(
                              Array.from(event.target.files || []),
                            );
                          }}
                        />
                        <p className="mt-2 truncate text-xs text-slate-400">
                          {selectedFiles.length > 0
                            ? formatSelectedFiles(selectedFiles)
                            : walletGuidance.filePrompt}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                      disabled={selectedFiles.length === 0 || busy}
                      onClick={handlePreview}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Lendo arquivos
                        </>
                      ) : mode === "conventional" ? (
                        "Abrir tabela única"
                      ) : (
                        "Analisar arquivos com IA"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard
                label="Principal"
                value={walletGuidance.primary}
                helper={walletGuidance.primaryHelper}
              />
              <MetricCard
                label="Edição"
                value="valor, data, nome, categoria"
                helper="todos ajustáveis antes da confirmação"
              />
              <MetricCard
                label="Controle"
                value="confirmação explícita"
                helper="nada entra sem passar pela tabela"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-5 py-5">
            {previews.map((preview, index) => (
              <div key={index} className="space-y-3">
                {(preview.questions?.length || 0) > 0 && (
                  <div className="space-y-3 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
                    <p className="font-medium">
                      Vamos esclarecer — {preview.fileName}
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                      {preview.questions!.map((question, i) => (
                        <li key={i}>{question}</li>
                      ))}
                    </ul>
                    <label
                      htmlFor={`clarification-${index}`}
                      className="block text-sm"
                    >
                      Sua resposta
                    </label>
                    <textarea
                      id={`clarification-${index}`}
                      value={answers[index] || ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [index]: event.target.value,
                        }))
                      }
                      disabled={busy || confirmImport.isPending}
                      maxLength={10000}
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm"
                    />
                    <Button
                      disabled={
                        busy ||
                        confirmImport.isPending ||
                        !answers[index]?.trim()
                      }
                      onClick={() => handleClarify(index)}
                    >
                      {busy ? "Analisando…" : "Responder e atualizar prévia"}
                    </Button>
                    <p className="text-xs text-slate-400">
                      A resposta refaz a prévia deste arquivo. Faça os ajustes
                      manuais depois de esclarecer as dúvidas.
                    </p>
                  </div>
                )}
                {(preview.warnings?.length || 0) > 0 && (
                  <ul className="list-disc space-y-1 rounded-xl border border-amber-300/20 p-4 pl-8 text-sm text-amber-100">
                    {preview.warnings!.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {previews.some((preview) => preview.analysis === "ai") && (
              <p className="text-sm text-slate-300">
                Confira os trechos de origem. Lançamentos com dúvidas começam
                desmarcados; ajuste os campos e selecione apenas os que deseja
                salvar.
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                label="Arquivos"
                value={String(previews.length)}
                helper={summarizePreviewFormats(previews)}
              />
              <MetricCard
                label="Linhas"
                value={String(rows.length)}
                helper="lidas dos arquivos"
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
                    Revisão antes de importar
                  </p>
                  <p className="text-xs text-slate-400">
                    Linhas com possível duplicidade já começam fora da
                    importação. Se quiser trazê-las mesmo assim, use o botão da
                    coluna final.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-white/10 bg-transparent text-slate-200 hover:bg-white/10"
                  disabled={busy || confirmImport.isPending}
                  onClick={() => {
                    setPreviews([]);
                    setRows([]);
                  }}
                >
                  Alterar origem
                </Button>
              </div>

              <fieldset
                disabled={busy || confirmImport.isPending}
                className="max-h-[56vh] min-w-0 overflow-auto"
              >
                <Table className="min-w-[1180px]">
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="w-[110px] text-slate-300">
                        Tipo
                      </TableHead>
                      <TableHead className="w-[180px] text-slate-300">
                        Arquivo
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
                              {row.transaction_type
                                ? isExpense
                                  ? "Despesa"
                                  : "Receita"
                                : "Definir tipo"}
                            </Badge>
                            <select
                              aria-label="Tipo do lançamento"
                              value={row.transaction_type || ""}
                              onChange={(event) =>
                                updateRow(row.source_id, (current) => ({
                                  ...current,
                                  transaction_type: event.target.value as
                                    | "INCOME"
                                    | "EXPENSE",
                                }))
                              }
                              className="mt-2 w-full rounded border border-white/10 bg-slate-900 p-1 text-xs"
                            >
                              <option value="" disabled>
                                Escolha
                              </option>
                              <option value="EXPENSE">Despesa</option>
                              <option value="INCOME">Receita</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <span className="block max-w-[170px] truncate text-xs text-slate-400">
                              {row.source_file || "arquivo"}
                            </span>
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
                                maxLength={255}
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
                              {row.source_ref && (
                                <p className="max-w-sm whitespace-pre-wrap break-words text-xs text-slate-400">
                                  Origem: {row.source_ref}
                                </p>
                              )}
                              {row.needs_review && (
                                <p className="text-xs text-amber-200">
                                  Confira as dúvidas antes de selecionar.
                                </p>
                              )}
                              <details className="text-xs text-slate-400">
                                <summary className="cursor-pointer">
                                  Recorrência e parcelas
                                </summary>
                                <label className="my-2 flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={row.is_recurring || false}
                                    onChange={(event) =>
                                      updateRow(row.source_id, (current) => ({
                                        ...current,
                                        is_recurring: event.target.checked,
                                      }))
                                    }
                                  />
                                  Recorrente
                                </label>
                                <div className="flex gap-2">
                                  <label>
                                    Parcela
                                    <input
                                      aria-label="Número da parcela"
                                      type="number"
                                      min={1}
                                      max={600}
                                      value={row.installment_number || ""}
                                      onChange={(event) =>
                                        updateRow(row.source_id, (current) => ({
                                          ...current,
                                          installment_number: event.target.value
                                            ? Number(event.target.value)
                                            : undefined,
                                        }))
                                      }
                                      className="mt-1 w-20 rounded bg-slate-900 p-1"
                                    />
                                  </label>
                                  <label>
                                    Total
                                    <input
                                      aria-label="Total de parcelas"
                                      type="number"
                                      min={2}
                                      max={600}
                                      value={row.installment_total || ""}
                                      onChange={(event) =>
                                        updateRow(row.source_id, (current) => ({
                                          ...current,
                                          installment_total: event.target.value
                                            ? Number(event.target.value)
                                            : undefined,
                                        }))
                                      }
                                      className="mt-1 w-20 rounded bg-slate-900 p-1"
                                    />
                                  </label>
                                </div>
                              </details>
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
                            {row.duplicateMatches.length > 0 ||
                            row.batchDuplicate ? (
                              <div className="space-y-2">
                                <Badge
                                  variant="outline"
                                  className="border-amber-300/25 bg-amber-300/10 text-amber-100"
                                >
                                  {row.batchDuplicate
                                    ? "duplicado no lote"
                                    : "possível duplicado"}
                                </Badge>
                                {row.duplicateMatches.length > 0 && (
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
                                )}
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
              </fieldset>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-300">
                {rowsToImport.length} linha(s) selecionadas para importação. Use
                o botão da direita para incluir ou remover cada transação.
              </p>
              <Button
                className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                disabled={
                  busy || confirmImport.isPending || rowsToImport.length === 0
                }
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

function getWalletImportGuidance(wallet: Wallet | null, card?: Card | null) {
  if (card) {
    return {
      title: "Importe a fatura do cartão e revise antes de salvar.",
      description:
        "As linhas importadas serão vinculadas ao cartão e entrarão na fatura, sem baixar o saldo da conta imediatamente.",
      helper:
        "Envie OFX, CSV, XLSX ou TXT com IA, ou use a leitura convencional de OFX/CSV. Confira estornos e pagamentos antes de selecionar as linhas.",
      filePrompt: "OFX/CSV, ou XLSX/TXT com IA. Até 5 MB por arquivo.",
      primary: "Fatura",
      primaryHelper: "vinculada ao cartão",
    };
  }

  const isMealVoucher = wallet?.type === "MEAL_VOUCHER";

  if (isMealVoucher) {
    return {
      title: "Importe os gastos do seu vale alimentação.",
      description:
        "Os lançamentos serão registrados nesta carteira de vale alimentação.",
      helper:
        "Cada despesa reduz o saldo do benefício. Você pode enviar OFX, CSV, XLSX ou TXT com IA, ou usar a leitura convencional de OFX/CSV.",
      filePrompt: "OFX/CSV, ou XLSX/TXT com IA. Até 5 MB por arquivo.",
      primary: "Vale alimentação",
      primaryHelper: "gastos vinculados ao benefício",
    };
  }

  return {
    title: "Envie seus arquivos e revise antes de salvar.",
    description:
      "O arquivo vira uma tabela editável para você decidir exatamente quais entradas e saídas entram.",
    helper:
      "A IA interpreta OFX, CSV, XLSX e TXT. A leitura convencional continua disponível para OFX/CSV. Dúvidas e possíveis duplicidades começam desmarcadas.",
    filePrompt: "OFX/CSV, ou XLSX/TXT com IA. Até 5 MB por arquivo.",
    primary: "Sua carteira",
    primaryHelper: "entradas e gastos no destino selecionado",
  };
}

function buildEditableBatchRows(previews: StatementImportPreview[]) {
  const seen = new Map<string, number>();

  const editableRows = previews.flatMap((preview, previewIndex) =>
    preview.rows.map((row) => {
      const duplicateKey = buildBatchDuplicateKey(row);
      const seenCount = seen.get(duplicateKey) || 0;
      const batchDuplicate = seenCount > 0;
      seen.set(duplicateKey, seenCount + 1);

      return {
        ...row,
        source_id: `${previewIndex}::${row.source_id}`,
        source_file: preview.fileName,
        category_id: row.category_id ? String(row.category_id) : "",
        selected:
          row.duplicateMatches.length === 0 &&
          !batchDuplicate &&
          !row.needs_review,
        batchDuplicate,
        value_input: row.value?.toFixed(2) || "",
        description_input: row.description || "",
        date_input: row.transaction_date || "",
      };
    }),
  );

  return groupRowsByDuplicateKey(editableRows);
}

function groupRowsByDuplicateKey(rows: EditableImportRow[]) {
  const groups = new Map<
    string,
    {
      firstIndex: number;
      rows: EditableImportRow[];
      hasConflict: boolean;
    }
  >();

  rows.forEach((row, index) => {
    const duplicateKey = buildBatchDuplicateKey(row);
    const currentGroup = groups.get(duplicateKey);
    const hasConflict = row.batchDuplicate || row.duplicateMatches.length > 0;

    if (currentGroup) {
      currentGroup.rows.push(row);
      currentGroup.hasConflict = currentGroup.hasConflict || hasConflict;
      return;
    }

    groups.set(duplicateKey, {
      firstIndex: index,
      rows: [row],
      hasConflict,
    });
  });

  return Array.from(groups.values())
    .sort((left, right) => {
      const leftHasConflict = left.hasConflict || left.rows.length > 1;
      const rightHasConflict = right.hasConflict || right.rows.length > 1;

      if (leftHasConflict !== rightHasConflict) {
        return leftHasConflict ? -1 : 1;
      }

      return left.firstIndex - right.firstIndex;
    })
    .flatMap((group) => group.rows);
}

function buildBatchDuplicateKey(
  row: Pick<
    StatementImportPreviewRow,
    "transaction_date" | "value" | "transaction_type"
  >,
) {
  return `${row.transaction_date}|${Number(row.value).toFixed(2)}|${row.transaction_type}`;
}

function formatSelectedFiles(files: File[]) {
  if (files.length === 1) return files[0].name;
  return `${files.length} arquivos selecionados`;
}

function summarizePreviewFormats(previews: StatementImportPreview[]) {
  const formats = Array.from(
    new Set(previews.map((preview) => preview.format)),
  );
  return formats.join(" + ");
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
  return Number.isFinite(parsed) &&
    parsed > 0 &&
    parsed <= 99999999.99 &&
    Math.abs(Math.round(parsed * 100) - parsed * 100) < 0.000001
    ? parsed
    : null;
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

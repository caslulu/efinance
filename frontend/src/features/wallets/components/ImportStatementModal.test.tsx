import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ImportStatementModal } from "./ImportStatementModal";
import type { StatementImportPreview } from "@/types/Transaction";
import type { Wallet } from "@/types/Wallet";

const mocks = vi.hoisted(() => ({
  analyze: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/hooks", () => ({
  useAnalyzeStatementImport: () => ({
    mutateAsync: mocks.analyze,
    isPending: false,
  }),
  usePreviewStatementImport: () => ({
    mutateAsync: mocks.preview,
    isPending: false,
  }),
  useConfirmStatementImport: () => ({
    mutateAsync: mocks.confirm,
    isPending: false,
  }),
  useCategories: () => ({ data: [{ id: 3, name: "Alimentação" }] }),
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}));

const wallet: Wallet = {
  id: 1,
  user_id: 7,
  name: "Conta",
  type: "BANK",
  actual_cash: 1000,
};
function preview(): StatementImportPreview {
  return {
    walletId: 1,
    walletName: "Conta",
    fileName: "Lançamentos por texto",
    format: "TEXT",
    analysis: "ai",
    summary: {
      totalRows: 1,
      duplicateRows: 0,
      incomeCount: 0,
      expenseCount: 1,
    },
    rows: [
      {
        source_id: "ai-0",
        transaction_date: "2026-10-23",
        value: 85.9,
        transaction_type: "EXPENSE",
        description: "Mercado",
        category_id: 3,
        source_ref: "mercado",
        duplicateMatches: [],
      },
    ],
    questions: [],
    warnings: [],
  };
}

async function describeExpense() {
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByLabelText("Como deseja adicionar?"),
    "text",
  );
  fireEvent.change(screen.getByLabelText("Descreva suas entradas e gastos"), {
    target: { value: "Ontem gastei 85,90 no mercado." },
  });
  return user;
}

describe("ImportStatementModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.analyze.mockResolvedValue(preview());
    mocks.confirm.mockResolvedValue({
      importedCount: 1,
      failedCount: 0,
      failures: [],
    });
  });

  it("creates a draft from text and only saves after explicit confirmation", async () => {
    render(<ImportStatementModal wallet={wallet} open onClose={vi.fn()} />);
    const user = await describeExpense();
    await user.click(
      screen.getByRole("button", { name: "Organizar lançamentos" }),
    );
    expect(await screen.findByText("Origem: mercado")).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Alimentação")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Importar 1" }));
    expect(mocks.confirm).toHaveBeenCalledWith({
      walletId: 1,
      cardId: undefined,
      rows: [
        expect.objectContaining({
          value: 85.9,
          category_id: 3,
          transaction_type: "EXPENSE",
          transaction_date: "2026-10-23T12:00:00.000Z",
        }),
      ],
    });
  });

  it("leaves ambiguous rows unselected and reanalyzes the source with answers", async () => {
    const initial = preview();
    initial.rows[0] = {
      ...initial.rows[0],
      transaction_date: null,
      needs_review: true,
    };
    initial.questions = ["Qual foi a data da compra?"];
    mocks.analyze
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(preview());
    render(<ImportStatementModal wallet={wallet} open onClose={vi.fn()} />);
    const user = await describeExpense();
    await user.click(
      screen.getByRole("button", { name: "Organizar lançamentos" }),
    );
    expect(
      await screen.findByText("Qual foi a data da compra?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar 0" })).toBeDisabled();
    await user.type(
      screen.getByLabelText("Sua resposta"),
      "Foi em 23/10/2026.",
    );
    await user.click(
      screen.getByRole("button", { name: "Responder e atualizar prévia" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Importar 1" })).toBeEnabled(),
    );
    expect(mocks.analyze).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: "Ontem gastei 85,90 no mercado.",
        clarification: expect.stringContaining("Foi em 23/10/2026."),
      }),
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("offers automatic analysis with confirmation", async () => {
    render(<ImportStatementModal wallet={wallet} open onClose={vi.fn()} />);
    const user = await describeExpense();
    await user.selectOptions(
      screen.getByLabelText("Modo de leitura"),
      "automatic",
    );
    await user.click(
      screen.getByRole("button", { name: "Organizar lançamentos" }),
    );
    await screen.findByText("Origem: mercado");
    expect(mocks.analyze).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "automatic" }),
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("keeps conventional OFX/CSV imports available without AI", async () => {
    mocks.preview.mockResolvedValue({
      ...preview(),
      format: "CSV",
      analysis: undefined,
    });
    render(<ImportStatementModal wallet={wallet} open onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByLabelText("Modo de leitura"),
      "conventional",
    );
    const input = screen.getByLabelText("Arquivos para importar");
    expect(input).toHaveAttribute("accept", ".ofx,.csv");
    const file = new File(["date,amount\n2026-10-23,-85.9"], "extrato.csv", {
      type: "text/csv",
    });
    await user.upload(input, file);
    await user.click(
      screen.getByRole("button", { name: "Abrir tabela única" }),
    );
    await screen.findByRole("button", { name: "Importar 1" });
    expect(mocks.preview).toHaveBeenCalledWith({
      walletId: 1,
      cardId: undefined,
      file,
    });
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it("prevents invalid values from being confirmed", async () => {
    render(<ImportStatementModal wallet={wallet} open onClose={vi.fn()} />);
    const user = await describeExpense();
    await user.click(
      screen.getByRole("button", { name: "Organizar lançamentos" }),
    );
    const value = await screen.findByDisplayValue("85.90");
    fireEvent.change(value, { target: { value: "1,234" } });
    await user.click(screen.getByRole("button", { name: "Importar 1" }));
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("Valor inválido"),
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("keeps possible duplicates unselected", async () => {
    const result = preview();
    result.rows[0].duplicateMatches = [
      {
        id: 99,
        description: "Mercado",
        transaction_date: "2026-10-23",
        value: 85.9,
        transaction_type: "EXPENSE",
      },
    ];
    mocks.analyze.mockResolvedValue(result);
    render(<ImportStatementModal wallet={wallet} open onClose={vi.fn()} />);
    const user = await describeExpense();
    await user.click(
      screen.getByRole("button", { name: "Organizar lançamentos" }),
    );
    expect(
      await screen.findByRole("button", { name: "Importar 0" }),
    ).toBeDisabled();
  });

  it("only retains failures after a partially successful import", async () => {
    const result = preview();
    result.rows.push({
      ...result.rows[0],
      source_id: "ai-1",
      value: 50,
      description: "Outro gasto",
    });
    mocks.analyze.mockResolvedValue(result);
    mocks.confirm.mockImplementation(async ({ rows }) => ({
      importedCount: 1,
      failedCount: 1,
      failures: [{ row: rows[1], error: "Falha temporária" }],
    }));
    const close = vi.fn();
    render(<ImportStatementModal wallet={wallet} open onClose={close} />);
    const user = await describeExpense();
    await user.click(
      screen.getByRole("button", { name: "Organizar lançamentos" }),
    );
    await user.click(await screen.findByRole("button", { name: "Importar 2" }));
    await waitFor(() =>
      expect(screen.queryByDisplayValue("85.90")).not.toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("50.00")).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});

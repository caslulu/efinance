import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/api";
import { useCreateBudget, useUpdateBudget } from "./useBudgets";
import { useTransferBetweenWallets } from "./useWallets";
import { useAnalyzeStatementImport } from "./useTransactions";

vi.mock("@/api/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

const mockedPost = vi.mocked(api.post);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe("financial hook contracts", () => {
  beforeEach(() => {
    mockedPost.mockReset().mockResolvedValue({ data: {} });
  });

  it("creates and updates budgets through the upsert contract", async () => {
    const createHook = renderHook(() => useCreateBudget(), { wrapper });
    await createHook.result.current.mutateAsync({ category_id: 3, limit: 500 });
    expect(mockedPost).toHaveBeenNthCalledWith(1, "/budgets", {
      category_id: 3,
      limit: 500,
    });

    const updateHook = renderHook(() => useUpdateBudget(), { wrapper });
    await updateHook.result.current.mutateAsync({
      id: 9,
      data: { category_id: 3, limit: 600 },
    });
    expect(mockedPost).toHaveBeenNthCalledWith(2, "/budgets", {
      category_id: 3,
      limit: 600,
    });
  });

  it("uses the wallet transfer DTO names accepted by the backend", async () => {
    const hook = renderHook(() => useTransferBetweenWallets(), { wrapper });
    await hook.result.current.mutateAsync({
      fromWalletId: 1,
      toWalletId: 2,
      amount: 50,
    });
    expect(mockedPost).toHaveBeenCalledWith("/wallets/transfer", {
      fromWalletId: 1,
      toWalletId: 2,
      amount: 50,
    });
  });

  it("sends AI sources and clarification as multipart to the selected wallet/card", async () => {
    const hook = renderHook(() => useAnalyzeStatementImport(), { wrapper });
    await hook.result.current.mutateAsync({
      walletId: 1,
      cardId: 2,
      message: "Gastei 20 hoje.",
      clarification: "Foi no mercado.",
      mode: "assisted",
    });
    const [path, body, config] = mockedPost.mock.calls[0];
    expect(path).toBe("/transactions/import/1/analyze");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("message")).toBe("Gastei 20 hoje.");
    expect((body as FormData).get("clarification")).toBe("Foi no mercado.");
    expect(config).toMatchObject({ params: { cardId: 2 }, timeout: 130000 });
  });
});

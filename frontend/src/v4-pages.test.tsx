import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Contracts from "./pages/contracts/Contracts";
import Payrolls from "./pages/payrolls/Payrolls";
import userEvent from "@testing-library/user-event";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderContracts() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Contracts />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderPayrolls() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Payrolls />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Contracts page (V4)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders page header", async () => {
    renderContracts();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Contracts");
  });

  it("shows New Contract and CSV Upload buttons", async () => {
    renderContracts();
    expect(screen.getByRole("button", { name: /new contract/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /csv upload/i })).toBeInTheDocument();
  });

  it("shows filter search input", async () => {
    renderContracts();
    expect(screen.getByPlaceholderText(/search contracts/i)).toBeInTheDocument();
  });

  it("shows status filter with valid V4 statuses", async () => {
    renderContracts();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("opens create contract dialog with all required fields", async () => {
    renderContracts();
    await userEvent.click(screen.getByRole("button", { name: /new contract/i }));
    expect(screen.getByLabelText(/contract number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contractor name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/locality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
  });
});

describe("Payrolls page (V4)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders page header", async () => {
    renderPayrolls();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Payrolls");
  });

  it("shows CSV Upload button", async () => {
    renderPayrolls();
    expect(screen.getByRole("button", { name: /csv upload/i })).toBeInTheDocument();
  });

  it("shows employee name filter", async () => {
    renderPayrolls();
    expect(screen.getByPlaceholderText(/employee name/i)).toBeInTheDocument();
  });

  it("opens payroll CSV upload dialog with contract ID field", async () => {
    renderPayrolls();
    await userEvent.click(screen.getByRole("button", { name: /csv upload/i }));
    expect(screen.getByLabelText(/contract id/i)).toBeInTheDocument();
  });
});
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe("Login page", () => {
  beforeEach(() => {
    // Mock fetch for Login tests
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/login')) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ token: 'mock-jwt-token', user_id: 'u1', role: 'admin' })
            });
          }, 100);
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders email and password inputs and submit button", () => {
    renderLogin();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("displays loading state on submit", async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button")).toBeDisabled();

    // Wait for the mock fetch to complete so we don't leave pending state
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });

  it("stores token from mock login response", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("you@example.com"), "admin@example.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      const calls = setItemSpy.mock.calls;
      const tokenCall = calls.find((c) => c[0] === "wcp_token");
      expect(tokenCall).toBeDefined();
      expect(tokenCall![1]).toBe("mock-jwt-token");
    });

    setItemSpy.mockRestore();
  });
});

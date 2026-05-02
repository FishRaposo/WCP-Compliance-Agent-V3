import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  });

  it("stores token from mock login response", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("you@example.com"), "admin@example.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Wait for the async API call to complete by waiting for the localStorage call
    await vi.waitFor(() => {
      const calls = setItemSpy.mock.calls;
      const tokenCall = calls.find((c) => c[0] === "wcp_token");
      expect(tokenCall).toBeDefined();
      expect(tokenCall![1]).toBe("mock-jwt-token");
    });

    setItemSpy.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TrustScoreBadge from "./TrustScoreBadge";

describe("TrustScoreBadge", () => {
  it("renders score as percentage for auto_approve band", () => {
    render(<TrustScoreBadge score={0.92} band="auto_approve" />);
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("Auto Approve")).toBeInTheDocument();
  });

  it("renders flag_for_review band with correct label", () => {
    render(<TrustScoreBadge score={0.68} band="flag_for_review" />);
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("Flag for Review")).toBeInTheDocument();
  });

  it("renders require_human_review band with correct label", () => {
    render(<TrustScoreBadge score={0.45} band="require_human_review" />);
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("Requires Human Review")).toBeInTheDocument();
  });

  it("rounds score correctly", () => {
    render(<TrustScoreBadge score={0.856} band="auto_approve" />);
    expect(screen.getByText("86%")).toBeInTheDocument();
  });
});

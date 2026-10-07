import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { ErrorState } from "./error-state";

describe("ErrorState", () => {
  it("is announced to assistive tech", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows the friendly message from an ApiError, never a stack or raw text", () => {
    render(<ErrorState error={new ApiError("upstream_error")} />);
    expect(
      screen.getByText(/market data provider is having trouble/i),
    ).toBeInTheDocument();
  });

  it("tells the user how long to wait when rate limited", () => {
    render(
      <ErrorState error={new ApiError("rate_limited", undefined, { retryAfter: 30 })} />,
    );
    expect(screen.getByText(/about 30s/i)).toBeInTheDocument();
  });

  it("falls back to a generic message for unknown errors, without leaking details", () => {
    render(<ErrorState error={new Error("ECONNRESET at 10.0.0.4:5432")} />);
    expect(screen.queryByText(/ECONNRESET/)).toBeNull();
    expect(screen.getByText(/usually temporary/i)).toBeInTheDocument();
  });

  it("calls onRetry when the button is pressed", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when there's nothing to retry", () => {
    render(<ErrorState error={new ApiError("not_found")} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("disables retry while a retry is in flight", () => {
    render(<ErrorState onRetry={() => {}} retrying />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeDisabled();
  });
});

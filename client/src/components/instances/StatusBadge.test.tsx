import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["healthy", "HEALTHY"],
    ["medium", "MEDIUM"],
    ["high", "HIGH"],
    ["critical", "CRITICAL"],
    ["offline", "OFFLINE"],
    ["deploying", "DEPLOYING"],
  ] as const)("renders the %s status label", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows the ACK chip when acknowledged", () => {
    render(<StatusBadge status="critical" acked />);
    expect(screen.getByText("ACK")).toBeInTheDocument();
  });

  it("hides the ACK chip by default", () => {
    render(<StatusBadge status="critical" />);
    expect(screen.queryByText("ACK")).not.toBeInTheDocument();
  });
});

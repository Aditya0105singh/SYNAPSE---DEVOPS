import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { LogEvent } from "@synapse/shared";
import { LogEntry } from "./LogEntry";

const logWithDetail: LogEvent = {
  id: "log-1",
  ts: Date.now(),
  instanceId: "a",
  instanceName: "ML-INFERENCE-01",
  severity: "critical",
  message: "CUDA memory allocation failed.",
  detail: { error_code: "CUDA_OUT_OF_MEMORY" },
};

describe("LogEntry", () => {
  it("renders the message and severity badge", () => {
    render(<LogEntry log={logWithDetail} />);
    expect(screen.getByText("CUDA memory allocation failed.")).toBeInTheDocument();
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("ML-INFERENCE-01")).toBeInTheDocument();
  });

  it("expands and collapses the JSON detail on click", () => {
    render(<LogEntry log={logWithDetail} />);
    expect(screen.queryByText(/CUDA_OUT_OF_MEMORY/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("CUDA memory allocation failed."));
    expect(screen.getByText(/CUDA_OUT_OF_MEMORY/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("CUDA memory allocation failed."));
    expect(screen.queryByText(/CUDA_OUT_OF_MEMORY/)).not.toBeInTheDocument();
  });

  it("does not render an expand chevron for logs without detail", () => {
    const plain: LogEvent = { ...logWithDetail, id: "log-2", detail: undefined, severity: "debug" };
    render(<LogEntry log={plain} />);
    fireEvent.click(screen.getByText("CUDA memory allocation failed."));
    expect(screen.queryByText(/CUDA_OUT_OF_MEMORY/)).not.toBeInTheDocument();
  });
});

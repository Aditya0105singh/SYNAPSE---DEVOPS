import type { InstanceCategory, InstanceState, Severity } from "@synapse/shared";

export interface IncidentTemplate {
  scenarioId: string;
  message: string;
  severity: Severity;
  detail: (inst: InstanceState) => Record<string, unknown>;
}

export interface Persona {
  key: string;
  namePrefix: string;
  ipBase: string;
  category: InstanceCategory;
  baseline: { cpu: number; memGb: number; memCapGb: number };
  volatility: number;
  incidents: IncidentTemplate[];
  ambientMessages: string[];
}

export const PERSONAS: Persona[] = [
  {
    key: "ml",
    namePrefix: "ML-INFERENCE",
    ipBase: "10.0.8",
    category: "compute",
    baseline: { cpu: 55, memGb: 40, memCapGb: 80 },
    volatility: 6,
    incidents: [
      {
        scenarioId: "cuda_oom",
        message: "CUDA memory allocation failed. Out of VRAM during LLM batch token processing inference.",
        severity: "critical",
        detail: (_inst) => ({
          timestamp: new Date().toISOString(),
          error_code: "CUDA_OUT_OF_MEMORY",
          device: "NVIDIA A100 80GB PCIe",
          vram_state: { allocated: "78.4 GiB", reserved: "80.0 GiB", free: "12.5 MiB" },
          stack_trace: "RuntimeError: CUDA out of memory. Tried to allocate 400.00 MiB.",
        }),
      },
    ],
    ambientMessages: [
      "Batch inference completed in {ms}ms",
      "Token throughput {n} tok/s",
      "Model weights cached in VRAM",
      "Health check OK",
    ],
  },
  {
    key: "payment",
    namePrefix: "PAYMENT-PROCESSOR",
    ipBase: "10.0.3",
    category: "compute",
    baseline: { cpu: 30, memGb: 1.5, memCapGb: 4 },
    volatility: 4,
    incidents: [
      {
        scenarioId: "deploy_failure",
        message: "Deployment rollout failed health checks. Rolling back to previous revision.",
        severity: "critical",
        detail: (_inst) => ({
          timestamp: new Date().toISOString(),
          error_code: "DEPLOY_HEALTHCHECK_FAILED",
          revision: `rev-${Math.floor(Math.random() * 9000 + 1000)}`,
          failed_checks: ["/healthz", "/readyz"],
          action: "auto-rollback initiated",
        }),
      },
    ],
    ambientMessages: [
      "Transaction batch settled: {n} txns",
      "Idempotency cache hit rate 98.{n}%",
      "Webhook delivered in {ms}ms",
      "Health check OK",
    ],
  },
  {
    key: "cache",
    namePrefix: "REDIS-CACHE-CLUSTER",
    ipBase: "10.0.4",
    category: "database",
    baseline: { cpu: 40, memGb: 12, memCapGb: 16 },
    volatility: 8,
    incidents: [
      {
        scenarioId: "cache_exhaustion",
        message: "Redis connection pool exhausted. Authentication response latency degraded above 1500ms threshold.",
        severity: "warning",
        detail: (_inst) => ({
          timestamp: new Date().toISOString(),
          error_code: "CONN_POOL_EXHAUSTED",
          pool_size: 128,
          active_connections: 128,
          queued_requests: Math.floor(Math.random() * 400 + 100),
        }),
      },
    ],
    ambientMessages: [
      "Evicted {n} keys (LRU)",
      "Replication lag {ms}ms",
      "Cache hit ratio 94.{n}%",
      "Health check OK",
    ],
  },
  {
    key: "gateway",
    namePrefix: "API-GATEWAY",
    ipBase: "10.0.1",
    category: "network",
    baseline: { cpu: 45, memGb: 5, memCapGb: 8 },
    volatility: 10,
    incidents: [
      {
        scenarioId: "traffic_spike",
        message: "Inbound request rate exceeded rate-limit threshold. Auto-scaling group provisioning new nodes.",
        severity: "warning",
        detail: (_inst) => ({
          timestamp: new Date().toISOString(),
          error_code: "RATE_LIMIT_THRESHOLD_EXCEEDED",
          requests_per_sec: Math.floor(Math.random() * 5000 + 8000),
          scaling_action: "provisioning +4 nodes",
        }),
      },
    ],
    ambientMessages: [
      "Routed {n} requests, p50 {ms}ms",
      "TLS handshake completed",
      "Upstream health check OK",
      "Rate limiter: {n} req/s",
    ],
  },
  {
    key: "db",
    namePrefix: "DB-MAIN-MASTER",
    ipBase: "10.0.1",
    category: "database",
    baseline: { cpu: 50, memGb: 4, memCapGb: 8 },
    volatility: 5,
    incidents: [
      {
        scenarioId: "disk_pressure",
        message: "Disk utilization crossed 92% on primary volume. WAL checkpoint delayed.",
        severity: "warning",
        detail: (_inst) => ({
          timestamp: new Date().toISOString(),
          error_code: "DISK_PRESSURE_WARNING",
          volume: "/dev/xvdb",
          used_pct: 92,
          wal_lag_mb: Math.floor(Math.random() * 800 + 200),
        }),
      },
    ],
    ambientMessages: [
      "Checkpoint completed in {ms}ms",
      "Replica lag {ms}ms",
      "Query planner cache refreshed",
      "Health check OK",
    ],
  },
  {
    key: "worker",
    namePrefix: "WORKER-QUEUE",
    ipBase: "10.0.5",
    category: "compute",
    baseline: { cpu: 60, memGb: 18, memCapGb: 32 },
    volatility: 12,
    incidents: [],
    ambientMessages: [
      "Processed job batch: {n} jobs",
      "Queue depth {n}",
      "Worker heartbeat OK",
      "Retried {n} failed jobs",
    ],
  },
  {
    key: "search",
    namePrefix: "SEARCH-INDEXER",
    ipBase: "10.0.4",
    category: "compute",
    baseline: { cpu: 20, memGb: 2, memCapGb: 6 },
    volatility: 3,
    incidents: [],
    ambientMessages: ["Index shard synced", "Reindex progress {n}%", "Health check OK"],
  },
];

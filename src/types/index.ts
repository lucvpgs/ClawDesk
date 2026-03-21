export interface OpenClawConfig {
  gateway?: {
    port?: number;
    mode?: string;
    bind?: string;
    auth?: {
      mode?: string;
      token?: string;
    };
  };
  agents?: {
    list?: Array<{
      id: string;
      name?: string;
      model?: string;
      workspace?: string;
      default?: boolean;
    }>;
    defaults?: {
      model?: {
        primary?: string;
        fallbacks?: string[];
      };
    };
  };
  channels?: Record<string, unknown>;
  meta?: {
    lastTouchedVersion?: string;
    lastTouchedAt?: string;
  };
}

export interface ScanResult {
  found: boolean;
  configPath?: string;
  gatewayUrl?: string;
  authToken?: string;
  primaryAgent?: string;
  agentCount?: number;
  version?: string;
  cliBinary?: string;
  error?: string;
}

export interface GatewayProbeResult {
  reachable: boolean;
  authed: boolean;
  scopes?: string[];
  version?: string;
  primaryAgent?: string;
  error?: string;
}

export interface OverviewData {
  runtimeSource: {
    id: string;
    name: string;
    status: string;
    lastSeenAt: string | null;
  } | null;
  agents: Array<{
    id: string;
    agentId: string;
    name: string | null;
    model: string | null;
    status: string | null;
  }>;
  sessions: Array<{
    sessionId: string;
    agentId: string | null;
    status: string | null;
    channel: string | null;
  }>;
  cronJobs: Array<{
    jobId: string;
    name: string | null;
    schedule: string | null;
    status: string | null;
    lastRunAt: string | null;
  }>;
  channels: Array<{
    channelType: string;
    status: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    eventType: string;
    summary: string | null;
    occurredAt: string;
  }>;
  taskStats: {
    total: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
}

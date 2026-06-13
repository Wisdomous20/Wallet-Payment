import { Redis } from "@upstash/redis";
import type { BrowserLocationSignal, FraudLocationSignal } from "./fraud-location";

export type WalletChannel = "GCash" | "Maya";

const AUDIT_EVENTS_KEY = "walletpay:login-audit-events";

export type LoginAuditEvent = {
  id: string;
  maskedAccount: string;
  device: string;
  walletChannel: WalletChannel;
  status:
    | "runtime_ip_checked"
    | "location_requested"
    | "location_approved"
    | "review_started";
  createdAt: string;
  ipSignal: FraudLocationSignal | null;
  browserLocation: BrowserLocationSignal | null;
};

export function maskAccount(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "not provided";
  }

  if (trimmed.includes("@")) {
    const [name, domain] = trimmed.split("@");
    return `${name.slice(0, 1)}***@${domain ?? "unknown"}`;
  }

  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

const globalAuditStore = globalThis as typeof globalThis & {
  walletpayLoginAuditEvents?: LoginAuditEvent[];
};

export async function addLoginAuditEvent(event: LoginAuditEvent): Promise<LoginAuditEvent[]> {
  const redis = getRedisClient();

  if (redis) {
    await redis.lpush(AUDIT_EVENTS_KEY, event);
    await redis.ltrim(AUDIT_EVENTS_KEY, 0, 99);
    return getLoginAuditEvents();
  }

  const events = await getLoginAuditEvents();
  globalAuditStore.walletpayLoginAuditEvents = [event, ...events].slice(0, 100);
  return globalAuditStore.walletpayLoginAuditEvents;
}

export async function getLoginAuditEvents(): Promise<LoginAuditEvent[]> {
  const redis = getRedisClient();

  if (redis) {
    return redis.lrange<LoginAuditEvent>(AUDIT_EVENTS_KEY, 0, 99);
  }

  return globalAuditStore.walletpayLoginAuditEvents ?? [];
}

function getRedisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

export function getAuditStorageMode(): "redis" | "memory" {
  return getRedisClient() ? "redis" : "memory";
}

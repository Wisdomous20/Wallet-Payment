import type { BrowserLocationSignal, FraudLocationSignal } from "./fraud-location";

export type WalletChannel = "GCash" | "Maya";

export type LoginAuditEvent = {
  id: string;
  maskedAccount: string;
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

export function addLoginAuditEvent(event: LoginAuditEvent): LoginAuditEvent[] {
  const events = getLoginAuditEvents();
  globalAuditStore.walletpayLoginAuditEvents = [event, ...events].slice(0, 100);
  return globalAuditStore.walletpayLoginAuditEvents;
}

export function getLoginAuditEvents(): LoginAuditEvent[] {
  return globalAuditStore.walletpayLoginAuditEvents ?? [];
}

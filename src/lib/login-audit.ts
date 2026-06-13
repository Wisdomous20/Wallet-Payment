import type { BrowserLocationSignal, FraudLocationSignal } from "./fraud-location";

export const LOGIN_AUDIT_STORAGE_KEY = "walletpay-login-audit-events";

export type WalletChannel = "GCash" | "Maya";

export type LoginAuditEvent = {
  id: string;
  maskedAccount: string;
  walletChannel: WalletChannel;
  status: "location_requested" | "location_approved" | "review_started";
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

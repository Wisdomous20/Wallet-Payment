import {
  getClientIp,
  getVercelLocationHeaders,
  resolveFraudLocationSignal,
} from "@/lib/fraud-location";
import {
  addLoginAuditEvent,
  getAuditStorageMode,
  getLoginAuditEvents,
  type LoginAuditEvent,
  maskAccount,
} from "@/lib/login-audit";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { events: await getLoginAuditEvents(), storageMode: getAuditStorageMode() },
    {
      headers: {
        "Cache-Control": "no-store, private",
      },
    },
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isAuditPayload(body)) {
    return Response.json({ error: "Invalid login event payload." }, { status: 400 });
  }

  const headerIp = getClientIp(request.headers);
  const serverIpSignal = await resolveFraudLocationSignal({
    ip: headerIp.ip,
    ipSource: headerIp.source,
    vercelHeaders: getVercelLocationHeaders(request.headers),
  });

  const event: LoginAuditEvent = {
    id: crypto.randomUUID(),
    maskedAccount: maskAccount(body.account),
    device: getDeviceLabel(request.headers.get("user-agent")),
    walletChannel: body.walletChannel,
    status: body.status,
    createdAt: new Date().toISOString(),
    ipSignal: serverIpSignal,
    browserLocation: body.browserLocation,
  };

  await addLoginAuditEvent(event);

  return Response.json(
    { event },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store, private",
      },
    },
  );
}

function getDeviceLabel(userAgent: string | null): string {
  if (!userAgent) {
    return "Unknown device";
  }

  if (/iphone|android.*mobile|mobile/i.test(userAgent)) {
    return "Phone";
  }

  if (/ipad|tablet|android/i.test(userAgent)) {
    return "Tablet";
  }

  return "Desktop/Laptop";
}

function isAuditPayload(value: unknown): value is {
  account: string;
  walletChannel: LoginAuditEvent["walletChannel"];
  status: LoginAuditEvent["status"];
  browserLocation: LoginAuditEvent["browserLocation"];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as {
    account?: unknown;
    walletChannel?: unknown;
    status?: unknown;
    browserLocation?: unknown;
  };

  return (
    typeof payload.account === "string" &&
    payload.account.length <= 128 &&
    (payload.walletChannel === "GCash" || payload.walletChannel === "Maya") &&
    (
      payload.status === "location_requested" ||
      payload.status === "runtime_ip_checked" ||
      payload.status === "location_approved" ||
      payload.status === "review_started"
    ) &&
    (payload.browserLocation === null || typeof payload.browserLocation === "object")
  );
}

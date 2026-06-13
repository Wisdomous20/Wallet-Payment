import {
  getClientIp,
  getVercelLocationHeaders,
  isLocalOrPrivateIp,
  resolveFraudLocationSignal,
} from "@/lib/fraud-location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const headerIp = getClientIp(request.headers);
  const testIp = getLocalTestIp(requestUrl, headerIp.ip);
  const ip = testIp ?? headerIp.ip;
  const ipSource = testIp ? "local-test-query" : headerIp.source;

  const signal = await resolveFraudLocationSignal({
    ip,
    ipSource,
    vercelHeaders: getVercelLocationHeaders(request.headers),
  });

  return Response.json(signal, {
    headers: {
      "Cache-Control": "no-store, private",
    },
  });
}

function getLocalTestIp(requestUrl: URL, detectedIp: string | null): string | null {
  if (process.env.NODE_ENV === "production" || !isLocalOrPrivateIp(detectedIp)) {
    return null;
  }

  const ip = requestUrl.searchParams.get("ip")?.trim();

  if (!ip || ip.length > 64 || ip.includes(",") || /\s/.test(ip)) {
    return null;
  }

  return ip;
}

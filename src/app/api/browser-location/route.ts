import { resolveBrowserLocationSignal } from "@/lib/fraud-location";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isCoordinatePayload(body)) {
    return Response.json({ error: "Latitude and longitude are required." }, { status: 400 });
  }

  const signal = await resolveBrowserLocationSignal({
    latitude: body.latitude,
    longitude: body.longitude,
  });

  if (!signal) {
    return Response.json({ error: "Unable to resolve browser location." }, { status: 502 });
  }

  return Response.json(signal, {
    headers: {
      "Cache-Control": "no-store, private",
    },
  });
}

function isCoordinatePayload(value: unknown): value is { latitude: number; longitude: number } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as { latitude?: unknown; longitude?: unknown };

  return (
    typeof payload.latitude === "number" &&
    Number.isFinite(payload.latitude) &&
    payload.latitude >= -90 &&
    payload.latitude <= 90 &&
    typeof payload.longitude === "number" &&
    Number.isFinite(payload.longitude) &&
    payload.longitude >= -180 &&
    payload.longitude <= 180
  );
}

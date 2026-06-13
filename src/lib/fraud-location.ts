import { Reader } from "@maxmind/geoip2-node";
import type ReaderModel from "@maxmind/geoip2-node/dist/src/readerModel";

export type FraudLocationSignal = {
  ip: string | null;
  ipSource: string;
  isLocalIp: boolean;
  barangay: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: "low" | "none";
  source: "ip_reverse_geocode" | "vercel_headers" | "unavailable";
  provider: "maxmind" | "ip-api" | "vercel" | "none";
  accuracyRadiusKm: number | null;
  network: {
    asn: string | null;
    name: string | null;
    domain: string | null;
    type: string | null;
    isMobile: boolean | null;
    isAnonymous: boolean | null;
    isHosting: boolean | null;
    isAnycast: boolean | null;
  };
  notes: string[];
};

export type BrowserLocationSignal = {
  barangay: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  confidence: "medium";
  source: "browser_reverse_geocode";
  notes: string[];
};

type VercelLocationHeaders = {
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

type IpApiResponse = {
  status?: "success" | "fail";
  message?: string;
  query?: string;
  city?: string;
  regionName?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
};

type NormalizedIpLocation = {
  provider: "maxmind" | "ip-api";
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyRadiusKm: number | null;
  network: FraudLocationSignal["network"];
  notes: string[];
};

type ReverseGeocodeResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
  localityInfo?: {
    administrative?: Array<{
      name?: string;
      description?: string;
      adminLevel?: number;
    }>;
    informative?: Array<{
      name?: string;
      description?: string;
    }>;
  };
};

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
];

const globalMaxMindReader = globalThis as typeof globalThis & {
  walletpayMaxMindReaderPromise?: Promise<ReaderModel | null>;
};

export function getClientIp(headers: Headers): { ip: string | null; source: string } {
  const headerCandidates = [
    "x-vercel-forwarded-for",
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
  ];

  for (const header of headerCandidates) {
    const value = headers.get(header);
    const ip = parseForwardedIp(value, header);

    if (ip) {
      return { ip, source: header };
    }
  }

  return { ip: null, source: "missing" };
}

export function getVercelLocationHeaders(headers: Headers): VercelLocationHeaders {
  return {
    city: decodeHeaderValue(headers.get("x-vercel-ip-city")),
    region: decodeHeaderValue(headers.get("x-vercel-ip-country-region")),
    countryCode: decodeHeaderValue(headers.get("x-vercel-ip-country")),
  };
}

export function isLocalOrPrivateIp(ip: string | null): boolean {
  if (!ip) {
    return true;
  }

  return LOCAL_IPS.has(ip) || PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

export async function resolveFraudLocationSignal({
  ip,
  ipSource,
  vercelHeaders,
}: {
  ip: string | null;
  ipSource: string;
  vercelHeaders: VercelLocationHeaders;
}): Promise<FraudLocationSignal> {
  const notes: string[] = [];
  const isLocalIp = isLocalOrPrivateIp(ip);

  if (!ip || isLocalIp) {
    return {
      ip,
      ipSource,
      isLocalIp,
      barangay: null,
      city: vercelHeaders.city,
      region: vercelHeaders.region,
      country: null,
      countryCode: vercelHeaders.countryCode,
      latitude: null,
      longitude: null,
      confidence: "none",
      source: "unavailable",
      provider: "none",
      accuracyRadiusKm: null,
      network: emptyNetworkSignal(),
      notes: [
        "No public client IP was available. Localhost and private network IPs cannot be geolocated.",
      ],
    };
  }

  const ipLocation = await fetchIpLocation(ip);

  if (!ipLocation) {
    return {
      ip,
      ipSource,
      isLocalIp,
      barangay: null,
      city: vercelHeaders.city,
      region: vercelHeaders.region,
      country: null,
      countryCode: vercelHeaders.countryCode,
      latitude: null,
      longitude: null,
      confidence: "low",
      source: "vercel_headers",
      provider: "vercel",
      accuracyRadiusKm: null,
      network: emptyNetworkSignal(),
      notes: [
        "The IP lookup provider did not return coordinates, so only Vercel header location was available.",
      ],
    };
  }

  const reverseLocation =
    typeof ipLocation.latitude === "number" && typeof ipLocation.longitude === "number"
      ? await reverseGeocode(ipLocation.latitude, ipLocation.longitude)
      : null;

  const barangayCandidate = reverseLocation ? extractBarangayCandidate(reverseLocation) : null;
  const barangay = barangayCandidate?.name ?? null;

  if (!barangay) {
    notes.push(
      "Barangay could not be inferred from the reverse-geocoding response for this approximate IP location.",
    );
  } else if (barangayCandidate?.source === "deepest_ph_locality") {
    notes.push(
      "No explicit barangay label was returned, so the deepest Philippine locality was used as the barangay candidate.",
    );
  }

  notes.push(...ipLocation.notes);
  notes.push("Use this as a low-confidence fraud signal only, not as verified address data.");

  return {
    ip,
    ipSource,
    isLocalIp,
    barangay,
    city: reverseLocation?.city ?? reverseLocation?.locality ?? ipLocation.city ?? vercelHeaders.city,
    region:
      reverseLocation?.principalSubdivision ?? ipLocation.region ?? vercelHeaders.region,
    country: reverseLocation?.countryName ?? ipLocation.country ?? null,
    countryCode:
      reverseLocation?.countryCode ?? ipLocation.countryCode ?? vercelHeaders.countryCode,
    latitude: ipLocation.latitude,
    longitude: ipLocation.longitude,
    confidence: "low",
    source: "ip_reverse_geocode",
    provider: ipLocation.provider,
    accuracyRadiusKm: ipLocation.accuracyRadiusKm,
    network: ipLocation.network,
    notes,
  };
}

export async function resolveBrowserLocationSignal({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<BrowserLocationSignal | null> {
  const reverseLocation = await reverseGeocode(latitude, longitude);

  if (!reverseLocation) {
    return null;
  }

  const barangayCandidate = extractBarangayCandidate(reverseLocation);
  const notes = [
    "Browser location was approved by the user and reverse-geocoded for transfer review.",
  ];

  if (!barangayCandidate) {
    notes.push("No barangay candidate was returned for these coordinates.");
  } else if (barangayCandidate.source === "deepest_ph_locality") {
    notes.push("No explicit barangay label was returned, so the deepest Philippine locality was used.");
  }

  return {
    barangay: barangayCandidate?.name ?? null,
    city: reverseLocation.city ?? reverseLocation.locality ?? null,
    region: reverseLocation.principalSubdivision ?? null,
    country: reverseLocation.countryName ?? null,
    countryCode: reverseLocation.countryCode ?? null,
    latitude,
    longitude,
    confidence: "medium",
    source: "browser_reverse_geocode",
    notes,
  };
}

function parseForwardedIp(value: string | null, header: string): string | null {
  if (!value) {
    return null;
  }

  const ips = header === "x-forwarded-for"
    ? value.split(",").map((ip) => ip.trim()).filter(Boolean)
    : [value.trim()].filter(Boolean);

  return ips.find((ip) => !isLocalOrPrivateIp(ip)) ?? ips[0] ?? null;
}

function decodeHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function emptyNetworkSignal(): FraudLocationSignal["network"] {
  return {
    asn: null,
    name: null,
    domain: null,
    type: null,
    isMobile: null,
    isAnonymous: null,
    isHosting: null,
    isAnycast: null,
  };
}

async function fetchIpLocation(ip: string): Promise<NormalizedIpLocation | null> {
  const maxMindLocation = await fetchMaxMindLocation(ip);

  if (maxMindLocation) {
    return maxMindLocation;
  }

  const url = new URL(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
  url.searchParams.set(
    "fields",
    "status,message,country,countryCode,regionName,city,lat,lon,query",
  );

  const response = await fetchProvider(url.toString());

  if (!response?.ok) {
    return null;
  }

  const data = (await response.json()) as IpApiResponse;

  if (data.status !== "success") {
    return null;
  }

  return {
    provider: "ip-api",
    city: data.city ?? null,
    region: data.regionName ?? null,
    country: data.country ?? null,
    countryCode: data.countryCode ?? null,
    latitude: data.lat ?? null,
    longitude: data.lon ?? null,
    accuracyRadiusKm: null,
    network: emptyNetworkSignal(),
    notes: ["ip-api was used for the automatic IP signal."],
  };
}

async function fetchMaxMindLocation(ip: string): Promise<NormalizedIpLocation | null> {
  const reader = await getMaxMindReader();

  if (!reader) {
    return null;
  }

  try {
    const response = reader.city(ip);
    const subdivision = response.subdivisions?.[0];
    const traits = response.traits;

    return {
      provider: "maxmind",
      city: response.city?.names?.en ?? null,
      region: subdivision?.names?.en ?? null,
      country: response.country?.names?.en ?? response.registeredCountry?.names?.en ?? null,
      countryCode: response.country?.isoCode ?? response.registeredCountry?.isoCode ?? null,
      latitude: response.location?.latitude ?? null,
      longitude: response.location?.longitude ?? null,
      accuracyRadiusKm: response.location?.accuracyRadius ?? null,
      network: {
        asn: traits?.autonomousSystemNumber
          ? String(traits.autonomousSystemNumber)
          : null,
        name:
          traits?.autonomousSystemOrganization ??
          traits?.isp ??
          traits?.organization ??
          null,
        domain: traits?.domain ?? null,
        type: traits?.userType ?? traits?.connectionType ?? null,
        isMobile: traits?.connectionType === "Cellular" || traits?.userType === "cellular",
        isAnonymous: traits?.isAnonymous ?? traits?.isAnonymousProxy ?? null,
        isHosting: traits?.isHostingProvider ?? traits?.userType === "hosting",
        isAnycast: traits?.isAnycast ?? null,
      },
      notes: [
        "MaxMind MMDB was used for the automatic IP signal.",
        ...(response.location?.accuracyRadius
          ? [`MaxMind reported an approximate radius of ${response.location.accuracyRadius} km.`]
          : []),
      ],
    };
  } catch {
    return null;
  }
}

async function getMaxMindReader(): Promise<ReaderModel | null> {
  const databasePath = process.env.MAXMIND_CITY_DB_PATH ?? process.env.GEOLITE2_CITY_DB_PATH;

  if (!databasePath) {
    return null;
  }

  if (!globalMaxMindReader.walletpayMaxMindReaderPromise) {
    globalMaxMindReader.walletpayMaxMindReaderPromise = Reader.open(databasePath).catch(() => null);
  }

  return globalMaxMindReader.walletpayMaxMindReaderPromise;
}

async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResponse | null> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", "en");

  const response = await fetchProvider(url.toString());

  if (!response?.ok) {
    return null;
  }

  return (await response.json()) as ReverseGeocodeResponse;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchProvider(url: string): Promise<Response | null> {
  try {
    return await fetchWithTimeout(url);
  } catch {
    return null;
  }
}

function extractBarangayCandidate(
  reverseLocation: ReverseGeocodeResponse,
): { name: string; source: "barangay_label" | "deepest_ph_locality" } | null {
  if (reverseLocation.countryCode?.toUpperCase() !== "PH") {
    return null;
  }

  const administrative = reverseLocation.localityInfo?.administrative ?? [];
  const informative = reverseLocation.localityInfo?.informative ?? [];
  const candidates = [...administrative, ...informative];

  const labelledBarangay = candidates.find((item) => {
    const text = `${item.description ?? ""} ${item.name ?? ""}`.toLowerCase();

    return (
      text.includes("barangay") ||
      text.includes("brgy") ||
      text.includes("village") ||
      text.includes("neighborhood") ||
      text.includes("neighbourhood")
    );
  });

  if (labelledBarangay?.name) {
    return { name: labelledBarangay.name, source: "barangay_label" };
  }

  const deepestLocality = [...administrative]
    .reverse()
    .find((item) => {
      if (!item.name) {
        return false;
      }

      const normalizedName = item.name.toLowerCase();
      const normalizedDescription = item.description?.toLowerCase() ?? "";

      return (
        !normalizedName.includes("philippines") &&
        !normalizedName.includes("national capital region") &&
        !normalizedDescription.includes("region of the philippines")
      );
    });

  return deepestLocality?.name
    ? { name: deepestLocality.name, source: "deepest_ph_locality" }
    : null;
}

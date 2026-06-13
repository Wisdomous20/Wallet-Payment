"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

type FraudLocationSignal = {
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
  notes: string[];
};

export function FraudLocationPanel() {
  const [signal, setSignal] = useState<FraudLocationSignal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSignal() {
      try {
        const data = await fetchSignal();
        if (isMounted) {
          setSignal(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unknown lookup error.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSignal();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <section className={styles.signalPanel}>Loading admin location signal...</section>;
  }

  if (error) {
    return <section className={styles.signalPanel}>Location check failed: {error}</section>;
  }

  if (!signal) {
    return <section className={styles.signalPanel}>No signal returned.</section>;
  }

  return (
    <section className={styles.signalPanel} aria-label="IP fraud location signal">
      <div className={styles.panelHeader}>
        <span className={styles.kicker}>Security location check</span>
        <span className={styles.confidence}>{signal.confidence} confidence</span>
      </div>

      <dl className={styles.signalGrid}>
        <SignalItem label="Barangay" value={signal.barangay ?? "Not inferred"} />
        <SignalItem label="City" value={signal.city ?? "Unknown"} />
        <SignalItem label="Region" value={signal.region ?? "Unknown"} />
        <SignalItem label="Country" value={signal.country ?? signal.countryCode ?? "Unknown"} />
        <SignalItem label="IP source" value={signal.ipSource} />
        <SignalItem label="Lookup source" value={signal.source} />
      </dl>

      <p className={styles.locationMeta}>
        IP: {signal.ip ?? "Unavailable"} / Coordinates:{" "}
        {signal.latitude && signal.longitude
          ? `${signal.latitude.toFixed(4)}, ${signal.longitude.toFixed(4)}`
          : "Unavailable"}
      </p>

      <ul className={styles.notes}>
        {signal.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

async function fetchSignal(): Promise<FraudLocationSignal> {
  const response = await fetch("/api/fraud-location", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to read the fraud location signal.");
  }

  return (await response.json()) as FraudLocationSignal;
}

function SignalItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.signalItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

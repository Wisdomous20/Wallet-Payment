"use client";

import { useEffect, useState } from "react";
import { LOGIN_AUDIT_STORAGE_KEY, type LoginAuditEvent } from "@/lib/login-audit";
import styles from "../page.module.css";

export function LocationAuditTable() {
  const [events, setEvents] = useState<LoginAuditEvent[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setEvents(readAuditEvents());
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  if (events.length === 0) {
    return (
      <section className={styles.auditEmpty}>
        No local transfer location events yet. Complete the wallet access flow first.
      </section>
    );
  }

  return (
    <section className={styles.auditTableWrap}>
      <table className={styles.auditTable}>
        <thead>
          <tr>
            <th>Time</th>
            <th>Account</th>
            <th>Wallet</th>
            <th>Status</th>
            <th>Approximate IP location</th>
            <th>Approved browser location</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{new Date(event.createdAt).toLocaleString()}</td>
              <td>{event.maskedAccount}</td>
              <td>{event.walletChannel}</td>
              <td>{event.status.replaceAll("_", " ")}</td>
              <td>{formatIpLocation(event)}</td>
              <td>{formatBrowserLocation(event)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function readAuditEvents(): LoginAuditEvent[] {
  try {
    const rawEvents = localStorage.getItem(LOGIN_AUDIT_STORAGE_KEY);
    return rawEvents ? (JSON.parse(rawEvents) as LoginAuditEvent[]) : [];
  } catch {
    return [];
  }
}

function formatIpLocation(event: LoginAuditEvent): string {
  const signal = event.ipSignal;

  if (!signal) {
    return "Unavailable";
  }

  return [signal.barangay, signal.city, signal.region, signal.countryCode]
    .filter(Boolean)
    .join(", ");
}

function formatBrowserLocation(event: LoginAuditEvent): string {
  const location = event.browserLocation;

  if (!location) {
    return "Not approved";
  }

  return [location.barangay, location.city, location.region, location.countryCode]
    .filter(Boolean)
    .join(", ");
}

"use client";

import { useEffect, useState } from "react";
import { type LoginAuditEvent } from "@/lib/login-audit";
import styles from "../page.module.css";

export function LocationAuditTable() {
  const [events, setEvents] = useState<LoginAuditEvent[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const response = await fetch("/api/login-events", { cache: "no-store" });

        if (!response.ok) {
          if (isMounted) {
            setEvents([]);
          }

          return;
        }

        const data = (await response.json()) as { events: LoginAuditEvent[] };

        if (isMounted) {
          setEvents(data.events);
        }
      } catch {
        if (isMounted) {
          setEvents([]);
        }
      }
    }

    const timeout = window.setTimeout(() => void loadEvents(), 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
    };
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
              <td>{formatStatus(event.status)}</td>
              <td>{formatIpLocation(event)}</td>
              <td>{formatBrowserLocation(event)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatStatus(status: LoginAuditEvent["status"]): string {
  const labels: Record<LoginAuditEvent["status"], string> = {
    runtime_ip_checked: "Runtime IP checked",
    location_requested: "Location requested",
    location_approved: "Browser location approved",
    review_started: "Transfer review started",
  };

  return labels[status];
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

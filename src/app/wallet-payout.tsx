"use client";

import { useEffect, useState } from "react";
import type { BrowserLocationSignal } from "@/lib/fraud-location";
import { type LoginAuditEvent, type WalletChannel } from "@/lib/login-audit";
import styles from "./page.module.css";

export function WalletPayout() {
  const [account, setAccount] = useState("");
  const [walletChannel, setWalletChannel] = useState<WalletChannel>("GCash");
  const [browserLocation, setBrowserLocation] = useState<BrowserLocationSignal | null>(null);
  const [reviewStatus, setReviewStatus] = useState("Confirm location to continue.");

  useEffect(() => {
    let isMounted = true;

    async function recordRuntimeIpSignal() {
      try {
        await fetch("/api/login-events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            account: "",
            walletChannel: "GCash",
            status: "runtime_ip_checked",
            browserLocation: null,
          }),
        });
      } catch {
        // The transfer page should still render if the background risk signal fails.
      }
    }

    if (isMounted) {
      void recordRuntimeIpSignal();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  async function writeAuditEvent(
    status: LoginAuditEvent["status"],
    location: BrowserLocationSignal | null,
  ) {
    await fetch("/api/login-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account,
        walletChannel,
        status,
        browserLocation: location,
      }),
    });
  }

  async function approveLocation() {
    void writeAuditEvent("location_requested", null);

    if (!("geolocation" in navigator)) {
      setReviewStatus("This browser does not support location sharing.");
      return;
    }

    setReviewStatus("Waiting for location permission...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/browser-location", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });

          if (!response.ok) {
            throw new Error("Unable to verify approved location.");
          }

          const location = (await response.json()) as BrowserLocationSignal;
          setBrowserLocation(location);
          setReviewStatus("Location approved. Wallet review can continue.");
          void writeAuditEvent("location_approved", location);
        } catch {
          setReviewStatus("Location was approved, but reverse geocoding failed.");
        }
      },
      () => {
        setReviewStatus("Location permission was not approved.");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 10_000,
      },
    );
  }

  function startReview() {
    if (!browserLocation) {
      setReviewStatus("Approve location sharing before continuing.");
      return;
    }

    void writeAuditEvent("review_started", browserLocation);
    setReviewStatus("Transfer review started. No money was sent in this prototype.");
  }

  return (
    <section className={styles.payoutGrid}>
      <div className={styles.payoutCopy}>
        <p className={styles.eyebrow}>WalletPay transfer</p>
        <h1>Send money to an e-wallet in minutes.</h1>
        <p className={styles.lede}>
          Choose GCash or Maya, enter the recipient wallet, and confirm this
          device before the transfer review starts.
        </p>
      </div>

      <div className={styles.loginCard} aria-label="E-wallet transfer access">
        <div className={styles.walletChoices} role="radiogroup" aria-label="E-wallet channel">
          {(["GCash", "Maya"] as const).map((channel) => (
            <button
              className={walletChannel === channel ? styles.walletChoiceActive : styles.walletChoice}
              key={channel}
              type="button"
              onClick={() => setWalletChannel(channel)}
            >
              {channel}
            </button>
          ))}
        </div>

        <form className={styles.accessForm}>
          <label>
            Recipient e-wallet number
            <input
              type="text"
              name="account"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="09XX XXX XXXX"
            />
          </label>
        </form>

        <div className={styles.consentBox}>
          <strong>Confirm this device</strong>
          <p>
            Approve browser location sharing to continue. This helps protect the
            transfer from unusual access.
          </p>
          <button type="button" onClick={approveLocation}>
            Confirm device location
          </button>
        </div>

        <button className={styles.reviewButton} type="button" onClick={startReview}>
          Review transfer
        </button>
        <p className={styles.formNote}>{reviewStatus}</p>
      </div>
    </section>
  );
}

import { FraudLocationPanel } from "../fraud-location-panel";
import { LocationAuditTable } from "./table";
import styles from "../page.module.css";

export default function AdminPage() {
  return (
    <main className={styles.shell}>
      <nav className={styles.nav} aria-label="Admin navigation">
        <div className={styles.brand}>
          <span className={styles.brandMark}>WP</span>
          <span>WalletPay Admin</span>
        </div>
      </nav>

      <section className={styles.auditPage}>
        <div className={styles.auditHeader}>
          <p className={styles.eyebrow}>Location review</p>
          <h1>Runtime location signals</h1>
          <p>
            Review the current request location signal and local transfer access
            events that include masked account data and approved browser location.
          </p>
        </div>

        <FraudLocationPanel />
        <LocationAuditTable />
      </section>
    </main>
  );
}

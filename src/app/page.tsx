import { WalletPayout } from "./wallet-payout";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.shell}>
      <nav className={styles.nav} aria-label="WalletPay navigation">
        <div className={styles.brand}>
          <span className={styles.brandMark}>WP</span>
          <span>WalletPay</span>
        </div>
      </nav>

      <WalletPayout />
    </main>
  );
}

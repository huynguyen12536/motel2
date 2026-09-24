"use client";

import dynamic from "next/dynamic";
import "@designcodeio/threeui/style.css";
import styles from "./kage-scene.module.css";

const KageLandingPage = dynamic(
  () =>
    import("@designcodeio/threeui/components/KageLandingPage").then(
      (module) => module.KageLandingPage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading} role="status" aria-live="polite">
        <span className={styles.loadingMark} aria-hidden="true" />
        <span className={styles.loadingText}>Entering Kage</span>
      </div>
    ),
  },
);

export function KageScene() {
  return (
    <main className={styles.scene}>
      <KageLandingPage
        className={styles.frame}
        headingFont="onest"
        bodyFont="onest"
        headingWeight="400"
        bodyWeight="300"
        primaryColor="#2563eb"
        headingSize={46}
        bodySize={17}
        headingLetterSpacing={-0.012}
      />
    </main>
  );
}

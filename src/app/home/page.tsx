import Link from "next/link";
import styles from "../page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.avatar} aria-hidden>
            R
          </div>
          <div className={styles.heroText}>
            <h1 className={styles.name}>Rudraksh Kumawat</h1>
            <p className={styles.role}>Student</p>
            {/* <p className={styles.bio}>
              I build accessible, fast, and delightful web experiences. Currently
              exploring Next.js, TypeScript and design systems.
            </p> */}

            <div className={styles.links}>
              <a
                className={styles.buttonPrimary}
                href="https://github.com/Rudraksh919"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>

              {/* <a
                className={styles.buttonSecondary}
                href="https://www.linkedin.com/in/your-profile"
                target="_blank"src/app/home/page.tsx
                rel="noopener noreferrer"
              >
                LinkedIn
              </a> */}

              {/* <Link href="/projects" className={styles.buttonSecondary}>
                Projects
              </Link> */}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

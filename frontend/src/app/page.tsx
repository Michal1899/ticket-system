import Link from "next/link";
import styles from "./page.module.css";
import EventGridClient from "./EventGridClient";
import { EventItem } from "./types";

async function getEvents(): Promise<EventItem[]> {
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    // ISR: the page is regenerated in the background at most every 30s. The
    // client also fetches fresh data and listens for live updates over
    // websockets, so this only affects the initial server-rendered shell.
    const res = await fetch(`${apiUrl}/api/events`, {
      next: { revalidate: 30 }
    });

    if (!res.ok) {
      console.warn('Failed to fetch events, status:', res.status);
      return [];
    }

    return res.json();
  } catch (error) {
    console.warn('Error fetching events during build/runtime:', error);
    return [];
  }
}

export default async function Home() {
  const events = await getEvents();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}></div>
          <span>TicketSystem</span>
        </div>
        <nav className={styles.nav}>
          <Link href="/">Odkrywaj</Link>
          <Link href="/my-tickets">Moje bilety</Link>
          <Link href="#" className={styles.loginBtn}>Zaloguj się</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1>Niezapomniane Wrażenia Czekają</h1>
            <p className={styles.subtitle}>Odkrywaj i rezerwuj miejsca na najbardziej ekskluzywne wydarzenia na świecie.</p>
          </div>
          <div className={styles.heroDecoration}>
            <div className={styles.blurCircle1}></div>
            <div className={styles.blurCircle2}></div>
          </div>
        </section>

        <section className={styles.eventsSection}>
          <div className={styles.sectionHeader}>
            <h2>Popularne Wydarzenia</h2>
            <div className={styles.filterTabs}>
              <span className={styles.activeTab}>Wszystkie</span>
              <span>Konferencje</span>
              <span>Warsztaty</span>
            </div>
          </div>

          <EventGridClient initialEvents={events} />
        </section>
      </main>
    </>
  );
}

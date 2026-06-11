"use client";

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import styles from './my-tickets.module.css';
import { MyTicket } from '../types';

const EMPTY_TICKETS: MyTicket[] = [];

let cachedRaw: string | null = null;
let cachedTickets: MyTicket[] = EMPTY_TICKETS;

function getMyTickets(): MyTicket[] {
  const raw = localStorage.getItem('my_tickets') || '[]';
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedTickets = JSON.parse(raw);
  }
  return cachedTickets;
}

function getServerSnapshot(): MyTicket[] {
  return EMPTY_TICKETS;
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export default function MyTicketsPage() {
  const tickets = useSyncExternalStore(subscribe, getMyTickets, getServerSnapshot);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}></div>
          <span>SystemBiletowy</span>
        </div>
        <nav className={styles.nav}>
          <Link href="/">Odkrywaj</Link>
          <Link href="/my-tickets">Moje bilety</Link>
          <Link href="#" className={styles.loginBtn}>Zaloguj się</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Moje bilety</h1>
          
          {tickets.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🎫</div>
              <p>Nie zakupiłeś jeszcze żadnych biletów.</p>
              <Link href="/" className={styles.browseBtn}>Przeglądaj wydarzenia</Link>
            </div>
          ) : (
            <div className={styles.ticketList}>
              {tickets.map((ticket, idx) => (
                <div key={idx} className={styles.ticketCard}>
                  <div className={styles.ticketHeader}>
                    <h2>{ticket.eventName}</h2>
                    <span className={styles.badge}>Potwierdzony</span>
                  </div>
                  <div className={styles.ticketBody}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Data wydarzenia:</span>
                      <span className={styles.infoValue}>{format(new Date(ticket.date), "MMMM d, yyyy h:mm a")}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Identyfikator rezerwacji:</span>
                      <span className={styles.infoValueId}>{ticket.reservationId}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Zakupiono:</span>
                      <span className={styles.infoValue}>{format(new Date(ticket.purchasedAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <div className={styles.ticketFooter}>
                    <Link href={`/event/${ticket.eventId}`} className={styles.viewEventLink}>Szczegóły wydarzenia &rarr;</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

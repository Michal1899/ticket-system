"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { io, Socket } from 'socket.io-client';
import styles from './page.module.css';

export default function EventGridClient({ initialEvents }: { initialEvents: any[] }) {
  const [events, setEvents] = useState(initialEvents);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/events`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEvents(data);
        }
      })
      .catch(console.error);

    const socket: Socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

    socket.on('ticket_update', (data: { eventId: number; availableTickets: number }) => {
      setEvents(prev => prev.map(ev => 
        ev.id === data.eventId ? { ...ev, available_tickets: data.availableTickets } : ev
      ));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (events.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Brak dostępnych wydarzeń w tej chwili. Zapraszamy ponownie później.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {events.map((event: any) => (
        <Link href={`/event/${event.id}`} key={event.id} className={styles.card}>
          <div className={styles.cardImagePlaceholder}>
            <span>{format(new Date(event.date), "MMM d")}</span>
          </div>
          <div className={styles.cardBody}>
            <h3>{event.name}</h3>
            <p className={styles.date}>{format(new Date(event.date), "EEEE, h:mm a")}</p>
            <p className={styles.description}>{event.description}</p>
            <div className={styles.stats}>
              <span className={`${styles.badge} ${event.available_tickets === 0 ? styles.badgeSoldOut : ''}`}>
                {event.available_tickets === 0
                  ? 'Wyprzedane'
                  : `Zostało ${event.available_tickets} / ${event.total_tickets}`}
              </span>
              <span className={styles.actionLink}>Szczegóły &rarr;</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

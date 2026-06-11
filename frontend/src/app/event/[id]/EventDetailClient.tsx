"use client";

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { format } from 'date-fns';
import Link from 'next/link';
import styles from './event.module.css';
import { clsx } from 'clsx';
import { EventItem, MyTicket, ReservationData } from '../../types';

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function EventDetailClient({ initialEvent }: { initialEvent: EventItem }) {
  const [availableTickets, setAvailableTickets] = useState(initialEvent.available_tickets);
  const [errorMsg, setErrorMsg] = useState('');
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Countdown for the 5-minute payment window. The interval ticks down the
  // remaining time and, once it hits zero, releases the reservation locally
  // (the backend/cron will have already returned the ticket to the pool).
  useEffect(() => {
    if (!reservation || reservation.paid) return;

    const expiresAt = new Date(reservation.expiresAt).getTime();

    const interval = setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setReservation(null);
        setRemainingSeconds(null);
        setErrorMsg('Czas na płatność minął. Bilet wrócił do puli – możesz zarezerwować ponownie.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation]);

  useEffect(() => {
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

    socket.on('ticket_update', (data: { eventId: number; availableTickets: number }) => {
      if (data.eventId === initialEvent.id) {
        setAvailableTickets(data.availableTickets);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [initialEvent.id]);

  const reserveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: initialEvent.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nie udało się zarezerwować');
      return data as ReservationData;
    },
    onMutate: async () => {
      setErrorMsg('');
      setAvailableTickets((prev: number) => prev - 1);
    },
    onSuccess: (data) => {
      setReservation(data);
      setRemainingSeconds(Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
    },
    onError: (error: Error) => {
      setErrorMsg(error.message);
      // Roll back the optimistic decrement - the reservation didn't go through.
      setAvailableTickets((prev: number) => prev + 1);
    }
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!reservation) throw new Error('Brak aktywnej rezerwacji');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: reservation.reservationId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Płatność nie powiodła się');
      return data;
    },
    onSuccess: () => {
      setReservation((prev) => prev ? { ...prev, paid: true } : prev);

      if (!reservation) return;

      const myTickets: MyTicket[] = JSON.parse(localStorage.getItem('my_tickets') || '[]');
      myTickets.push({
        reservationId: reservation.reservationId,
        eventId: initialEvent.id,
        eventName: initialEvent.name,
        date: initialEvent.date,
        purchasedAt: new Date().toISOString()
      });
      localStorage.setItem('my_tickets', JSON.stringify(myTickets));
    },
    onError: (error: Error) => {
      setErrorMsg(error.message);
      // The reservation can no longer be paid - clear it so the user can try reserving again.
      if (error.message === 'Reservation expired' || error.message === 'Already paid') {
        setReservation(null);
      }
    }
  });

  return (
    <div className={styles.wrapper}>
      <Link href="/" className={styles.backButton}>&larr; Powrót do wydarzeń</Link>
      
      <div className={styles.card}>
        <h1>{initialEvent.name}</h1>
        <p className={styles.date}>{format(new Date(initialEvent.date), "MMMM d, yyyy h:mm a")}</p>
        <p className={styles.description}>{initialEvent.description}</p>
        
        <div className={styles.ticketSection}>
          <div className={styles.counterBox}>
            <span className={styles.counterLabel}>Dostępne bilety</span>
            <span className={clsx(styles.counterValue, availableTickets === 0 && styles.soldOut)}>
              {availableTickets} <span className={styles.totalValue}>/ {initialEvent.total_tickets}</span>
            </span>
          </div>

          {!reservation && (
            <button 
              className={styles.reserveButton}
              onClick={() => reserveMutation.mutate()}
              disabled={availableTickets === 0 || reserveMutation.isPending}
            >
              {reserveMutation.isPending ? 'Rezerwacja...' : availableTickets === 0 ? 'Wyprzedane' : 'Rezerwuj bilet'}
            </button>
          )}

          {errorMsg && <div className={styles.errorToast}>{errorMsg}</div>}

          {reservation && !reservation.paid && (
            <div className={styles.checkoutBox}>
              <h3 className={styles.successTitle}>Bilet zarezerwowany!</h3>
              <p>Masz 5 minut na dokonanie płatności.</p>
              {remainingSeconds !== null && (
                <div className={clsx(styles.countdown, remainingSeconds <= 60 && styles.countdownWarning)}>
                  Pozostały czas: <strong>{formatCountdown(remainingSeconds)}</strong>
                </div>
              )}
              <button
                className={styles.payButton}
                onClick={() => payMutation.mutate()}
                disabled={payMutation.isPending}
              >
                {payMutation.isPending ? 'Przetwarzanie...' : 'Zapłać teraz'}
              </button>
            </div>
          )}

          {reservation && reservation.paid && (
            <div className={styles.checkoutBox}>
              <h3 className={styles.successTitle}>Płatność udana!</h3>
              <p>Twój bilet został potwierdzony.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

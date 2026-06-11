import { Server } from 'socket.io';
import pool from './db';

export const startCronJobs = (io: Server) => {

  setInterval(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');


      const expiredQuery = `
        SELECT id, event_id 
        FROM reservations 
        WHERE status = 'reserved' AND expires_at < NOW()
        FOR UPDATE
      `;
      const { rows: expiredReservations } = await client.query(expiredQuery);

      if (expiredReservations.length > 0) {
        // Group by event_id to efficiently update available_tickets
        const eventUpdates: Record<number, number> = {};
        const reservationIds: number[] = [];

        for (const res of expiredReservations) {
          eventUpdates[res.event_id] = (eventUpdates[res.event_id] || 0) + 1;
          reservationIds.push(res.id);
        }

        // Update reservations to 'timeout'
        await client.query(
          `UPDATE reservations SET status = 'timeout' WHERE id = ANY($1::int[])`,
          [reservationIds]
        );

        // Update events available_tickets
        for (const [eventId, count] of Object.entries(eventUpdates)) {
          const { rows } = await client.query(
            `UPDATE events SET available_tickets = available_tickets + $1 WHERE id = $2 RETURNING id, available_tickets`,
            [count, eventId]
          );

          if (rows.length > 0) {
            // Emit to socket.io
            io.emit('ticket_update', { eventId: rows[0].id, availableTickets: rows[0].available_tickets });
            console.log(`Freed ${count} tickets for event ${eventId}. Available: ${rows[0].available_tickets}`);
          }
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in cron job:', error);
    } finally {
      client.release();
    }
  }, 10000); // 10 seconds
};

import { Router, Request, Response } from 'express';
import pool from './db';
import rateLimit from 'express-rate-limit';

const router = Router();

const reserveLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  message: { error: 'Too many reservation requests, please try again later.' }
});

router.get('/events', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id, name, description, total_tickets, available_tickets, date FROM events ORDER BY date ASC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/reserve', reserveLimiter, async (req: Request, res: Response) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: eventRows } = await client.query(
      'SELECT available_tickets FROM events WHERE id = $1 FOR UPDATE',
      [eventId]
    );

    if (eventRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const availableTickets = eventRows[0].available_tickets;

    if (availableTickets <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tickets are sold out' });
    }

    const { rows: updatedEvent } = await client.query(
      'UPDATE events SET available_tickets = available_tickets - 1 WHERE id = $1 RETURNING available_tickets',
      [eventId]
    );

    const { rows: reservation } = await client.query(
      `INSERT INTO reservations (event_id, status, expires_at) 
       VALUES ($1, 'reserved', NOW() + INTERVAL '5 minutes') 
       RETURNING id, expires_at`,
      [eventId]
    );

    await client.query('COMMIT');

    const newAvailable = updatedEvent[0].available_tickets;

    req.app.get('io').emit('ticket_update', { eventId, availableTickets: newAvailable });

    res.json({
      success: true,
      reservationId: reservation[0].id,
      expiresAt: reservation[0].expires_at,
      availableTickets: newAvailable
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reservation error:', error);
    res.status(500).json({ error: 'Failed to reserve ticket' });
  } finally {
    client.release();
  }
});

router.post('/pay', async (req: Request, res: Response) => {
  const { reservationId } = req.body;
  if (!reservationId) return res.status(400).json({ error: 'reservationId is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: reservationRows } = await client.query(
      'SELECT status, event_id, expires_at FROM reservations WHERE id = $1 FOR UPDATE',
      [reservationId]
    );

    if (reservationRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const { status, event_id, expires_at } = reservationRows[0];

    if (status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already paid' });
    }

    if (status === 'timeout') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reservation expired' });
    }

    if (new Date(expires_at) < new Date()) {
      // Reservation expired but the cron hasn't released it yet - release it now.
      await client.query(`UPDATE reservations SET status = 'timeout' WHERE id = $1`, [reservationId]);

      const { rows: updatedEvent } = await client.query(
        `UPDATE events SET available_tickets = available_tickets + 1 WHERE id = $1 RETURNING available_tickets`,
        [event_id]
      );

      await client.query('COMMIT');

      if (updatedEvent.length > 0) {
        req.app.get('io').emit('ticket_update', { eventId: event_id, availableTickets: updatedEvent[0].available_tickets });
      }

      return res.status(400).json({ error: 'Reservation expired' });
    }

    await client.query(
      `UPDATE reservations SET status = 'paid' WHERE id = $1`,
      [reservationId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Payment successful' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  } finally {
    client.release();
  }
});

export default router;

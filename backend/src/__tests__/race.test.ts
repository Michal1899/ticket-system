import request from 'supertest';
import { app, server, io } from '../index';
import pool from '../db';

describe('Race Conditions', () => {
  let eventId: number;
  const initialTickets = 10; // We'll test with 10 tickets

  beforeAll(async () => {
    // Reset DB for test
    await pool.query('DELETE FROM reservations');
    await pool.query('DELETE FROM events');
    
    const { rows } = await pool.query(
      `INSERT INTO events (name, description, total_tickets, available_tickets, date) 
       VALUES ('Test Event', 'Testing race conditions', $1, $1, NOW() + INTERVAL '1 day') 
       RETURNING id`,
      [initialTickets]
    );
    eventId = rows[0].id;
  });

  afterAll(async () => {
    server.close();
    io.close();
    await pool.end();
  });

  it('should not overbook when multiple requests arrive simultaneously', async () => {
    // Fire 50 concurrent reservation requests
    const concurrentRequests = 50;
    const requests = [];

    for (let i = 0; i < concurrentRequests; i++) {
      requests.push(request(app).post('/api/reserve').send({ eventId }));
    }

    const responses = await Promise.all(requests);

    const successful = responses.filter(r => r.status === 200 && r.body.success);
    const soldOut = responses.filter(r => r.status === 400 && r.body.error === 'Tickets are sold out');
    const errors = responses.filter(r => r.status === 500);

    // Verify exactly 'initialTickets' were successful
    expect(successful.length).toBe(initialTickets);
    // The rest should be sold out
    expect(soldOut.length).toBe(concurrentRequests - initialTickets);
    // No server errors
    expect(errors.length).toBe(0);

    // Verify db state
    const { rows } = await pool.query('SELECT available_tickets FROM events WHERE id = $1', [eventId]);
    expect(rows[0].available_tickets).toBe(0);

    const { rows: reservations } = await pool.query('SELECT COUNT(*) FROM reservations WHERE event_id = $1', [eventId]);
    expect(parseInt(reservations[0].count, 10)).toBe(initialTickets);
  });
});

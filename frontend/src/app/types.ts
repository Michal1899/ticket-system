export interface EventItem {
  id: number;
  name: string;
  description: string;
  total_tickets: number;
  available_tickets: number;
  date: string;
}

export interface ReservationData {
  success: boolean;
  reservationId: number;
  expiresAt: string;
  availableTickets: number;
  paid?: boolean;
}

export interface MyTicket {
  reservationId: number;
  eventId: number;
  eventName: string;
  date: string;
  purchasedAt: string;
}

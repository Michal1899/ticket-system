import EventDetailClient from "./EventDetailClient";
import { notFound } from "next/navigation";

async function getEvent(id: string) {
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res = await fetch(`${apiUrl}/api/events/${id}`, { cache: 'no-store' });
  
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch event');
  }
  
  return res.json();
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  
  if (!event) {
    notFound();
  }

  return <EventDetailClient initialEvent={event} />;
}

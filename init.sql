CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_tickets INTEGER NOT NULL,
    available_tickets INTEGER NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id),
    status VARCHAR(50) NOT NULL, -- 'reserved', 'paid', 'timeout'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed an event
INSERT INTO events (name, description, total_tickets, available_tickets, date) 
VALUES (
    'Tech Conference 2026', 
    'The most anticipated tech event of the year.', 
    100, 
    100, 
    NOW() + INTERVAL '30 days'
);

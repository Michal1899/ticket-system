# System Rezerwacji Biletów "Flash Sale"

Aplikacja do sprzedaży limitowanej puli biletów na wydarzenia, odporna na sytuacje, w których wielu użytkowników próbuje zarezerwować ten sam bilet w tym samym momencie.

## Stack technologiczny

- **Backend:** Node.js, Express 5, TypeScript, PostgreSQL (`pg`), Socket.IO, `express-rate-limit`
- **Frontend:** Next.js (App Router), React, TypeScript, TanStack Query, `socket.io-client`
- **Baza danych:** PostgreSQL 15

## Kluczowe mechanizmy

- **Race condition / overbooking** – endpoint `POST /api/reserve` blokuje wiersz wydarzenia (`SELECT ... FOR UPDATE`) w transakcji, dzięki czemu równoległe żądania są serializowane i nie da się sprzedać więcej biletów niż wynosi dostępna pula. Patrz [backend/src/routes.ts](backend/src/routes.ts).
- **Tymczasowa rezerwacja (5 min)** – rezerwacja dostaje status `reserved` i `expires_at = NOW() + 5 min`. Cron uruchamiany co 10s ([backend/src/cron.ts](backend/src/cron.ts)) zwalnia wygasłe rezerwacje i zwraca bilety do puli. Endpoint `POST /api/pay` dodatkowo sam sprawdza, czy rezerwacja nie wygasła w międzyczasie.
- **Realtime** – Socket.IO emituje zdarzenie `ticket_update` przy każdej zmianie liczby dostępnych biletów (rezerwacja, spóźniona płatność, wygaśnięcie przez cron). Frontend nasłuchuje na liście wydarzeń oraz na stronie szczegółów.
- **Rate limiting** – `POST /api/reserve` ograniczony do 10 żądań/min na IP.
- **Optimistic UI** – strona szczegółów wydarzenia natychmiast zmniejsza licznik dostępnych biletów po kliknięciu "Rezerwuj", a w razie błędu (np. wyprzedane w międzyczasie) cofa zmianę i pokazuje komunikat błędu.

## Uruchomienie – Docker (zalecane)

Wymaga zainstalowanego Dockera i Docker Compose.

```bash
docker compose up --build
```

Po uruchomieniu:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/events
- PostgreSQL: localhost:5432 (`user` / `password`, baza `ticket_db`)

Baza danych jest automatycznie inicjalizowana i seedowana danymi z [init.sql](init.sql) przy pierwszym starcie (wolumin `postgres_data`). Aby zacząć od czystej bazy, usuń wolumin: `docker compose down -v`.

## Uruchomienie lokalne (bez Dockera)

### 1. Baza danych

Najprościej uruchomić samą bazę przez Dockera:

```bash
docker compose up -d db
```

Zostanie utworzona baza `ticket_db` z użytkownikiem `user` / `password` i zseedowana danymi z [init.sql](init.sql).

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

Serwer wystartuje na http://localhost:4000. Domyślne wartości zmiennych środowiskowych ([backend/src/db.ts](backend/src/db.ts)) odpowiadają konfiguracji z `docker-compose.yml`, więc przy bazie z kroku 1 nie trzeba nic dodatkowo ustawiać. W razie potrzeby można je nadpisać w pliku `backend/.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=user
DB_PASSWORD=password
DB_NAME=ticket_db
PORT=4000
CLIENT_URL=http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplikacja wystartuje na http://localhost:3000. Opcjonalnie w `frontend/.env.local` można nadpisać adres API:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Testy

[backend/src/__tests__/race.test.ts](backend/src/__tests__/race.test.ts) wysyła 50 równoległych żądań `POST /api/reserve` na pulę 10 biletów i sprawdza, że dokładnie 10 z nich się powiedzie, a stan bazy pozostanie spójny (brak overbookingu).

```bash
docker compose up -d db
cd backend
npm install
npm test
```

> **Uwaga:** test czyści tabele `events` i `reservations` przed uruchomieniem – nie odpalaj go na bazie zawierającej istotne dane (np. tej samej, na której pracuje `docker-compose`).

Opcja 1: Docker (najprostsza)

docker compose up --build
Uruchamia bazę PostgreSQL + backend + frontend razem. Po starcie:

Frontend: http://localhost:3000
Backend API: http://localhost:4000/api/events
PostgreSQL: localhost:5432 (user/password, baza ticket_db)
Aby zacząć od czystej bazy: docker compose down -v.

Opcja 2: Lokalnie (bez Dockera dla backend/frontend)
1. Baza danych (przez Dockera, najprościej):


docker compose up -d db
2. Backend:


cd backend
npm install
npm run dev
→ http://localhost:4000. Domyślne env-y odpowiadają konfiguracji z docker-compose.yml. Można je nadpisać w backend/.env:


DB_HOST=localhost
DB_PORT=5432
DB_USER=user
DB_PASSWORD=password
DB_NAME=ticket_db
PORT=4000
CLIENT_URL=http://localhost:3000
3. Frontend:


cd frontend
npm install
npm run dev
→ http://localhost:3000. Opcjonalnie w frontend/.env.local:


NEXT_PUBLIC_API_URL=http://localhost:4000

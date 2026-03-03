# Puns Game App (2026 Edition)

## Opis projektu

Puns Game App to interaktywna gra wieloosobowa oparta na planszy, gdzie gracze rywalizują w różnych mini-grach i zadaniach. Wersja 2026 została zaprojektowana od podstaw, wykorzystując nowoczesne technologie front-end i back-end, z obsługą realtime, optymalizacją wydajności i skalowalnością.

## Technologie

### Frontend

* **React 19** – główna biblioteka UI, z nowoczesnym podejściem do hooków i context.
* **TypeScript** – pełna typizacja dla bezpiecznego kodu.
* **React Query (TanStack Query)** – do zarządzania zapytaniami do API i cache.
* **React Router v6** – routing i nawigacja między stronami.
* **Tailwind CSS / SCSS** – nowoczesny system stylów z modularnymi klasami.
* **react-konva** – do planszy umożliwiającej rysowanie „drag-to-paint” zamiast pojedynczych divów.

### Backend

* **NestJS** – struktura modularna, TypeScript, łatwa skalowalność.
* **MongoDB + Prisma ORM** – baza danych NoSQL z pełną typizacją i wygodnym query builderem.
* **Socket.IO** – realtime multiplayer, obsługa eventów między graczami.
* **JWT + HttpOnly cookies** – autoryzacja użytkowników z bezpieczeństwem.

### DevOps / Narzędzia

* **Docker** – konteneryzacja aplikacji dla środowiska produkcyjnego i lokalnego.
* **ESLint + Prettier** – standardy kodowania.
* **Vite / Webpack 6** – szybkie buildy front-end.
* **Vitest / Jest** – testy jednostkowe i integracyjne.

## Struktura projektu

```
project-root/
├─ backend/
│  ├─ src/
│  │  ├─ modules/
│  │  │  ├─ auth/      # logowanie, rejestracja, JWT
│  │  │  ├─ users/     # CRUD użytkowników, statystyki
│  │  │  ├─ game/      # logika gier, stan planszy
│  │  │  └─ socket/    # eventy realtime
│  │  ├─ main.ts       # entrypoint NestJS
│  │  └─ app.module.ts # moduły i konfiguracja
│  └─ prisma/
│     └─ schema.prisma # definicja bazy
│
├─ frontend/
│  ├─ src/
│  │  ├─ pages/        # strony: Login, Register, Profile, GameRoom
│  │  ├─ components/   # komponenty UI: Navbar, Buttons, Stats
│  │  ├─ context/      # Context API dla user, activePage, results
│  │  ├─ hooks/        # custom hooks np. useAuth, useSocket
│  │  ├─ services/     # API service, axios/fetch wrappers
│  │  ├─ styles/       # Tailwind config i SCSS moduły
│  │  └─ App.tsx       # główny komponent + router
│  └─ vite.config.ts

├─ docker-compose.yml
├─ README.md
└─ package.json
```

## Wersjonowanie

* **v0.1** – początek, setup NestJS, React + TypeScript, MongoDB.
* **v0.5** – dodanie Socket.IO, podstawowy multiplayer, plansza rysunkowa.
* **v1.0** – release pierwszej stabilnej wersji, auth JWT, profile użytkowników, statystyki.
* **v1.1** – optymalizacja planszy z drag-to-paint.
* **v1.2** – integracja React Query i Prisma, poprawa UX/UI.

## Funkcje

* Rejestracja/logowanie z JWT i cookie.
* Profile użytkowników z punktami, grami, podium, wygranymi.
* Plansza drag-to-paint z wysoką wydajnością.
* Multiplayer w czasie rzeczywistym dzięki Socket.IO.
* Statystyki i zapis progresu w MongoDB.
* Rozbudowany system routingu i ochrony stron.

## Instrukcja uruchomienia

### Backend

```bash
cd backend
npm install
npm run start:dev  # uruchamia w trybie deweloperskim
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker (opcjonalnie)

```bash
docker-compose up --build
```

## Notatki

* Wszystkie dane użytkowników są typowane w Prisma i synchronizowane z MongoDB.
* Drag-to-paint umożliwia szybkie kolorowanie wielu komórek planszy.
* React Query automatycznie zarządza cache i retry requestów.
* JWT w HttpOnly cookies chroni przed XSS i CSRF.

---
# Punktacja w grze Kalambury

W grze Kalambury punkty przyznawane są zarówno graczom odgadującym hasło, jak i osobie je pokazującej / rysującej.

## Zasady przyznawania punktów
Poprawne odgadnięcie hasła:
Każdy gracz lub drużyna, która odgadnie hasło w czasie rundy, otrzymuje 1 punkt.

## Bonusy dla osoby pokazującej / rysującej:
Gracz pokazujący hasło otrzymuje 1 punkt, jeśli jego hasło zostało poprawnie odgadnięte przez innych.

## Dodatkowy bonus punktowy za szybkość: jeśli hasło zostanie odgadnięte w pierwszej połowie czasu rundy → +1 punkt dla odgadującego i +1 punkt dla pokazującego.

## Niepoprawne lub nieodgadnięte hasło:
W przypadku gdy nikt nie odgadnie hasła w czasie rundy, punkty nie są przyznawane.

## Statystyki gracza
W aplikacji można śledzić dla każdego gracza:
* Punkty zdobyte
* Liczbę odgadniętych haseł
* Liczbę rund rozegranych jako pokazujący
* Wygrane rundy i miejsca na podium

Dzięki temu systemowi punktowania każdy gracz jest motywowany zarówno do kreatywnego pokazywania, jak i aktywnego odgadywania haseł.

*Puns Game App 2026 – nowoczesny, skalowalny i typowany stack dla interaktywnych gier multiplayer.*

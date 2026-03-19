# Scrum App

SMRPO projekt — spletna aplikacija za upravljanje Scrum projektov, zgrajena z metodologijo Scrumban.

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)

---

## Kazalo

- [Tehnologije](#tehnologije)
- [Struktura projekta](#struktura-projekta)
- [Strani in funkcionalnosti](#strani-in-funkcionalnosti)
- [Sistem vlog](#sistem-vlog)
- [API endpointi](#api-endpointi)
- [Namestitev in zagon](#namestitev-in-zagon)
- [Prva prijava](#prva-prijava)
- [Opombe](#opombe)

---

## Tehnologije

| Tehnologija | Verzija | Namen |
|---|---|---|
| Next.js | 16.1.6 (Turbopack) | Frontend framework, App Router |
| React | 19.2.3 | UI knjižnica |
| TypeScript | ^5 | Statično tipanje |
| Tailwind CSS | ^4 | Stiliranje komponent |
| Supabase | ^2.98 | PostgreSQL baza, avtentikacija, RLS |
| Lucide React | ^0.577 | Ikone |
| next-swagger-doc | ^0.4.1 | Generiranje Swagger dokumentacije |
| swagger-ui-react | ^5.32 | Prikaz API dokumentacije |
| Jest + ts-jest | ^30 | Testiranje |

---

## Struktura projekta

```
app/
├── (auth)/                     # Strani za avtentikacijo (brez navigacije)
│   └── login/                  # Stran za prijavo
├── (main)/                     # Zaščitene strani z navigacijo
│   ├── projects/               # Seznam projektov
│   │   └── [projectId]/        # Dinamična stran projekta
│   │       ├── backlog/        # Product backlog
│   │       ├── board/          # Sprint board
│   │       ├── settings/       # Nastavitve projekta
│   │       ├── sprints/        # Upravljanje sprintov
│   │       ├── team/           # Člani projekta
│   │       └── time-tracking/  # Sledenje časa (v razvoju)
│   └── users/                  # Upravljanje uporabnikov (admin)
├── api/                        # API route handlers
└── api-docs/                   # Swagger UI dokumentacija
```

---

## Strani in funkcionalnosti

### Avtentikacija

| Stran | Opis |
|---|---|
| `/login` | Prijava z email in geslom. Podpira MFA (TOTP). Ob uspešni prijavi preusmeri na `/projects`. |

### Projekti

| Stran | Opis |
|---|---|
| `/projects` | Seznam vseh projektov. Administrator lahko ustvari nov projekt. |
| `/projects/[projectId]` | Pregled projekta z navigacijo do podstrani. |
| `/projects/[projectId]/backlog` | Product backlog: seznam vseh zgodb, razvrščenih po statusu (unassigned, assigned, realized). |
| `/projects/[projectId]/board` | Sprint board: Kanban prikaz nalog aktivnega sprinta, razvrščenih po zgodbah in statusu. |
| `/projects/[projectId]/sprints` | Upravljanje sprintov: ustvarjanje, pregled in status (planned, active, completed). |
| `/projects/[projectId]/team` | Člani projekta: pregled in dodajanje članov z vlogami. |
| `/projects/[projectId]/settings` | Nastavitve projekta: sprememba statusa (active, on_hold, completed). |
| `/projects/[projectId]/time-tracking` | Sledenje časa *(v razvoju)*. |

### Administracija

| Stran | Opis |
|---|---|
| `/users` | Seznam vseh uporabnikov. Samo administrator. Možnost ustvarjanja novih uporabnikov. |

### Dokumentacija

| Stran | Opis |
|---|---|
| `/api-docs` | Swagger UI prikaz vseh API endpointov z request/response shemami. |

---

## Sistem vlog

### Sistemske vloge
Določene v tabeli `users` — veljajo globalno za celotno aplikacijo.

| Vloga | Pravice |
|---|---|
| `admin` | Ustvarjanje projektov, upravljanje vseh uporabnikov, dostop do `/users`. |
| `user` | Dostop samo do projektov, katerih je član. |

### Projektne vloge
Določene v tabeli `project_members` — veljajo znotraj posameznega projekta.

| Vloga | Pravice |
|---|---|
| `product_owner` | Ustvarjanje in urejanje zgodb, upravljanje backlogа, dodajanje članov. |
| `scrum_master` | Ustvarjanje sprintov, dodajanje nalog, upravljanje statusa projekta. |
| `developer` | Sprejemanje nalog, sledenje časa, posodabljanje statusa nalog. |

---

## API endpointi

Celotna dokumentacija je dostopna na `/api-docs` (Swagger UI).

| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/auth/me` | Podatki prijavljenega uporabnika |
| `POST` | `/api/auth/login` | Prijava (+ MFA podpora) |
| `POST` | `/api/auth/change-password` | Sprememba gesla |
| `GET` | `/api/projects` | Seznam projektov |
| `POST` | `/api/projects` | Ustvarjanje projekta (admin) |
| `PATCH` | `/api/projects/[projectId]` | Sprememba statusa projekta |
| `GET` | `/api/projects/[projectId]/backlog` | Product backlog |
| `POST` | `/api/projects/[projectId]/backlog/assign` | Dodelitev zgodb sprintu |
| `GET` | `/api/projects/[projectId]/members` | Člani projekta |
| `POST` | `/api/projects/[projectId]/members` | Dodajanje članov (bulk) |
| `GET` | `/api/projects/[projectId]/members/me` | Vloga trenutnega uporabnika |
| `GET` | `/api/projects/[projectId]/sprints` | Seznam sprintov |
| `POST` | `/api/projects/[projectId]/sprints` | Ustvarjanje sprinta |
| `GET` | `/api/projects/[projectId]/stories` | Seznam zgodb |
| `POST` | `/api/projects/[projectId]/stories` | Ustvarjanje zgodbe |
| `PATCH` | `/api/stories/[storyId]` | Urejanje zgodbe |
| `DELETE` | `/api/stories/[storyId]` | Brisanje zgodbe |
| `GET` | `/api/stories/[storyId]/tasks` | Naloge zgodbe |
| `POST` | `/api/stories/[storyId]/tasks` | Ustvarjanje naloge |
| `GET` | `/api/tasks` | Naloge (query param `storyId`) |
| `POST` | `/api/tasks` | Ustvarjanje naloge (osnovno) |
| `GET` | `/api/tasks/[taskId]` | Posamezna naloga |
| `PATCH` | `/api/tasks/[taskId]` | Posodobitev naloge (accept / resign / edit / status) |
| `DELETE` | `/api/tasks/[taskId]` | Brisanje naloge |
| `POST` | `/api/tasks/[taskId]/start` | Začetek dela na nalogi |
| `POST` | `/api/tasks/[taskId]/stop` | Konec dela + beleženje časa |
| `GET` | `/api/users` | Seznam uporabnikov (admin) |
| `POST` | `/api/users` | Ustvarjanje uporabnika (admin) |
| `GET` | `/api/users/profile` | Profil prijavljenega uporabnika |
| `PUT` | `/api/users/profile` | Posodobitev profila |

---

## Namestitev in zagon

### Predpogoji

- Node.js v18 ali novejši
- npm
- Supabase projekt (brezplačni plan zadostuje)
- Git

### 1. Kloniranje repozitorija

```bash
git clone https://github.com/kajagr/scrum_dashboard.git
cd scrum_dashboard
```

### 2. Namestitev odvisnosti

```bash
npm install
```

### 3. Konfiguracija okolja

Ustvari datoteko `.env.local` v korenu projekta:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

> Vrednosti najdeš v Supabase nadzorni plošči: **Project Settings → API**.

### 4. Zagon razvojnega strežnika

```bash
npm run dev
```

Aplikacija je dostopna na: **http://localhost:3000**  
API dokumentacija: **http://localhost:3000/api-docs**

### 5. Build za produkcijo

```bash
npm run build
npm run start
```

### 6. Testiranje

```bash
npm test
```

---

## Prva prijava

Ker aplikacija ne omogoča samoregistracije, mora administrator ročno ustvariti prvega uporabnika:

1. V Supabase nadzorni plošči: **Authentication → Users** → ustvari novega uporabnika.
2. V tabeli `users` nastavi `system_role = 'admin'` za tega uporabnika.
3. Prijavi se na `/login` — administrator nato ustvarja ostale uporabnike prek `/users`.

---

## Opombe

- Stran `/time-tracking` je zaenkrat prazna in v razvoju.
- Avtentikacija temelji na Supabase session cookies — ni potrebna ročna obravnava JWT žetonov.
- Vsi API klici iz fronttenda gredo skozi Next.js API route handlers, ne direktno na Supabase.
- RLS (Row Level Security) je aktiviran na vseh tabelah — backend validira pravice pred vsako operacijo.

# CONTEXT — Qanooni Polymers System Truth

Last updated: 2026-07-26

## Purpose

Qanooni Polymers full-stack app: login + dashboard shell + raw materials + stock + roll production.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + React Router + Axios |
| Backend | Node + Express |
| Database | Oracle MySQL 8.4 (`mysql2`) + MySQL Workbench (local) / Railway MySQL (prod) |
| Auth | Env credentials + JWT |

## Architecture

`routes → controllers → services → repositories → db`  
`UI → context → api → Express`

## Raw materials

- Table: `raw_materials` (`id`, `slug`, `name`, `swatch`, `created_at`)
- Auto-created on server start (`ensureSchema`)
- APIs (auth required):
  - `GET /api/raw-materials`
  - `POST /api/raw-materials` `{ name }`
  - `PUT /api/raw-materials/:slug` `{ name }`
  - `DELETE /api/raw-materials/:slug`
  - `GET /api/raw-materials/:slug`
- UI: `/raw-material` — full-width rows with bags/kg + grand totals; **Add New / Edit / Delete**; sidebar from DB
- List API returns `{ items, totals }` (each item includes `totalBags` / available `totalKg` after roll cuts)
- Sidebar: Raw Material accordion open/close (chevron toggle; auto-open on child route)
- Sidebar: **Mills & Production** (folder only — no page) → **Roll** (`/mills-production/roll`) / **Bundle** (`/mills-production/bundle`)
  - Roll icon = round pipe roll; Bundle icon = stacked straight pipes
- Swatch matches color name (`blue` → blue, `red` → red, also `#hex` / “dark blue”)

## Stock (per material)

- Table: `raw_material_stocks` (`id`, `raw_material_id`, `stock_date`, `supplier`, `bags`, `kg`, `created_at`)
- Standard: **1 bag = 40 kg** (`kg` auto-calculated server-side)
- Bags must be whole numbers on stock entry (`1, 2, 3…`)
- When rolls consume kg, available bags also drop (`usedKg / 40`)
- Dates display as **DD-MM-YYYY**
- APIs (auth required):
  - `GET /api/raw-materials/:slug/stocks` → material + items + totals (available kg after rolls)
  - `POST /api/raw-materials/:slug/stocks` `{ date, supplier, bags }`
  - `PUT /api/raw-materials/:slug/stocks/:stockId` `{ date, supplier, bags }`
  - `DELETE /api/raw-materials/:slug/stocks/:stockId`
- UI: `/raw-material/:slug` — title + available quantity + stocked/used + full-width rows with **Edit / Delete** + **Add Stock**

## Roll production

- Table: `roll_productions` (`id`, `raw_material_id`, `production_date`, `size`, `kg`, `created_at`)
- Sizes: `1/2"`, `3/4"`, `1"`
- KG can be fractional (e.g. `18.5`); deducted from selected raw material available kg
- APIs (auth required):
  - `GET /api/rolls`
  - `POST /api/rolls` `{ date, materialSlug, size, kg }`
  - `PUT /api/rolls/:id`
  - `DELETE /api/rolls/:id`
- UI: `/mills-production/roll` — Add Production / Edit / Delete

## Auth

- Login: `asdf123` / `asdf123` (dev + current prod demo)
- Token: `qp_token`

## Env

`MYSQL_DATABASE=Qanooni_db`  
Also supports `MYSQL_URL` / `DATABASE_URL` and Railway `MYSQLHOST` / `MYSQLUSER` / etc.  
`CLIENT_ORIGIN` — comma-separated allowed browser origins (`*` allowed)  
Client: `VITE_API_URL` (prod API base, e.g. `https://api…/api`)

## Deploy (live)

| Piece | Host | URL |
|-------|------|-----|
| Client | Vercel | https://qanooni-polymers.vercel.app |
| API | Railway | https://api-production-be0d8.up.railway.app |
| MySQL | Railway MySQL | private (same Railway project) |
| GitHub | — | https://github.com/FahadAli990/qanooni-polymers |

Health: `GET https://api-production-be0d8.up.railway.app/api/health`

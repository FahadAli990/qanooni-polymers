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

- Table: `raw_materials` (`id`, `slug`, `name`, `swatch`, `price_per_kg`, `created_at`)
- Auto-created on server start (`ensureSchema`)
- APIs (auth required):
  - `GET /api/raw-materials`
  - `POST /api/raw-materials` `{ name }`
  - `PUT /api/raw-materials/:slug` `{ name }`
  - `PUT /api/raw-materials/:slug/price` `{ pricePerKg }` — per-material selling rate
  - `DELETE /api/raw-materials/:slug`
  - `GET /api/raw-materials/:slug`
- UI: `/raw-material` — list with **Price / kg**, bags/kg; `/raw-material/:slug` — **Save Price** + stock ledger
- List API returns `{ items, totals }` (each item includes `pricePerKg`, `totalBags` / available `totalKg`)
- Sidebar: Raw Material accordion open/close (chevron toggle; auto-open on child route)
- Sidebar: **Mills & Production** (folder only — no page) → **Roll** (`/mills-production/roll`) / **Bundle** (folder)
  - Bundle → **Chaat** / **Dewaar**
  - Roll icon = round pipe roll; Bundle icon = stacked pipes; Chaat = roof; Dewaar = brick wall
- Top-level **Routes** (same level as Raw Material / Mills & Production) — `/routes`
  - **No sidebar children** — open routes only from page boxes
- Top-level **Orders** (below Routes) — `/orders`

## Orders (sales)

- Tables: `sales_orders` + `sales_order_items`
- Flow: Date → Route → Shop → product kinds → materials/kg → saved as **Pending**
- **Deliver** (one-way): Pending → Delivered only; cannot return to Pending
- On deliver: each material’s available stock drops by ordered kg (same pool as production: stocked − production used − delivered orders)
- Deliver blocked if available kg is insufficient; delivered orders cannot be deleted
- Bill = Σ(kg × material `price_per_kg`); order blocked if a selected material has no price set
- APIs (auth required):
  - `GET /api/orders`
  - `GET /api/orders/rates` — materials + live `ratePerKg` from `price_per_kg`
  - `POST /api/orders` `{ date, routeSlug, customerId, kinds, items }` → status `pending`
  - `POST /api/orders/:id/deliver`
  - `DELETE /api/orders/:id` (pending only)
- UI table: Date, Route, Shop, Address, Phone, Ordered (kinds + materials/kg), Total Bill

## Routes (delivery / sales)

- Table: `mill_routes` (`id`, `slug`, `name`, `created_at`)
- APIs (auth required):
  - `GET /api/routes`
  - `POST /api/routes` `{ name }`
  - `GET /api/routes/:slug`
  - `PUT /api/routes/:slug` `{ name }`
  - `DELETE /api/routes/:slug`
- UI: `/routes` — box/card grid (Add New / Edit / Delete); click box → `/routes/:slug`
- Each route box gets a **stable unique icon + accent** from slug (`routeVisual.js`)
- Route detail (`/routes/:slug`): **Add Customer** (multiple) — Shop Name, Address, Owner Name, Contact Number
  - All fields required
  - Contact: digits only, **exactly 11** (`/^\d{11}$/`)
  - APIs: `GET|POST /api/routes/:slug/customers`, `PUT|DELETE /api/routes/:slug/customers/:customerId`
  - Table: `route_customers` (FK → `mill_routes`, cascade delete)
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

## Roll / Chaat / Dewaar production

- Table: `roll_productions` (`id`, `kind`, `raw_material_id`, `production_date`, `size`, `kg`, `created_at`)
- `kind`: `roll` | `chaat` | `dewaar` (all deduct from same raw material stock)
- Sizes: `1/2"`, `3/4"`, `1"`
- KG can be fractional (e.g. `18.5`)
- APIs (auth required):
  - `GET /api/productions/:kind`
  - `POST /api/productions/:kind` `{ date, materialSlug, size, kg }`
  - `PUT /api/productions/:kind/:id`
  - `DELETE /api/productions/:kind/:id`
- UI:
  - `/mills-production/roll`
  - `/mills-production/bundle/chaat`
  - `/mills-production/bundle/dewaar`
- Color picker shows swatch + name

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

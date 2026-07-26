# CONTEXT — Qanooni Polymers System Truth

Last updated: 2026-07-27 (Maintenance, Rents, Workers & Salary)

## Purpose

Qanooni Polymers full-stack app: login + dashboard shell + raw materials + stock + roll production.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + React Router + Axios + jsPDF |
| Backend | Node + Express |
| Database | Oracle MySQL 8.4 (`mysql2`) + MySQL Workbench (local) / Railway MySQL (prod) |
| Auth | Env credentials + JWT |

## Architecture

`routes → controllers → services → repositories → db`  
`UI → context → api → Express`

## Raw materials

- Table: `raw_materials` (`id`, `slug`, `name`, `swatch`, `price_per_kg` legacy unused, `created_at`)
- Auto-created on server start (`ensureSchema`)
- APIs (auth required):
  - `GET /api/raw-materials`
  - `POST /api/raw-materials` `{ name }`
  - `PUT /api/raw-materials/:slug` `{ name }`
  - `DELETE /api/raw-materials/:slug`
  - `GET /api/raw-materials/:slug`
- UI: `/raw-material` — material name + **In Stock Now** (bags·kg); total qty across all colors
- `/raw-material/:slug` — stock ledger; **Purchase Amount / kg** per supplier entry (no sell rate on materials); supplier from **dropdown** (`supplierId`)
- List API returns `{ items, totals }` (`totalBags` / `totalKg`)
- Sidebar: Raw Material accordion open/close (chevron toggle; auto-open on child route)
- Sidebar: **Mills & Production** (folder only — no page) → **Roll** (`/mills-production/roll`) / **Bundle** (folder)
  - Bundle → **Chaat** / **Dewaar**
  - Roll icon = round pipe roll; Bundle icon = stacked pipes; Chaat = roof; Dewaar = brick wall
- Top-level **Routes** (same level as Raw Material / Mills & Production) — `/routes`
  - **No sidebar children** — open routes only from page boxes
- Top-level **Orders** (below Routes) — `/orders`
- Top-level **Bills & Payments** (below Orders) — `/bills-payments` (customer / shop ledger + Print PDF)
- Top-level **Suppliers** (below Bills & Payments) — `/suppliers`
- Top-level **Daily Expense** (below Suppliers) — `/daily-expense`
- Top-level **Maintenance** — `/maintenance`
- Top-level **Rents** — `/rents`
- Top-level **Workers & Salary** — `/workers`

## Maintenance

- Table: `maintenance_expenses` (`id`, `expense_date`, `title`, `amount`, `note`, `created_at`)
- Use: machine wear & tear / repair costs
- UI: date picker → list + selected-day total + all-time total + Add/Edit/Delete
- APIs: `GET|POST /api/maintenance`, `PUT|DELETE /api/maintenance/:id` (same shape as Daily Expense)

## Rents

- Tables: `rent_buildings` (`name`, `monthly_rent`, `note`), `rent_payments` (`building_id`, `payment_date`, `for_month`, `amount`, `note`)
- Per building + month: due = monthly rent; paid = sum payments; Unpaid/Partial/Paid + advance
- UI: buildings CRUD → select building + month → payments CRUD
- Delete building blocked if payments exist
- APIs: `GET|POST /api/rents`, `PUT|DELETE /api/rents/:id`, `GET /api/rents/:id/ledger?month=YYYY-MM`, payments nested

## Workers & Salary

- Tables: `workers` (`name`, `contact` 11 digits, `fixed_salary`, `note`), `worker_leaves` (`leave_date`, `days`), `worker_salary_payments` (`for_month`, `amount`)
- Month ledger: `leaveCut = fixedSalary/30 * leaveDays`; `payable = max(fixed - cut, 0)`; payments → Unpaid/Partial/Paid + advance
- UI: workers CRUD → select worker + month → leaves + salary payments
- Delete worker blocked if leave/salary history
- APIs: `GET|POST /api/workers`, `PUT|DELETE /api/workers/:id`, `GET /api/workers/:id/ledger?month=`, leaves + payments nested

## Daily Expense

- Table: `daily_expenses` (`id`, `expense_date`, `title`, `amount`, `note`, `created_at`)
- Use: tea, biscuits, food, and other daily factory expenses
- UI: date picker → day list + **Selected day total** + **All-time total** + Add/Edit/Delete
- Fields: Date, Expense title, Amount (Rs), Note (optional)
- APIs (auth required):
  - `GET /api/expenses?date=YYYY-MM-DD` → `{ date, items, totals: { dayTotal, total } }`
  - `POST /api/expenses` `{ date, title, amount, note? }`
  - `PUT /api/expenses/:id`
  - `DELETE /api/expenses/:id?date=`

## Suppliers

- Tables:
  - `suppliers` (`id`, `name`, `contact` 11 digits, `created_at`) — unique name
  - `supplier_payments` (`id`, `supplier_id`, `payment_date`, `amount`, `note`, `created_at`)
- Stock links via `raw_material_stocks.supplier_id` (+ denormalized `supplier` name)
- Hisab: purchases = stock totals for supplier; payments allocate FIFO → Unpaid / Partial / Paid
- Summary: `totalPurchased`, `totalPaid`, `remaining` (due), `advance` (if overpaid)
- UI: Name + Contact CRUD → select supplier → purchases table + payments CRUD + **Print PDF**
- APIs (auth required):
  - `GET|POST /api/suppliers`
  - `PUT|DELETE /api/suppliers/:id` (delete blocked if purchase/payment history)
  - `GET /api/suppliers/:id/ledger`
  - `POST /api/suppliers/:id/payments`
  - `PUT|DELETE /api/suppliers/:id/payments/:paymentId`
- PDF: simple jsPDF download of supplier ledger (purchases + payments + due/advance)

## Bills & Payments (customers)

- Table: `customer_payments` (`id`, `route_customer_id`, `payment_date`, `amount`, `note`, `created_at`)
- Bills = **delivered** `sales_orders` for that shop (`total_bill`); pending orders excluded
- Balance: `totalBilled − totalPaid = remaining`
- Bill pay status (display): Unpaid / Partial / Paid — payments allocate FIFO to oldest bills
- UI: Route dropdown → Shop dropdown → shop details + summary + bills table + payments CRUD + **Print PDF**
- APIs (auth required):
  - `GET /api/bills/shop?routeSlug=&customerId=` → shop, summary, bills[], payments[]
  - `POST /api/bills/payments` `{ routeSlug, customerId, date, amount, note? }`
  - `PUT /api/bills/payments/:id`
  - `DELETE /api/bills/payments/:id?routeSlug=&customerId=`
- PDF: simple jsPDF download of customer ledger (bills + payments + remaining)

## Orders (sales)

- Tables: `sales_orders` + `sales_order_items` (`kind`, `size`, material, kg, rate, amount)
- Flow: Date → Route → Shop → **order lines** (each: Roll/Chaat/Dewaar + size `1/2"|3/4"|1"` + material + kg + **sell rate/kg**) → **Pending**
- **Deliver** (one-way UI action, reversible): Pending → Delivered; admin can move **Delivered → Pending**
- On deliver: **FIFO consume finished production** matching each line (`kind` + `size` + material), oldest `production_date` first
  - Partial: one production row remaining drops; overflow takes from next date in FIFO order
  - When remaining hits 0 → `status = used` and row **leaves Mills & Production list** (history stays on Orders / Delivered)
  - Deliver blocked if matching production remaining kg is insufficient
  - Consumptions stored in `sales_order_consumptions` for exact undo
- On **Pending** (undo deliver) / **Delete delivered**: production remaining restored onto original lots (oldest date first); if lot missing, recreate/expand so Pending/Delete always succeeds
- Admin can **Edit** any order (delivered edit restores stock and returns order to Pending)
- Admin can **Delete** pending or delivered orders
- Raw stock is only cut when production is recorded (not again on deliver)
- Bill = Σ(kg × line `ratePerKg`); rate entered on each order line (not from raw materials)
- APIs (auth required):
  - `GET /api/orders`
  - `GET /api/orders/rates` → `{ sizes, kinds, materials }`
  - `POST /api/orders` `{ date, routeSlug, customerId, items: [{ kind, size, materialSlug, kg, ratePerKg }] }` → `pending`
  - `PUT /api/orders/:id` — edit (delivered → pending after stock restore)
  - `POST /api/orders/:id/deliver`
  - `POST /api/orders/:id/pending` — delivered → pending + restore production
  - `DELETE /api/orders/:id` (pending or delivered)
- UI table: Date, Route, Shop, Address, Phone, Ordered (type · size · material · kg), Total Bill, Status

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

- Table: `raw_material_stocks` (`id`, `raw_material_id`, `stock_date`, `supplier`, `supplier_id`, `bags`, `kg`, `price_per_kg`, `created_at`)
- Standard: **1 bag = 40 kg** (`kg` auto-calculated server-side)
- Bags must be whole numbers on stock entry (`1, 2, 3…`)
- When rolls consume kg, available bags also drop (`usedKg / 40`)
- Dates display as **DD-MM-YYYY**
- Supplier must be selected from `suppliers` (`supplierId` required); name denormalized onto `supplier`
- APIs (auth required):
  - `GET /api/raw-materials/:slug/stocks` → material + items + totals (available kg after rolls)
  - `POST /api/raw-materials/:slug/stocks` `{ date, supplierId, bags, pricePerKg }`
  - `PUT /api/raw-materials/:slug/stocks/:stockId` `{ date, supplierId, bags, pricePerKg }`
  - `DELETE /api/raw-materials/:slug/stocks/:stockId`
- UI: `/raw-material/:slug` — stock ledger with **Purchase Amount / kg** + **Total Paid** per supplier entry; Add Stock requires supplier dropdown + bags + purchase price/kg (total = kg × price)
- Stock table column: `price_per_kg` on `raw_material_stocks`

## Roll / Chaat / Dewaar production

- Table: `roll_productions` (`id`, `kind`, `raw_material_id`, `production_date`, `size`, `kg` original, `remaining_kg`, `status` available|used, `created_at`)
- `kind`: `roll` | `chaat` | `dewaar` (all deduct original `kg` from same raw material stock)
- Sizes: `1/2"`, `3/4"`, `1"`
- KG can be fractional (e.g. `18.5`)
- Delivered orders reduce `remaining_kg` FIFO; fully used batches are hidden from production UI (kept in DB for raw accounting); list shows only remaining stock with Edit + Delete
- Lists sorted by **created_at ASC** (newest at bottom) across app tables
- APIs (auth required):
  - `GET /api/productions/:kind`
  - `POST /api/productions/:kind` `{ date, materialSlug, size, kg }`
  - `PUT /api/productions/:kind/:id`
  - `DELETE /api/productions/:kind/:id`
- UI:
  - `/mills-production/roll`
  - `/mills-production/bundle/chaat`
  - `/mills-production/bundle/dewaar`
- Color picker shows swatch + name; table shows Remaining KG only for still-available batches

## Auth

- Login: `asdf123` / `asdf123` (dev + current prod demo)
- Token: `qp_token`

## Env

`MYSQL_DATABASE=Qanooni_db`  
Also supports `MYSQL_URL` / `DATABASE_URL` and Railway `MYSQLHOST` / `MYSQLUSER` / etc.  
`CLIENT_ORIGIN` — comma-separated allowed browser origins (`*` allowed)  
Client: `VITE_API_URL` (prod API base, e.g. `https://api…/api`) — set in `client/.env.production` for Vercel builds

## Deploy (live)

| Piece | Host | URL |
|-------|------|-----|
| Client | Vercel | https://qanooni-polymers.vercel.app |
| API | Railway | https://api-production-be0d8.up.railway.app |
| MySQL | Railway MySQL | private (same Railway project) |
| GitHub | — | https://github.com/FahadAli990/qanooni-polymers |

Health: `GET https://api-production-be0d8.up.railway.app/api/health`

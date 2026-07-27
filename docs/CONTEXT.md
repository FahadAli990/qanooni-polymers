# CONTEXT — Qanooni Polymers System Truth

Last updated: 2026-07-27 (Vehicle trips + gas per kg + select UX)

## Purpose

Qanooni Polymers full-stack app: login + dashboard shell + raw materials + stock + roll production.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + React Router + Axios + jsPDF |
| Backend | Node + Express |
| Database | Oracle MySQL 8.4 (`mysql2`) + MySQL Workbench (local) / Railway MySQL (prod) |
| Auth | JWT + `app_users` (admin seeded from env; managers CRUD by admin) |

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
- Top-level **Vehicle Fare** — `/vehicle-fare` (legacy `/rents` redirects)
- Top-level **Utility Bills** — `/utility-bills` (above Workers)
- Top-level **Workers & Salary** — `/workers`
- Top-level **Managers** (admin only) — `/managers`

## Maintenance

- Table: `maintenance_expenses` (`id`, `expense_date`, `title`, `amount`, `note`, `created_at`)
- Use: machine wear & tear / repair costs
- UI: date picker → list + selected-day total + all-time total + Add/Edit/Delete
- APIs: `GET|POST /api/maintenance`, `PUT|DELETE /api/maintenance/:id` (same shape as Daily Expense)

## Vehicle Fare

- Use: vehicles that carry goods — **per delivery** fare (not fixed daily)
- Sidebar label: **Vehicle Fare** (`/vehicle-fare`; `/rents` redirects here)
- Tables:
  - `rent_vehicles` (`name`, `note`) — no fixed fare
  - `rent_trips` (`vehicle_id`, `trip_date`, `destination`, `fare_amount`, `note`) — where maal gaya + kitne paise
  - `rent_payments` (`vehicle_id`, `payment_date`, `amount`, `note`) — FIFO → Unpaid/Partial/Paid per trip
- Ledger: totalFare / totalPaid / remaining / advance + trip list with pay status
- UI: vehicle select (dropdown or row click; selected-only table) → Add Trip (date, destination, fare) + payments
- APIs: `GET|POST /api/rents`, `PUT|DELETE /api/rents/:id`, `GET /api/rents/:id/ledger`, trips + payments nested
- Legacy: `daily_fare` dropped; `for_date`/`for_month` dropped from payments; buildings migrated earlier

## Utility Bills

- Sidebar: **Utility Bills** (`/utility-bills`) — above Workers
- Tabs:
  1. **Gas cylinders** — gas suppliers + daily cylinder purchases + partial payments
  2. **Other utility bills** — electricity / water / internet / other (day list + totals)
- Tables:
  - `gas_suppliers` (`name`, `contact` 11 digits, `note`)
  - `gas_purchases` (`supplier_id`, `purchase_date`, `due_date`, `cylinder_kg`, `cylinders_count`, `price_per_kg`, `total_amount`, `note`)
  - `gas_payments` (`supplier_id`, `payment_date`, `amount`, `note`)
  - `utility_bills` (`bill_date`, `due_date`, `category`, `title`, `amount`, `pay_status` paid|unpaid, `note`)
- Gas ledger: purchases FIFO → Unpaid/Partial/Paid; summary purchased/paid/remaining/advance + total cylinders/kg
- Purchase total = `cylinder_kg * cylinders_count * price_per_kg` (API body: `pricePerKg`)
- Due date required on gas purchases + other utility bills; other bills have Paid/Unpaid status
- Due reminders: unpaid (or partial gas) items with `due_date <= today + 2 days` → English in-app banner on login (`GET /api/utility/due-reminders`)
- UI: gas suppliers list filters to selected row when `supplierId` set; row click selects; “Show all suppliers” clears; Edit also sets selection
- APIs (`/api/utility`, auth required):
  - `GET /api/utility/due-reminders`
  - `GET|POST /api/utility/suppliers`, `PUT|DELETE /api/utility/suppliers/:id`
  - `GET /api/utility/suppliers/:id/ledger`
  - `POST|PUT|DELETE .../purchases` and `.../payments`
  - `GET|POST /api/utility/bills`, `PUT|DELETE /api/utility/bills/:id`

## Workers & Salary

- Tables: `workers` (`name`, `contact` 11 digits, `fixed_salary`, `address`, `photo`, `id_card_front`, `id_card_back`, `note`), `worker_leaves` (`leave_date`, `days`), `worker_salary_payments` (`for_month`, `amount`)
- Worker photo + ID card front/back stored as compressed JPEG data-URLs (`MEDIUMTEXT`); list API omits blobs (`hasPhoto`, `hasIdCardFront`, `hasIdCardBack` flags only)
- Month ledger: `leaveCut = fixedSalary/30 * leaveDays`; `payable = max(fixed - cut, 0)`; payments → Unpaid/Partial/Paid + advance
- UI: workers CRUD (name, contact, address, salary, worker photo, ID front/back) → select worker + month → leaves + salary payments; list filters to selected worker; row click selects; “Show all workers” clears
- Delete worker blocked if leave/salary history
- APIs: `GET|POST /api/workers`, `GET /api/workers/:id` (full + images), `PUT|DELETE /api/workers/:id`, `GET /api/workers/:id/ledger?month=`, leaves + payments nested
- JSON body limit raised to `5mb` for image uploads
- Create requires worker photo + both ID images; update keeps existing images if field omitted

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
- UI: Name + Contact CRUD → select supplier (dropdown or row click) → purchases table + payments CRUD + **Print PDF**; list filters to selected supplier; “Show all suppliers” clears
- APIs (auth required):
  - `GET|POST /api/suppliers`
  - `PUT|DELETE /api/suppliers/:id` (delete blocked if purchase/payment history)
  - `GET /api/suppliers/:id/ledger`
  - `POST /api/suppliers/:id/payments`
  - `PUT|DELETE /api/suppliers/:id/payments/:paymentId`
- PDF: simple jsPDF download of supplier ledger (purchases + payments + due/advance)

## Bills & Payments (customers)

- Tables:
  - `customer_payments` (`id`, `route_customer_id`, `payment_date`, `amount`, `note`, `created_at`)
  - `customer_previous_bills` (`id`, `route_customer_id`, `bill_date`, `amount`, `note`, `created_at`) — opening / old dues before software
- Bills = **previous bills** + **delivered** `sales_orders` for that shop (`total_bill`); pending orders excluded
- Balance: `totalBilled − totalPaid = remaining` (previous bills included in Total Billed)
- Bill pay status (display): Unpaid / Partial / Paid — payments allocate FIFO to oldest bills (previous first on same date)
- UI: Route → Shop → **Add Previous Bill** (date/amount/note) + delivered order bills + payments CRUD + **Print PDF**
- APIs (auth required):
  - `GET /api/bills/shop?routeSlug=&customerId=` → shop, summary, bills[], payments[]
  - `POST|PUT|DELETE /api/bills/previous-bills` (and `/:id`) `{ routeSlug, customerId, date, amount, note? }`
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

## Auth / RBAC

- Table: `app_users` (`username`, `password_hash` bcrypt, `role` admin|manager, `active`)
- Admin seeded/synced on server boot from `AUTH_USERNAME` / `AUTH_PASSWORD` (env remains admin source of truth)
- Login: `POST /api/auth/login` → JWT `{ sub, username, role }` (`admin` | `manager`); legacy JWT `role: user` treated as admin
- `GET /api/auth/me` — current user
- Managers API (admin only): `GET|POST /api/managers`, `PUT /:id/password`, `PUT /:id/active`, `DELETE /:id`
- **Manager permissions:** may **POST create** only; **PUT/PATCH/DELETE** blocked (403); Orders `deliver` / `pending` blocked
- Middleware: `requireAuth` + `enforceRolePermissions` on all domain routers; `requireAdmin` on `/api/managers`
- UI: `usePermissions()` — `canEdit`/`canDelete` admin only; Edit/Delete/Deliver hidden for managers; Add remains; sidebar **Managers** admin-only; footer shows username · role
- Demo admin login: `asdf123` / `asdf123` (prod env); token key `qp_token`

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

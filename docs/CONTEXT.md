# CONTEXT — Qanooni Polymers System Truth

Last updated: 2026-07-26

## Purpose

Qanooni Polymers full-stack app: login + dashboard shell + raw materials.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + React Router + Axios |
| Backend | Node + Express |
| Database | Oracle MySQL 8.4 (`mysql2`) + MySQL Workbench |
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
- UI: `/raw-material` — **Add New / Edit / Delete**; sidebar from DB
- Swatch matches color name (`blue` → blue, `red` → red, also `#hex` / “dark blue”)

## Auth

- Login: `asdf123` / `asdf123` (dev)
- Token: `qp_token`

## Env

`MYSQL_DATABASE=Qanooni_db`

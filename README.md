# Qanooni Polymers

React + Node/Express + Oracle MySQL (Workbench).

## Structure

- `client/` — React (Vite)
- `server/` — Express API + MySQL
- `docs/CONTEXT.md` — system source of truth

## Login (dev env)

```
AUTH_USERNAME=asdf123
AUTH_PASSWORD=asdf123
```

## Run

MySQL Workbench: `127.0.0.1:3306` / `root` / empty password / schema `Qanooni_db`

```bash
cd server && npm run dev
cd client && npm run dev
```

## UI

Sidebar: Dashboard + Raw Material → RED / BLACK / YELLOW / BLUE / WHITE (empty pages)

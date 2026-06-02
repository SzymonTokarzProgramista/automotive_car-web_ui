# Automotive Car Web UI

React + TypeScript operator console for the autonomous vehicle backend.

## Run Locally

```powershell
npm install
npm run dev
```

The UI runs on `http://localhost:5173` and expects the backend at `http://localhost:8000`.

## Run With Docker

For the full system, prefer the central Compose repository:

```powershell
cd ..\automotive_car-machine_docker
docker compose up --build
```

Standalone UI-only run:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

## Configuration

- `VITE_API_URL` - backend API URL, default `http://localhost:8000`.

## Features

- User registration and login.
- JWT stored in `localStorage`.
- Authenticated map list and current route.
- Clickable 2D route planner for start and finish points.
- MJPEG camera panel using `/api/camera/stream?access_token=...`.

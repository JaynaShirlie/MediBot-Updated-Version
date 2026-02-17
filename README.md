
# MediBot

MediBot is a Vite + React app for patient and attender workflows. It includes patient registration, appointment scheduling with requests, a secure video call UI, and AI-assisted medical summaries and chat, backed by Supabase.

## Features

- Patient and attender onboarding, login, and dashboards
- Appointment scheduling and request flow with status filters
- Secure video call UI using browser media devices
- AI tools for medical record synthesis, insurance interpretation, and chat
- Client-side encryption utilities for sensitive strings

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Supabase (database)
- Google GenAI SDK

## Project Structure

- App.tsx: App shell and view routing
- components/: Schedule and video call UI
- views/: Landing, login, and dashboards
- services/: Supabase client, AI, and crypto helpers
- supabase_schema.sql, supabase_schema_appointments.sql: DB schema
- supabase_seed_data.sql: Sample seed data

<div style="page-break-after: always;"></div>

## Getting Started

1) Install dependencies

```bash
npm install
```

2) Configure environment variables

Create a .env.local file in the project root:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
API_KEY=your_google_genai_api_key
```

Note: The GenAI client currently reads API_KEY from process.env. In a Vite app, you may need to inject this at build time or move it to a secure backend to avoid exposing secrets in the browser.

3) Set up Supabase

- Create a Supabase project.
- Run the SQL from supabase_schema.sql and supabase_schema_appointments.sql in the Supabase SQL editor.
- Optionally run supabase_seed_data.sql to populate sample records.

4) Start the dev server

```bash
npm run dev
```

<div style="page-break-after: always;"></div>

## Build and Preview

```bash
npm run build
npm run preview
```

## Environment Notes

- The Supabase client falls back to hardcoded defaults if env vars are missing. For production, always set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
- AI features use Google GenAI. Consider proxying requests through a backend to protect API keys.

## Screens and Flows

- Landing: entry point for registration and login
- Register Attender: creates patient and attender records
- Attender Dashboard: patient overview and scheduling
- Patient Dashboard: medical records, appointments, and AI tools

<div style="page-break-after: always;"></div>

## Scripts

- dev: start Vite dev server
- build: production build
- preview: preview the production build

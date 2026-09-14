# RENIX

This is the main code for Renix web: an AI-powered construction and renovation
management platform. Homeowners plan scope, track budgets, ingest contractor
quotes and invoices, and manage financing with a Claude-powered companion.

- **Stack:** Express + React (Vite) + PostgreSQL (Drizzle ORM), Claude via the Anthropic SDK.
- **Getting started, commands, environment, architecture:** see [CLAUDE.md](CLAUDE.md).

## Quick start

```bash
cp .env.example .env     # set ANTHROPIC_API_KEY and SESSION_SECRET
npm install
npm run infra:up         # PostgreSQL + object-storage emulator (Docker)
npm run db:push
npm run dev              # http://localhost:4000
```

Production data exports (`scripts/seed-data.sql`, `scripts/storage-backup/`) are
intentionally not in this repository; `npm run db:seed-demo` creates demo data instead.

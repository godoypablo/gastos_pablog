# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal finance tracker (single-user) for monthly income and expense management. No authentication, no multi-user support by design.

## Repository

El código se versiona en GitHub: https://github.com/godoypablo/gastos_pablog.git

Los avances se van guardando en ese repositorio. Para sincronizar:

```bash
git remote add origin https://github.com/godoypablo/gastos_pablog.git
git push origin main
```

## Development Commands

```bash
# Initialize database (run once)
mysql -u root -p < scripts/schema.sql

# Start dev server
php -S localhost:8000

# Test DB connection
php scripts/test_conexion.php
```

**Database credentials:** configured in `config/database.php` — edit constants `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`.

## Architecture

**Single API endpoint** (`api/gastos_api.php`) handles all operations:
- `GET ?mes=N&anio=YYYY` — returns all active concepts with monthly amounts (LEFT JOIN ensures zero-balance concepts are included via COALESCE)
- `POST` body `{concepto_id, mes, anio, importe, observaciones?}` — upsert (manual SELECT→INSERT/UPDATE, not SQL UPSERT)
- `DELETE` body `{registro_id}` — removes a monthly entry

**Database** (`gastos_personales`):
- `conceptos` — master list of income/expense categories (`tipo`: `ingreso`|`gasto`), with soft-delete (`activo` flag)
- `registros_mensuales` — one row per concept per month/year; UNIQUE on `(concepto_id, mes, anio)`
- `vista_resumen_mensual` — view for server-side totals

**Frontend** (`assets/js/app.js`): single `app` object with state (`mesActual`, `anioActual`, `datos`, `guardandoCambios`). After every POST, the full dataset is reloaded (GET) to recalculate summary.

## Key Behaviors

- **Zero values with no existing record are NOT saved** — `guardarImporte()` skips if `importe === 0 && !registroId` (line ~215)
- **Concurrency lock**: `guardandoCambios` flag prevents overlapping saves
- **Input state machine**: neutral → unsaved (red) → saving (pulse) → saved (green, 2s)
- **Year selector** is dynamically generated: 5 years back, 2 years forward from current year
- CORS is open (`*`) — development-only assumption

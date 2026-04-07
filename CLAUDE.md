# CLAUDE.md — Cifra (finanzas personales, single-user, sin auth)

## Repo
github.com/godoypablo/gastos_pablog.git

## Setup
mysql -u root -p < scripts/schema.sql
mysql -u root -p gastos_personales < scripts/migration_permite_multiples.sql
mysql -u root -p gastos_personales < scripts/migration_categorias.sql
php scripts/generate_icons.php
php -S localhost:8000
DB config: config/database.php (DB_HOST, DB_NAME, DB_USER, DB_PASS)

## APIs
gastos_api.php     GET ?mes&anio | POST {concepto_id,mes,anio,importe,obs?,fecha?} | DELETE {registro_id}
conceptos_api.php  GET | POST {nombre,tipo,orden?,permite_multiples?,categoria_id?} | PUT {id,...} | DELETE {id}
categorias_api.php GET | POST {nombre,color,icono?,orden?} | PUT {id,...} | DELETE {id}

## DB (gastos_personales)
conceptos           tipo:ingreso|gasto, activo(soft-del), permite_multiples, categoria_id(FK nullable)
registros_mensuales monthly amounts, fecha col, sin UNIQUE (soporta múltiples)
categorias          nombre, color(hex), icono(BS class), orden, activo
vista_resumen_mensual view totals

## Frontend (assets/js/app.js)
Estado: mesActual, anioActual, datos, guardandoCambios, dtIngresos, dtGastos, categorias[]
DataTables: ordering:false; drawCallback inyecta <tr.categoria-header> leyendo data-categoria-*
Sugerencias (.btn-smvm): SMVM←dtos.gob.ar | Elena←hardcoded | Spotify←hardcoded | YouTube←USD×dolarapi.com

## PWA
manifest: theme #1F2A37, standalone
sw.js: cache-first local, network-only /api/, best-effort CDN
iOS: manual "Add to Home Screen"

## Comportamientos clave
- No guarda si importe===0 && !registroId
- guardandoCambios previene saves concurrentes
- Input: neutral→rojo(unsaved)→pulso(saving)→verde 2s(saved)
- Año: -5/+2 desde año actual
- Dark mode: localStorage('cifra-theme'), aplicado en <head>
- Mobile: font 0.875rem en inputs; flex-direction:column-reverse en col importe
- CORS: abierto (*)

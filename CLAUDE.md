# Cifra — finanzas personales, single-user

## Stack
PHP+MySQL | Bootstrap5 | DataTables | PWA | php -S localhost:8000
DB: gastos_personales — config/database.php

## DB
conceptos: tipo ingreso|gasto, activo(soft-del), permite_multiples, categoria_id(FK nullable)
registros_mensuales: importe, mes, anio, fecha, pagado, fecha_vencimiento, cuenta_id(FK nullable) — sin UNIQUE
categorias: nombre, color(hex), icono(BS class), orden, activo
cuentas: nombre, banco, tipo(cuenta_corriente|caja_ahorro|billetera), color(hex), saldo_actual, fecha_saldo, activo

## APIs (api/)
gastos_api.php     GET ?mes&anio | POST | PATCH {registro_id,pagado|fecha_vencimiento|cuenta_id} | DELETE
conceptos_api.php  GET | POST | PUT | DELETE
categorias_api.php GET | POST | PUT | DELETE
cuentas_api.php    GET ?mes&anio (devuelve cuentas + total_pagado_mes) | PUT {id,saldo_actual}

## Resumen (tarjeta Saldo)
total_ingresos, total_gastos, gastos_pagados, saldo_disponible(=ingresos-pagados), saldo(=ingresos-total)
Frontend calcula: pendiente=total_gastos-gastos_pagados, pctPagado para barra progreso

## Frontend
Estado: mesActual, anioActual, datos, guardandoCambios, dtIngresos, dtGastos, categorias[], cuentas[]
DataTables: ordering:false; drawCallback inyecta <tr.categoria-header>
Sugerencias: SMVM←dtos.gob.ar | Elena←hardcoded | Spotify←hardcoded | YouTube←USD×dolarapi.com
Input: neutral→rojo→pulso→verde 2s | guardandoCambios previene saves concurrentes
Dark mode: localStorage('cifra-theme') | sw.js: cache-first local, network-only /api/
Fechas: formatearFechaCorta() → dd/mm/yy (única función, formatearFecha eliminada)

## Vencimiento (permite_multiples=0 únicamente)
- Grilla principal: .vencimiento-wrap con span.vencimiento-texto (dd/mm/yy) + input[date] oculto
- Click en span/ícono → showPicker() con fallback focus()
- Mobile: flex-wrap en .concepto-nombre → vencimiento-wrap en nueva línea (flex-basis:100%)
- permite_multiples=1: sin vencimiento en ninguna vista

## Detalle múltiple (permite_multiples=1)
- POST siempre con pagado=1 (regla en API, no en frontend)
- Sin fecha_vencimiento en ninguna parte del detalle
- Columnas: [pagado+fecha dd/mm/yy + cuenta-wrap-detalle | descripción | importe | trash]
- Formulario nueva entrada: [fecha | descripción | importe | +]
- Labels .form-field-label sobre cada input (0.58rem uppercase)
- Badge contador (.badge-count) en col nombre, a la izquierda de la flecha

## Categorías
- Header: chevron + dot + ícono + label + total — todos con color inline de la categoría
- .categoria-header-label: 0.72rem | .categoria-header-total: 0.8rem — mismo color que label

## Tarjeta Saldo
Disponible | Pendiente (muted) | barra progreso 4px | Proyección (text-success/danger)
cardSaldo.negativo → border-color danger, ícono bi-exclamation-triangle-fill text-danger

## Strip Vencimientos (#bannerVencimientos)
- Aparece entre resumen y tabla ingresos, solo si hay vencidos/próximos 7 días sin pagar
- Colapsable: header siempre visible (ícono + tags + total + chevron), body toggle
- Grid 3 col: nombre(1fr) | fecha(5.5rem, centrado) | importe(6.5rem, derecha)
- Tags: .venc-tag-vencido (rojo) | .venc-tag-proximo (ámbar)
- parseFloat(c.importe) para evitar NaN con strings de PHP

## Diseño / Paleta
- Cards resumen: .card-resumen (borde neutro, sin colores semánticos en bordes)
- Headers sección: .seccion-header (fondo transparente, solo ícono con color)
- btn-smvm: clase única .btn-smvm (neutro, borde gris, sin variantes de color)
- Colores semánticos reservados para: números de saldo, proyección, íconos de sección
- NO usar: border-success/danger/primary en cards, bg-success/danger en headers

## Cuentas Bancarias — IMPLEMENTADO, PENDIENTE MIGRACIÓN DB

### Estado al 2026-04-09
Todo el código está escrito y commiteado. Falta ejecutar la migración SQL en la DB.

### Comando para ejecutar la migración (HACER PRIMERO AL LLEGAR A CASA)
```bash
mysql -u root gastos_personales < scripts/migration_cuentas.sql
# Si tiene contraseña:
mysql -u root -p gastos_personales < scripts/migration_cuentas.sql
```

### Cuentas configuradas (ya en el SQL)
- Entre Ríos | Banco de Entre Ríos | cuenta_corriente | #1a6eb5
- Santander | Banco Santander | caja_ahorro | #ec0000
- Personal Pay | Personal Pay | billetera | #7b2d8b

### Arquitectura
- DB: tabla `cuentas` (id, nombre, banco, tipo, color, saldo_actual, fecha_saldo, activo)
- DB: columna `cuenta_id` (FK nullable, ON DELETE SET NULL) en `registros_mensuales`
- API: `api/cuentas_api.php` — GET ?mes&anio | PUT {id, saldo_actual}
- API: `gastos_api.php` GET incluye `cuenta_id` en conceptos y detalle; PATCH acepta `cuenta_id`

### Frontend
- app.cuentas[] se carga en paralelo con los gastos en cargarDatos()
- crearSelectorCuenta(registroId, cuentaId) → div.cuenta-wrap con dot coloreado + select
- Solo aparece en filas con registro_id (importe ya guardado)
- En fila simple: cuenta-wrap después de vencimiento-wrap dentro de .concepto-nombre
- En detalle múltiple: cuenta-wrap-detalle appended al td:first-child (bajo fecha)
- Mobile: .concepto-nombre .cuenta-wrap con flex-basis:100% → nueva línea
- guardarCuentaRegistro(registroId, cuentaId) → PATCH → cargarCuentas() (sin full reload)
- renderizarCuentas() → tarjeta #cardCuentas entre #bannerVencimientos y tabla ingresos
- actualizarSaldoCuenta(id) → prompt → PUT → cargarCuentas()

### Tarjeta Cuentas (#cardCuentas)
- Posición: entre #bannerVencimientos y tabla Ingresos (ya en index.php)
- Por cuenta: dot-lg + nombre + tipo | saldo real | asignado mes | diferencia +/-
- Consolidado al pie: total real en cuentas | disponible (sistema) | diferencia
- Lápiz por cuenta abre prompt para ingresar nuevo saldo manualmente
- Diferencia cuenta = saldo_actual - total_pagado_mes (pagados asignados a esa cuenta ese mes)
- Diferencia consolidado = total real - saldo_disponible del sistema

### CSS clases nuevas
.cuenta-wrap | .cuenta-wrap-detalle | .cuenta-dot | .cuenta-select
.cuenta-dot-lg | .cuenta-nombre | .cuenta-tipo | .cuenta-stats | .cuenta-stat
.cuenta-stat-label | .cuenta-stat-valor | .cuenta-stat-fecha
.cuenta-consolidado | .cuenta-consolidado-row | .cuenta-consolidado-label
.cuenta-consolidado-valor | .cuenta-consolidado-diff

## PWA / Futuro
- sw.js: cache-first local, network-only /api/ — ya implementado
- Para install prompt nativo: requiere HTTPS (Let's Encrypt en hosting)
- Play Store: TWA via PWABuilder (USD 25 cuenta Google Play) — requiere HTTPS
- App Store: Capacitor.js (USD 99/año Apple) — más complejo
- Monetización futura requiere: multi-tenant, suscripciones, pasarela de pago
- IA descartada (privacidad datos financieros + costo API free tier = Google entrena con tus datos)

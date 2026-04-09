# Cifra — finanzas personales, single-user

## Stack
PHP+MySQL | Bootstrap5 | DataTables | PWA | php -S localhost:8000
DB: gastos_personales — config/database.php

## DB
conceptos: tipo ingreso|gasto, activo(soft-del), permite_multiples, categoria_id(FK nullable)
registros_mensuales: importe, mes, anio, fecha, pagado, fecha_vencimiento — sin UNIQUE
categorias: nombre, color(hex), icono(BS class), orden, activo

## APIs (api/)
gastos_api.php     GET ?mes&anio | POST | PATCH {registro_id,pagado|fecha_vencimiento} | DELETE
conceptos_api.php  GET | POST | PUT | DELETE
categorias_api.php GET | POST | PUT | DELETE

## Resumen (tarjeta Saldo)
total_ingresos, total_gastos, gastos_pagados, saldo_disponible(=ingresos-pagados), saldo(=ingresos-total)
Frontend calcula: pendiente=total_gastos-gastos_pagados, pctPagado para barra progreso

## Frontend
Estado: mesActual, anioActual, datos, guardandoCambios, dtIngresos, dtGastos, categorias[]
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
- Columnas: [pagado+fecha dd/mm/yy | descripción | importe | trash]
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

## PWA / Futuro
- sw.js: cache-first local, network-only /api/ — ya implementado
- Para install prompt nativo: requiere HTTPS (Let's Encrypt en hosting)
- Play Store: TWA via PWABuilder (USD 25 cuenta Google Play) — requiere HTTPS
- App Store: Capacitor.js (USD 99/año Apple) — más complejo
- Monetización futura requiere: multi-tenant, suscripciones, pasarela de pago
- IA descartada (privacidad datos financieros + costo API free tier = Google entrena con tus datos)

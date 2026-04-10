# Cifra — finanzas personales, single-user

## Stack
PHP+MySQL | Bootstrap5 | DataTables | PWA | `php -S localhost:8000`
DB: gastos_personales — config/database.php

## DB
```
conceptos:          tipo(ingreso|gasto), activo, permite_multiples, categoria_id(FK?)
registros_mensuales: importe, mes, anio, fecha, pagado, fecha_vencimiento, cuenta_id(FK?) — sin UNIQUE
categorias:         nombre, color(hex), icono(BS), orden, activo
cuentas:            nombre, banco, tipo(cuenta_corriente|caja_ahorro|billetera), color(hex), saldo_actual, fecha_saldo, activo
movimientos_cuenta: tipo(ingreso|pago_gasto|transferencia|extraccion), cuenta_id, importe, fecha, descripcion, registro_id?
```

## APIs (api/)
```
gastos_api.php      GET ?mes&anio | POST | PATCH {registro_id, pagado|fecha|fecha_vencimiento|cuenta_id} | DELETE
conceptos_api.php   GET | POST | PUT {cuenta_id_default} | DELETE
categorias_api.php  GET | POST | PUT | DELETE
cuentas_api.php     GET ?mes&anio → cuentas+total_pagado_mes | PUT {id,saldo_actual}
movimientos_api.php GET | POST transferencia | POST extraccion
```

## Resumen
`saldo_disponible = ingresos - gastos_pagados` | `saldo = ingresos - total_gastos`
Frontend: `pendiente = total_gastos - gastos_pagados` | pctPagado → barra progreso 4px
cardSaldo.negativo → border danger + bi-exclamation-triangle-fill

## Frontend (app.js)
- Estado: `app.{mesActual, anioActual, datos, guardandoCambios, dtGastos, categorias[], cuentas[]}`
- DataTables: ordering:false; drawCallback inyecta `<tr.categoria-header>`
- Input: neutral→rojo→pulso→verde 2s | `guardandoCambios` previene saves concurrentes
- Dark mode: localStorage('cifra-theme') | Fechas: `formatearFechaCorta()` → dd/mm/yy
- Sugerencias: SMVM←dtos.gob.ar | Elena/Spotify←hardcoded | YouTube←USD×dolarapi.com

## Layout
Pantalla: filtro mes/año (colapsable, default contraído) → tabla Gastos
Filtro: Bootstrap collapse nativo (`data-bs-toggle`) | label inicial desde PHP | localStorage('cifra-filtro-abierto')
Hamburguesa: Resumen | Cuentas | — | Ingresos | Vencimientos | — | Movimientos | — | Conceptos
Resumen/Cuentas → modales; Vencimientos → modal + badges; Ingresos → modal unificado
FAB: botón fijo bottom-right (style inline, z-index:1039) → #modalGastoRapido (permite_multiples=1)

## Vencimiento (permite_multiples=0)
Grilla: `.vencimiento-wrap` → span dd/mm/yy + input[date] oculto; click → showPicker()
Mobile: flex-basis:100% en .concepto-nombre → nueva línea
`permite_multiples=1`: sin vencimiento en ninguna vista

## Detalle múltiple (permite_multiples=1)
POST siempre con pagado=1 | sin fecha_vencimiento
Cols: [pagado+fecha + .cuenta-wrap-detalle | descripción | importe | trash]
Form: [fecha | descripción | importe | +] | Labels .form-field-label (0.58rem uppercase)
Badge contador (.badge-count) a la izquierda de la flecha

## Categorías
Header: chevron + dot + ícono + label + total (todo con color inline)
.categoria-header-label: 0.72rem | .categoria-header-total: 0.8rem

## Cuentas
`renderizarCuentas()` → #cardCuentas (modal-body de #modalCuentas), sin wrapper .card
Por cuenta: dot-lg + nombre + tipo | saldo real | asignado mes | diferencia
`crearSelectorCuenta()` → .cuenta-wrap (fila simple) / .cuenta-wrap-detalle (múltiple)
Toggle pagado/cobrado → crea/elimina movimiento + ajusta saldo_actual
Validación saldo: al marcar pagado Y al reasignar cuenta en gasto ya pagado (HTTP 422)
Transferencia: #modalTransferencia | Extracción: solo no-billetera

## Diseño
.card-resumen: borde neutro | .seccion-header: fondo transparente, ícono con color
NO usar border-success/danger/primary en cards ni bg-success/danger en headers

## PWA
SW: HTML nunca cacheado (network-first) | assets estáticos cache-first (cifra-v6)
Bump CACHE_NAME en sw.js para invalidar caché de assets en dispositivos
Play Store: TWA via PWABuilder (USD 25, HTTPS) | App Store: Capacitor.js (USD 99/año)
Monetización: multi-tenant + suscripciones | IA descartada (privacidad)

# Cifra — finanzas personales, single-user

## Stack
PHP+MySQL | Bootstrap5 | DataTables | PWA | `php -S localhost:8000`
DB: gastos_personales — config/database.php

## DB
```
conceptos:           tipo(ingreso|gasto), activo, permite_multiples, categoria_id, cuenta_id_default
registros_mensuales: concepto_id, importe, mes, anio, fecha, pagado, fecha_vencimiento, cuenta_id — sin UNIQUE
categorias:          nombre, color(hex), icono(BS), orden, activo
cuentas:             nombre, banco, tipo(cuenta_corriente|caja_ahorro|billetera), color(hex), saldo_actual, fecha_saldo, activo
movimientos_cuenta:  tipo(ingreso|pago_gasto|transferencia|extraccion), cuenta_origen_id, cuenta_destino_id, importe, fecha, descripcion, registro_id?
```

## Cuentas del usuario
1=Entre Ríos (cuenta_corriente) | 2=Santander (caja_ahorro) | 3=Personal Pay (billetera) | 4=Efectivo (billetera, #22c55e)

## APIs (api/)
```
gastos_api.php      GET ?mes&anio | POST | PATCH {registro_id, pagado|fecha|fecha_vencimiento|cuenta_id} | DELETE {registro_id}
conceptos_api.php   GET | POST | PUT {cuenta_id_default} | DELETE
categorias_api.php  GET | POST | PUT | DELETE
cuentas_api.php     GET ?mes&anio → cuentas+total_pagado_mes | POST | PUT {id,saldo_actual}
movimientos_api.php GET | POST transferencia | POST extraccion
```

## Circuito saldo (gastos_api.php) — COMPLETO Y VERIFICADO
- POST permite_multiples=1 (pagado=1): INSERT registro + movimiento `pago_gasto` + saldo_actual−importe — en transacción
- POST permite_multiples=0 (nuevo): INSERT con pagado=0, aplica cuenta_id_default — sin movimiento
- PATCH pagado=1: valida saldo 422 → INSERT movimiento + saldo−importe
- PATCH pagado=0: elimina movimiento + saldo+importe
- PATCH cuenta_id (ya pagado): valida saldo nueva cuenta → ajusta ambas cuentas + migra movimiento
- DELETE: busca movimiento por registro_id → restaura saldo + DELETE movimiento + DELETE registro — en transacción
- Gastos sin cuenta_id: no generan movimiento ni tocan saldo
- Ingresos cobrados: tipo `ingreso`, cuenta_destino_id, saldo+importe; al revertir saldo−importe

## Frontend (app.js)
- Estado: `app.{mesActual, anioActual, datos, guardandoCambios, dtGastos, categorias[], cuentas[]}`
- DataTables: ordering:false; drawCallback inyecta `<tr.categoria-header>`
- Input: neutral→rojo→pulso→verde 2s | `guardandoCambios` previene saves concurrentes
- Dark mode: localStorage('cifra-theme') | Fechas: `formatearFechaCorta()` → dd/mm/yy
- Sugerencias: SMVM←dtos.gob.ar | Elena/Spotify←hardcoded | YouTube←USD×dolarapi.com
- `guardarCuentaRegistro()`: tras PATCH actualiza `app.datos` en memoria (evita re-render que revierte selección)

## Layout — pantalla principal
- Filtro mes/año: Bootstrap collapse, default contraído, localStorage('cifra-filtro-abierto')
- Header filtro mes/año: muestra `#saldoFiltroHeader` (saldo = ingresos−total_gastos) en verde/rojo — visible con el filtro cerrado
- Card "Total en cuentas": `#cardCuentasHome` — colapsable, lista por cuenta sin botones — `renderizarCardCuentasHome()`
- Card Gastos: header colapsable → muestra Pagados (`#gastosPagadosHeader`) + Por pagar (`#gastosPorPagarHeader`); total en `#totalGastosHeader`
- FAB `.fab` bottom-right z-index:1039 → #modalGastoRapido (permite_multiples=1) — estilos en `<style>` de index.php, NO inline

## Hamburguesa
Resumen | Cuentas | — | Ingresos | Vencimientos | — | Movimientos | — | Conceptos
Resumen/Cuentas → modales | Vencimientos → modal+badges | Ingresos → modal unificado

## Modales — reglas generales
- Todos: `modal-dialog-scrollable` (header/footer fijos, body scrolleable)
- NO usar border-success/danger/primary en cards ni bg-success/danger en headers
- Fuentes responsivas: `clamp()` en valores monetarios grandes

## Resumen modal
- Ingresos: clicable → collapse `#resumenIngresosDetalle` con items individuales — `renderizarResumenIngresos()`
- Solo muestra: Disponible (ingresos−gastos_pagados) — SIN Pendiente ni Proyección
- Barras por categoría: `renderizarResumenCategorias()` | Lista pendientes: `renderizarResumenPendientes()`
- Tooltips ⓘ en todos los valores numéricos (Bootstrap, trigger hover+focus)
- `saldo_disponible = ingresos − gastos_pagados` | barra progreso 4px (pctPagado)

## Cuentas modal
- `renderizarCuentas()` → #cardCuentas (sin wrapper .card)
- Por cuenta: dot-lg + nombre + tipo | solo saldo real (sin asignado/diferencia)
- `crearSelectorCuenta()` → .cuenta-wrap (fila simple) / .cuenta-wrap-detalle (múltiple)
- Validación saldo HTTP 422 al marcar pagado Y al reasignar cuenta en gasto ya pagado
- Alta: "Nueva cuenta" en footer → form inline `.nueva-cuenta-form`
- Transferencia: #modalTransferencia | Extracción: solo no-billetera
- `total_pagado_mes`: JOIN conceptos filtrando `tipo='gasto'` (si no, suma ingresos — bug histórico)

## Ingresos modal
- Layout dos líneas por ítem:
  - Línea 1 `.ingreso-linea1`: nombre + btn-edit-ingreso + importe (input)
  - Línea 2 `.ingreso-linea2`: select cuenta (flex:1) + input fecha (7.5rem fijo)
- Wrapper `.ingreso-body` (flex-direction:column) al lado de `.btn-pagado`
- `renderizarModalIngresos()` en app.js

## Vencimientos (permite_multiples=0)
- `.vencimiento-wrap` → span dd/mm/yy + input[date] oculto; click → showPicker()
- Mobile: flex-basis:100% en .concepto-nombre → nueva línea

## Detalle múltiple (permite_multiples=1)
- POST siempre pagado=1, sin fecha_vencimiento
- Cols: [pagado+fecha + .cuenta-wrap-detalle | descripción | importe | trash]
- Form: [fecha | descripción | importe | +] | Labels `.form-field-label` (0.58rem uppercase)
- Badge contador `.badge-count` a la izquierda de la flecha

## Categorías
- Header: chevron + dot + ícono + label + total (color inline)
- `.categoria-header-label`: 0.72rem | `.categoria-header-total`: 0.8rem
- Edit: todo en `.cat-nombre-edit` con `d-flex flex-wrap` (nombre+orden+botones), colspan="2" — evita overflow mobile

## Movimientos modal
- Layout flex por fila: fecha(dd/mm/yy)+hora(hh:mm) | tipo+cuenta | descripción+importe
- Sin tabla, diseño responsive puro flex

## Login (login.php)
- Logo Montserrat + barra degradé índigo→verde + card shadow
- Toggle ojo para contraseña: `#btnTogglePass` → alterna type password/text + icono bi-eye/bi-eye-slash
- Foco inputs en índigo | btn-ingresar con gradiente + microanimación hover

## PWA / Deploy
- SW: HTML network-first, assets cache-first | CACHE_NAME actual: `cifra-v13`
- **Bump CACHE_NAME en sw.js cada vez que cambie CSS o JS** — fuerza re-descarga en todos los dispositivos
- Deploy FTP: index.php siempre | app.js si JS cambió | styles.css si CSS cambió | sw.js si hay bump
- Play Store: TWA via PWABuilder (USD 25, HTTPS) | App Store: Capacitor.js (USD 99/año)
- Monetización: multi-tenant + suscripciones | IA descartada (privacidad)
- Android: para limpiar caché de SW → Chrome → ⋮ → Configuración del sitio → Almacenamiento → Borrar

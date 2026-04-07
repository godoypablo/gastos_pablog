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

## Frontend
Estado: mesActual, anioActual, datos, guardandoCambios, dtIngresos, dtGastos, categorias[]
DataTables: ordering:false; drawCallback inyecta <tr.categoria-header>
Sugerencias: SMVM←dtos.gob.ar | Elena←hardcoded | Spotify←hardcoded | YouTube←USD×dolarapi.com
Input: neutral→rojo→pulso→verde 2s | guardandoCambios previene saves concurrentes
Dark mode: localStorage('cifra-theme') | sw.js: cache-first local, network-only /api/
Mobile: vencimiento oculto en grilla principal (no desplaza col importe)

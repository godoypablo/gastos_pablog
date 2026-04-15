<?php
require_once 'config/auth_check.php';
require_auth_or_redirect();
define('APP_VERSION', '20260415-2');
$meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
$labelFiltro = $meses[(int)date('n') - 1] . ' ' . date('Y');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cifra — Control Financiero Personal</title>
    <!-- Aplicar tema guardado antes de renderizar (evita flash) -->
    <script>
        const t = localStorage.getItem('cifra-theme');
        if (t) document.documentElement.setAttribute('data-bs-theme', t);
    </script>

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="assets/icons/icon.svg">
    <link rel="icon" type="image/png" sizes="192x192" href="assets/icons/icon-192.png">

    <!-- PWA: Manifest + tema -->
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#1e1b4b">

    <!-- PWA iOS (Safari no usa el manifest para esto) -->
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Cifra">
    <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">

    <!-- Google Fonts: Inter + Montserrat -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Montserrat:wght@600;700&display=swap" rel="stylesheet">

    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.2/font/bootstrap-icons.css">

    <!-- DataTables Bootstrap 5 CSS -->
    <link rel="stylesheet" href="https://cdn.datatables.net/2.0.8/css/dataTables.bootstrap5.min.css">

    <!-- Custom CSS -->
    <link rel="stylesheet" href="assets/css/styles.css">
    <style>
        .fab{position:fixed;bottom:1.5rem;right:1.5rem;width:3.5rem;height:3.5rem;border-radius:50%;background:#DC2626;color:#fff;border:none;font-size:1.5rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);z-index:1039;cursor:pointer;transition:transform .15s,box-shadow .15s}
        .fab:hover,.fab:focus{transform:scale(1.08);color:#fff;outline:none}
        .fab:active{transform:scale(.96)}
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header bg-primary text-white shadow-sm">
        <div class="container py-2 d-flex justify-content-between align-items-center">
            <h1 class="h5 mb-0 cifra-logo">
                <i class="bi bi-bar-chart-fill me-2"></i>
                Cifra
            </h1>
            <div class="d-flex gap-2 align-items-center">
                <button class="btn btn-outline-light btn-sm" onclick="toggleDarkMode()" id="btnDarkMode" title="Cambiar tema">
                    <i class="bi bi-moon-fill" id="iconDarkMode"></i>
                </button>
                <div class="dropdown">
                    <button class="btn btn-outline-light btn-sm position-relative" id="btnMenu" data-bs-toggle="dropdown" aria-expanded="false" title="Menú">
                        <i class="bi bi-list fs-5"></i>
                        <span class="badge bg-danger position-absolute top-0 start-100 translate-middle rounded-pill d-none" id="badgeMenuVenc" style="font-size:0.6rem;padding:2px 5px"></span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow" aria-labelledby="btnMenu">
                        <li>
                            <a class="dropdown-item d-flex align-items-center gap-2" href="#" onclick="abrirModalResumen();return false;">
                                <i class="bi bi-graph-up-arrow menu-icon"></i>
                                Resumen
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item d-flex align-items-center gap-2" href="#" onclick="abrirModalCuentas();return false;">
                                <i class="bi bi-bank menu-icon"></i>
                                Cuentas
                            </a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a class="dropdown-item d-flex align-items-center gap-2" href="#" onclick="abrirModalIngresos();return false;">
                                <i class="bi bi-graph-up menu-icon"></i>
                                Ingresos
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item d-flex align-items-center gap-2" href="#" onclick="abrirModalVencimientos();return false;">
                                <i class="bi bi-clock-history menu-icon"></i>
                                Vencimientos
                                <span class="badge bg-danger ms-auto d-none" id="badgeVencMenu"></span>
                            </a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a class="dropdown-item d-flex align-items-center gap-2" href="#" onclick="abrirModalMovimientos();return false;">
                                <i class="bi bi-journal-text menu-icon"></i>
                                Movimientos
                            </a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a class="dropdown-item d-flex align-items-center gap-2" href="#" onclick="abrirModalConceptos();return false;">
                                <i class="bi bi-list-ul menu-icon"></i>
                                Conceptos
                            </a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <span class="dropdown-item-text text-muted" style="font-size:0.7rem;opacity:.6;user-select:all">
                                v<?= APP_VERSION ?>
                            </span>
                        </li>
                    </ul>
                </div>
                <a href="logout.php" class="btn btn-outline-light btn-sm" title="Cerrar sesión">
                    <i class="bi bi-box-arrow-right"></i>
                </a>
            </div>
        </div>
    </header>

    <!-- Topbar sticky: filtro + stats rápidos -->
    <div class="cifra-topbar sticky-top">
        <div class="container">
            <div class="topbar-inner">
                <button class="topbar-chip" data-bs-toggle="collapse" data-bs-target="#contenidoFiltroMes" aria-expanded="false">
                    <i class="bi bi-calendar3"></i>
                    <span id="filtroMesLabel"><?php echo $labelFiltro; ?></span>
                    <i class="bi bi-chevron-down" id="iconFiltroMes"></i>
                </button>
                <div class="topbar-stats">
                    <div class="topbar-stat" onclick="abrirModalResumen()" title="Saldo ARS en cuentas menos gastos ARS pendientes del mes">
                        <span class="topbar-stat-label">Disponible</span>
                        <span class="topbar-stat-valor" id="saldoFiltroHeader">—</span>
                    </div>
                    <button class="topbar-more-btn" id="btnStatsMore" onclick="toggleStatsExtra()" title="Ver más">
                        <i class="bi bi-chevron-left" id="iconStatsMore"></i>
                    </button>
                    <div class="topbar-stats-extra" id="statsExtra">
                        <div class="topbar-stat d-none" id="statUSD" onclick="abrirModalCuentas()" title="Saldo USD en cuentas menos gastos USD pendientes">
                            <span class="topbar-stat-label">USD disp.</span>
                            <span class="topbar-stat-valor" id="saldoUSDHeader">—</span>
                        </div>
                        <div class="topbar-stat" onclick="abrirModalCuentas()" title="Total real en cuentas ARS">
                            <span class="topbar-stat-label">Cuentas</span>
                            <span class="topbar-stat-valor" id="totalCuentasTopbar">—</span>
                        </div>
                    </div>
                </div>
            </div>
            <div id="contenidoFiltroMes" class="collapse">
                <div class="topbar-filtro-body">
                    <div class="row g-3 align-items-end">
                        <div class="col">
                            <label for="selectMes" class="form-label">
                                <i class="bi bi-calendar-month me-1"></i>Mes
                            </label>
                            <select id="selectMes" class="form-select">
                                <option value="1">Enero</option>
                                <option value="2">Febrero</option>
                                <option value="3">Marzo</option>
                                <option value="4">Abril</option>
                                <option value="5">Mayo</option>
                                <option value="6">Junio</option>
                                <option value="7">Julio</option>
                                <option value="8">Agosto</option>
                                <option value="9">Septiembre</option>
                                <option value="10">Octubre</option>
                                <option value="11">Noviembre</option>
                                <option value="12">Diciembre</option>
                            </select>
                        </div>
                        <div class="col">
                            <label for="selectAnio" class="form-label">
                                <i class="bi bi-calendar-event me-1"></i>Año
                            </label>
                            <select id="selectAnio" class="form-select"></select>
                        </div>
                        <div class="col-auto">
                            <button id="btnCargar" class="btn btn-outline-secondary" title="Recargar">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <main class="container my-3">
        <!-- Alertas -->
        <div id="alertContainer"></div>

        <!-- Loading -->
        <div id="loading" class="text-center py-5 d-none">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="text-muted">Cargando datos...</p>
        </div>

        <!-- Contenido Principal -->
        <div id="contenidoPrincipal">

            <!-- Tabla de Gastos -->
            <div class="card shadow-sm mb-4">
                <div class="card-header seccion-header d-flex justify-content-between align-items-center"
                     data-bs-toggle="collapse" data-bs-target="#gastosHeaderDetalle"
                     style="cursor:pointer;user-select:none">
                    <h3 class="h6 mb-0 fw-bold seccion-titulo">
                        <i class="bi bi-graph-down me-2"></i>Gastos
                    </h3>
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-semibold" id="totalGastosHeader" style="font-size:0.85rem"></span>
                        <i class="bi bi-chevron-down" style="font-size:.75rem;opacity:.5;color:var(--bs-body-color)"></i>
                    </div>
                </div>
                <div class="collapse" id="gastosHeaderDetalle">
                    <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style="font-size:.82rem">
                        <span class="text-muted">Pagados</span>
                        <span class="fw-medium" id="gastosPagadosHeader"></span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style="font-size:.82rem">
                        <span class="text-muted">Por pagar</span>
                        <span class="fw-medium" id="gastosPorPagarHeader"></span>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0" id="dtGastos">
                            <thead>
                                <tr>
                                    <th>Concepto</th>
                                    <th class="text-end">Importe</th>
                                </tr>
                            </thead>
                            <tbody id="tablaGastos"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Modal Resumen -->
    <div class="modal fade" id="modalResumen" tabindex="-1" aria-labelledby="modalResumenLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalResumenLabel">
                        <i class="bi bi-graph-up-arrow me-2 text-info"></i>Resumen — <span id="mesAnioActual"></span>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                    <!-- Ingresos vs Gastos -->
                    <div class="resumen-top-row">
                        <div class="resumen-stat resumen-stat-ingreso"
                             style="cursor:pointer"
                             data-bs-toggle="collapse"
                             data-bs-target="#resumenIngresosDetalle">
                            <div class="resumen-stat-label">
                                <i class="bi bi-arrow-up-circle-fill"></i> Ingresos
                                <i class="bi bi-chevron-down" style="font-size:.6rem;opacity:.5"></i>
                                <i class="bi bi-info-circle resumen-info"
                                   data-bs-toggle="tooltip" data-bs-placement="bottom"
                                   data-bs-title="Total de ingresos registrados en el mes"></i>
                            </div>
                            <div class="resumen-stat-valor" id="totalIngresos">$0,00</div>
                        </div>
                        <div class="resumen-stat resumen-stat-gasto">
                            <div class="resumen-stat-label">
                                <i class="bi bi-arrow-down-circle-fill"></i> Gastos
                                <i class="bi bi-info-circle resumen-info"
                                   data-bs-toggle="tooltip" data-bs-placement="bottom"
                                   data-bs-title="Total de gastos registrados en el mes"></i>
                            </div>
                            <div class="resumen-stat-valor" id="totalGastos">$0,00</div>
                        </div>
                    </div>
                    <!-- Detalle ingresos (collapse) -->
                    <div class="collapse border-top" id="resumenIngresosDetalle"></div>
                    <!-- Barra de progreso -->
                    <div class="resumen-progress-section">
                        <div class="progress resumen-progress">
                            <div class="progress-bar" id="barraProgreso" role="progressbar" style="width:0%"></div>
                        </div>
                        <div class="resumen-progress-label">gastos pagados</div>
                    </div>
                    <!-- Saldo -->
                    <div class="resumen-bottom-row" id="cardSaldo">
                        <div class="resumen-saldo-item">
                            <span class="resumen-saldo-label">
                                <i class="bi bi-bar-chart-steps" id="iconSaldo"></i> Balance del mes
                                <i class="bi bi-info-circle resumen-info"
                                   data-bs-toggle="tooltip" data-bs-placement="top"
                                   data-bs-title="Ingresos del mes menos los gastos ya pagados. No refleja el saldo real en cuentas."></i>
                            </span>
                            <span class="resumen-saldo-valor" id="saldoDisponible">$0,00</span>
                        </div>
                    </div>
                    <!-- Gastos por categoría -->
                    <div id="resumenCategorias"></div>
                    <!-- Pendientes de pago -->
                    <div id="resumenPendientes"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Cuentas -->
    <div class="modal fade" id="modalCuentas" tabindex="-1" aria-labelledby="modalCuentasLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalCuentasLabel">
                        <i class="bi bi-bank me-2 text-primary"></i>Cuentas
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0" id="cardCuentas">
                    <!-- renderizado por renderizarCuentas() -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="mostrarFormNuevaCuenta()">
                        <i class="bi bi-plus-lg me-1"></i>Nueva cuenta
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Transferencia -->
    <div class="modal fade" id="modalTransferencia" tabindex="-1" aria-labelledby="modalTransferenciaLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalTransferenciaLabel">
                        <i class="bi bi-arrow-left-right me-2"></i>Transferencia entre cuentas
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label form-field-label">Desde</label>
                        <select class="form-select" id="transfOrigen"></select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label form-field-label">Hacia</label>
                        <select class="form-select" id="transfDestino"></select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label form-field-label">Importe</label>
                        <input type="text" inputmode="decimal" class="form-control" id="transfImporte" placeholder="$ 0,00">
                    </div>
                    <div class="mb-3">
                        <label class="form-label form-field-label">Descripción <span class="text-muted fw-normal">(opcional)</span></label>
                        <input type="text" class="form-control" id="transfDescripcion" placeholder="Ej: Pago tarjeta Santander">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="realizarTransferencia()">
                        <i class="bi bi-arrow-left-right me-1"></i>Transferir
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Movimientos -->
    <div class="modal fade" id="modalMovimientos" tabindex="-1" aria-labelledby="modalMovimientosLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalMovimientosLabel">
                        <i class="bi bi-journal-text me-2"></i>Movimientos de cuentas
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0" id="modalMovimientosBody">
                    <div class="text-center py-4">
                        <div class="spinner-border text-primary"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Ingresos (unificado) -->
    <div class="modal fade" id="modalIngresos" tabindex="-1" aria-labelledby="modalIngresosLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalIngresosLabel">
                        <i class="bi bi-graph-up text-success me-2"></i>Ingresos — <span id="mesAnioIngresos"></span>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>

                <!-- Formulario nuevo ingreso (oculto por defecto) -->
                <div id="formNuevoIngreso" class="d-none border-bottom px-3 pt-3 pb-2">
                    <div class="row g-2 align-items-end">
                        <div class="col-12 col-sm-4">
                            <label class="form-label form-field-label">Nombre del concepto</label>
                            <input type="text" id="nuevoIngresoNombre" class="form-control form-control-sm" placeholder="Ej: Sueldo empresa">
                        </div>
                        <div class="col-12 col-sm-4">
                            <label class="form-label form-field-label">Cuenta por defecto</label>
                            <select id="nuevoIngresoCuenta" class="form-select form-select-sm">
                                <option value="">— Sin cuenta —</option>
                            </select>
                        </div>
                        <div class="col-12 col-sm-2">
                            <label class="form-label form-field-label">Importe</label>
                            <input type="text" inputmode="decimal" id="nuevoIngresoImporte" class="form-control form-control-sm" placeholder="$ 0,00">
                        </div>
                        <div class="col-12 col-sm-2 d-flex gap-1">
                            <button class="btn btn-success btn-sm flex-fill" onclick="guardarNuevoIngreso()">
                                <i class="bi bi-check-lg"></i>
                            </button>
                            <button class="btn btn-outline-secondary btn-sm" onclick="ocultarFormNuevoIngreso()">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Lista de ingresos -->
                <div class="modal-body p-0" id="modalIngresosBody">
                    <div class="text-center py-4 text-muted">Cargando...</div>
                </div>

                <!-- Totales -->
                <div class="ingreso-totales border-top" id="totalIngresosModal"></div>

                <div class="modal-footer">
                    <button class="btn btn-success btn-sm me-auto" onclick="mostrarFormNuevoIngreso()">
                        <i class="bi bi-plus-lg me-1"></i>Nuevo ingreso
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Vencimientos -->
    <div class="modal fade" id="modalVencimientos" tabindex="-1" aria-labelledby="modalVencimientosLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalVencimientosLabel">
                        <i class="bi bi-clock-history text-warning me-2"></i>Vencimientos
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body" id="modalVencimientosBody">
                    <p class="text-center text-muted py-3">Sin vencimientos próximos</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal ABM Conceptos -->
    <div class="modal fade" id="modalConceptos" tabindex="-1" aria-labelledby="modalConceptosLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalConceptosLabel">
                        <i class="bi bi-list-ul me-2"></i>Administrar Conceptos
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">

                    <!-- Tabs -->
                    <ul class="nav nav-tabs mb-3" id="tabsConceptos" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="tab-gastos-btn" data-bs-toggle="tab"
                                data-bs-target="#tab-gastos" type="button" role="tab">
                                <i class="bi bi-graph-down text-danger me-1"></i>Gastos
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="tab-categorias-btn" data-bs-toggle="tab"
                                data-bs-target="#tab-categorias" type="button" role="tab">
                                <i class="bi bi-tags me-1"></i>Categorías
                            </button>
                        </li>
                    </ul>

                    <!-- Formulario nuevo concepto -->
                    <div id="formNuevoConcepto" class="card border-primary mb-3 d-none">
                        <div class="card-body">
                            <h6 class="card-title">Nuevo Concepto</h6>
                            <div class="row g-2 align-items-end">
                                <div class="col-sm-3">
                                    <label class="form-label small">Nombre</label>
                                    <input type="text" id="nuevoNombre" class="form-control form-control-sm" placeholder="Nombre del concepto">
                                </div>
                                <div class="col-sm-2">
                                    <label class="form-label small">Tipo</label>
                                    <select id="nuevoTipo" class="form-select form-select-sm">
                                        <option value="ingreso">Ingreso</option>
                                        <option value="gasto">Gasto</option>
                                    </select>
                                </div>
                                <div class="col-sm-3">
                                    <label class="form-label small">Categoría</label>
                                    <select id="nuevoCategoria" class="form-select form-select-sm">
                                        <option value="">— Sin categoría —</option>
                                    </select>
                                </div>
                                <div class="col-sm-1">
                                    <label class="form-label small">Orden</label>
                                    <input type="number" id="nuevoOrden" class="form-control form-control-sm" placeholder="Auto" min="1">
                                </div>
                                <div class="col-sm-1 d-flex align-items-end pb-1">
                                    <div class="form-check form-switch mb-0">
                                        <input class="form-check-input" type="checkbox" id="nuevoPermiteMultiples">
                                        <label class="form-check-label small" for="nuevoPermiteMultiples">Multi</label>
                                    </div>
                                </div>
                                <div class="col-6 col-sm-1">
                                    <label class="form-label small">Moneda</label>
                                    <select id="nuevoMoneda" class="form-select form-select-sm" onchange="actualizarCtaDefNuevo()">
                                        <option value="ARS">ARS $</option>
                                        <option value="USD">USD U$D</option>
                                    </select>
                                </div>
                                <div class="col-6 col-sm-2">
                                    <label class="form-label small">Cuenta default</label>
                                    <select id="nuevoCtaDef" class="form-select form-select-sm"></select>
                                </div>
                                <div class="col-sm-2 d-flex gap-1">
                                    <button class="btn btn-primary btn-sm flex-fill" onclick="guardarNuevoConcepto()">
                                        <i class="bi bi-check-lg"></i>
                                    </button>
                                    <button class="btn btn-outline-secondary btn-sm" onclick="cancelarNuevoConcepto()">
                                        <i class="bi bi-x-lg"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Contenido tabs -->
                    <div class="tab-content" id="tabsConceptosContent">

                        <!-- Gastos -->
                        <div class="tab-pane fade show active" id="tab-gastos" role="tabpanel">
                            <div class="d-flex justify-content-end mb-2">
                                <button class="btn btn-danger btn-sm" onclick="mostrarFormNuevo('gasto')">
                                    <i class="bi bi-plus-lg me-1"></i>Nuevo gasto
                                </button>
                            </div>
                            <div id="listaGastos">
                                <div class="text-center py-3 text-muted">Cargando...</div>
                            </div>
                        </div>

                        <!-- Categorías -->
                        <div class="tab-pane fade" id="tab-categorias" role="tabpanel">
                            <div class="d-flex justify-content-end mb-2">
                                <button class="btn btn-primary btn-sm" onclick="mostrarFormNuevaCategoria()">
                                    <i class="bi bi-plus-lg me-1"></i>Nueva categoría
                                </button>
                            </div>
                            <!-- Formulario nueva categoría -->
                            <div id="formNuevaCategoria" class="card border-primary mb-3 d-none">
                                <div class="card-body">
                                    <h6 class="card-title">Nueva Categoría</h6>
                                    <div class="row g-2 align-items-end">
                                        <div class="col-sm-4">
                                            <label class="form-label small">Nombre</label>
                                            <input type="text" id="catNombre" class="form-control form-control-sm" placeholder="Nombre de la categoría">
                                        </div>
                                        <div class="col-sm-2">
                                            <label class="form-label small">Color</label>
                                            <input type="color" id="catColor" class="form-control form-control-sm form-control-color w-100" value="#2563EB">
                                        </div>
                                        <div class="col-sm-3">
                                            <label class="form-label small">Ícono Bootstrap <span class="text-muted">(opcional)</span></label>
                                            <input type="text" id="catIcono" class="form-control form-control-sm" placeholder="bi-house-fill">
                                        </div>
                                        <div class="col-sm-1">
                                            <label class="form-label small">Orden</label>
                                            <input type="number" id="catOrden" class="form-control form-control-sm" placeholder="Auto" min="1">
                                        </div>
                                        <div class="col-sm-2 d-flex gap-1">
                                            <button class="btn btn-primary btn-sm flex-fill" onclick="guardarNuevaCategoria()">
                                                <i class="bi bi-check-lg"></i>
                                            </button>
                                            <button class="btn btn-outline-secondary btn-sm" onclick="cancelarNuevaCategoria()">
                                                <i class="bi bi-x-lg"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div id="listaCategorias">
                                <div class="text-center py-3 text-muted">Cargando...</div>
                            </div>
                        </div>

                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    </div>

    <!-- FAB gasto rápido -->
    <button class="fab" onclick="abrirModalGastoRapido()" title="Gasto rápido">
        <i class="bi bi-plus-lg"></i>
    </button>

    <!-- Modal Gasto Rápido -->
    <div class="modal fade" id="modalGastoRapido" tabindex="-1" aria-labelledby="modalGastoRapidoLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalGastoRapidoLabel">
                        <i class="bi bi-lightning-fill text-danger me-2"></i>Gasto rápido
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label form-field-label">Concepto</label>
                        <select id="grConcepto" class="form-select"></select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label form-field-label">Cuenta <span class="text-danger">*</span></label>
                        <select id="grCuenta" class="form-select"></select>
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col">
                            <label class="form-label form-field-label">Fecha</label>
                            <input type="date" id="grFecha" class="form-control">
                        </div>
                        <div class="col">
                            <label class="form-label form-field-label">Importe</label>
                            <input type="text" inputmode="decimal" id="grImporte" class="form-control text-end" placeholder="0,00">
                        </div>
                    </div>
                    <div class="mb-1">
                        <label class="form-label form-field-label">Descripción <span class="fw-normal text-muted">(opcional)</span></label>
                        <input type="text" id="grDescripcion" class="form-control" placeholder="Ej: Verdulería">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-danger" onclick="guardarGastoRapido()">
                        <i class="bi bi-plus-lg me-1"></i>Agregar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- jQuery (requerido por DataTables) -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

    <!-- DataTables JS -->
    <script src="https://cdn.datatables.net/2.0.8/js/dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/2.0.8/js/dataTables.bootstrap5.min.js"></script>

    <!-- Bootstrap 5 JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Custom JS -->
    <script src="assets/js/app.js"></script>
</body>
</html>

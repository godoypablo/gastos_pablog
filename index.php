<?php
require_once 'config/auth_check.php';
require_auth_or_redirect();
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
    <meta name="theme-color" content="#1F2A37">

    <!-- PWA iOS (Safari no usa el manifest para esto) -->
    <meta name="apple-mobile-web-app-capable" content="yes">
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
</head>
<body>
    <!-- Header -->
    <header class="header bg-primary text-white shadow-sm">
        <div class="container py-4 d-flex justify-content-between align-items-center">
            <div>
                <h1 class="h2 mb-2 cifra-logo">
                    <i class="bi bi-bar-chart-fill me-2"></i>
                    Cifra
                </h1>
                <p class="mb-0 opacity-75" style="font-size:0.85rem;letter-spacing:0.3px">
                    Control financiero personal
                </p>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-light btn-sm" onclick="toggleDarkMode()" id="btnDarkMode" title="Cambiar tema">
                    <i class="bi bi-moon-fill" id="iconDarkMode"></i>
                </button>
                <button class="btn btn-light btn-sm" onclick="abrirModalConceptos()">
                    <i class="bi bi-list-ul me-1"></i>
                    Conceptos
                </button>
                <a href="logout.php" class="btn btn-outline-light btn-sm" title="Cerrar sesión">
                    <i class="bi bi-box-arrow-right"></i>
                </a>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container my-4">
        <!-- Alertas -->
        <div id="alertContainer"></div>

        <!-- Selector de Mes/Año -->
        <div class="card shadow-sm mb-4">
            <div class="card-body">
                <div class="row g-3 align-items-end">
                    <div class="col">
                        <label for="selectMes" class="form-label">
                            <i class="bi bi-calendar-month me-1"></i>
                            Mes
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
                            <i class="bi bi-calendar-event me-1"></i>
                            Año
                        </label>
                        <select id="selectAnio" class="form-select">
                            <!-- Se llena dinámicamente con JavaScript -->
                        </select>
                    </div>

                    <div class="col-auto">
                        <button id="btnCargar" class="btn btn-outline-secondary" title="Recargar">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div id="loading" class="text-center py-5 d-none">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="text-muted">Cargando datos...</p>
        </div>

        <!-- Contenido Principal -->
        <div id="contenidoPrincipal">
            <!-- Resumen -->
            <div class="card shadow-sm mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h2 class="h5 mb-0">
                        <i class="bi bi-graph-up-arrow me-2"></i>
                        Resumen - <span id="mesAnioActual"></span>
                    </h2>
                    <button class="btn btn-sm btn-outline-secondary" id="btnToggleResumen" onclick="toggleResumen()" title="Mostrar/ocultar resumen">
                        <i class="bi bi-chevron-down" id="iconToggleResumen"></i>
                    </button>
                </div>
                <div class="d-none" id="contenidoResumen">
                <div class="card-body">
                    <div class="row g-3">
                        <!-- Total Ingresos -->
                        <div class="col-md-4">
                            <div class="card card-resumen h-100">
                                <div class="card-body text-center">
                                    <div class="d-flex align-items-center justify-content-center mb-2">
                                        <i class="bi bi-arrow-up-circle-fill text-success me-2" style="font-size:1.4rem"></i>
                                        <small class="text-uppercase fw-bold text-muted">Ingresos</small>
                                    </div>
                                    <h3 class="h2 mb-0 text-success" id="totalIngresos">$0,00</h3>
                                </div>
                            </div>
                        </div>

                        <!-- Total Gastos -->
                        <div class="col-md-4">
                            <div class="card card-resumen h-100">
                                <div class="card-body text-center">
                                    <div class="d-flex align-items-center justify-content-center mb-2">
                                        <i class="bi bi-arrow-down-circle-fill text-danger me-2" style="font-size:1.4rem"></i>
                                        <small class="text-uppercase fw-bold text-muted">Gastos</small>
                                    </div>
                                    <h3 class="h2 mb-0 text-danger" id="totalGastos">$0,00</h3>
                                </div>
                            </div>
                        </div>

                        <!-- Saldo -->
                        <div class="col-md-4">
                            <div class="card card-resumen h-100" id="cardSaldo">
                                <div class="card-body text-center d-flex flex-column justify-content-center">
                                    <div class="d-flex align-items-center justify-content-center mb-2">
                                        <i class="bi bi-wallet2 me-2" id="iconSaldo" style="font-size:1.4rem"></i>
                                        <small class="text-uppercase fw-bold text-muted">Saldo</small>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-baseline mb-1">
                                        <small class="text-muted">Disponible</small>
                                        <span class="fw-bold fs-5" id="saldoDisponible">$0,00</span>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-baseline mb-2">
                                        <small class="text-muted">Pendiente</small>
                                        <span class="text-muted fw-medium" id="saldoPendiente">$0,00</span>
                                    </div>
                                    <div class="progress mb-2" style="height:4px">
                                        <div class="progress-bar" id="barraProgreso" role="progressbar" style="width:0%"></div>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-baseline">
                                        <small class="text-muted">Proyección</small>
                                        <span class="fw-medium" id="saldo">$0,00</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            </div>

            <!-- Banner vencimientos -->
            <div id="bannerVencimientos" class="mb-4"></div>

            <!-- Cuentas bancarias -->
            <div id="cardCuentas" class="mb-4"></div>

            <!-- Tabla de Ingresos -->
            <div class="card shadow-sm mb-4">
                <div class="card-header seccion-header d-flex justify-content-between align-items-center">
                    <h3 class="h6 mb-0 fw-bold seccion-titulo">
                        <i class="bi bi-graph-up text-success me-2"></i>Ingresos
                    </h3>
                    <button class="btn btn-sm btn-ghost-muted" id="btnToggleIngresos" onclick="toggleTablaIngresos()" title="Mostrar/ocultar ingresos">
                        <i class="bi bi-chevron-down" id="iconToggleIngresos"></i>
                    </button>
                </div>
                <div class="d-none" id="contenidoIngresos">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0" id="dtIngresos">
                                <thead>
                                    <tr>
                                        <th>Concepto</th>
                                        <th class="text-end">Importe</th>
                                    </tr>
                                </thead>
                                <tbody id="tablaIngresos"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabla de Gastos -->
            <div class="card shadow-sm mb-4">
                <div class="card-header seccion-header">
                    <h3 class="h6 mb-0 fw-bold seccion-titulo">
                        <i class="bi bi-graph-down text-danger me-2"></i>Gastos
                    </h3>
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

    <!-- Modal ABM Conceptos -->
    <div class="modal fade" id="modalConceptos" tabindex="-1" aria-labelledby="modalConceptosLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
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
                            <button class="nav-link active" id="tab-ingresos-btn" data-bs-toggle="tab"
                                data-bs-target="#tab-ingresos" type="button" role="tab">
                                <i class="bi bi-graph-up text-success me-1"></i>Ingresos
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="tab-gastos-btn" data-bs-toggle="tab"
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

                        <!-- Ingresos -->
                        <div class="tab-pane fade show active" id="tab-ingresos" role="tabpanel">
                            <div class="d-flex justify-content-end mb-2">
                                <button class="btn btn-success btn-sm" onclick="mostrarFormNuevo('ingreso')">
                                    <i class="bi bi-plus-lg me-1"></i>Nuevo ingreso
                                </button>
                            </div>
                            <div id="listaIngresos">
                                <div class="text-center py-3 text-muted">Cargando...</div>
                            </div>
                        </div>

                        <!-- Gastos -->
                        <div class="tab-pane fade" id="tab-gastos" role="tabpanel">
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

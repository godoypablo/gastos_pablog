/**
 * JavaScript para Sistema de Gastos Personales
 */

// Interceptar 401 en todas las llamadas a la API propia
const _fetch = window.fetch.bind(window);
window.fetch = async function(...args) {
    const response = await _fetch(...args);
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
    if (response.status === 401 && url.startsWith('api/')) {
        window.location.href = 'login.php';
    }
    return response;
};

const API_URL = 'api/gastos_api.php';

// Scroll tracker para chips catNav
let _catScrollHandler  = null;
let _catScrollRafPending = false;
let _catScrollLastCat  = null;

// Estado de la aplicación
const app = {
    mesActual: new Date().getMonth() + 1,
    anioActual: new Date().getFullYear(),
    datos: null,
    guardandoCambios: false,
    dtIngresos: null, // ya no se usa (ingresos en modal unificado)
    dtGastos: null,
    categorias: [],
    categoriasColapsadas: new Set(),
    categoriaFiltrada: null,   // mobile: filtro activo (null = mostrar todo)
    importesOcultos: false,    // privacidad: blur en todos los importes
    cuentas: [],
    tipoCambioUSD: null,  // cotización dólar oficial (cacheada por día)
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    inicializarSelectores();
    actualizarLabelFiltro();

    // Filtro mes/año: collapse nativo Bootstrap + persistencia localStorage
    const elFiltro = document.getElementById('contenidoFiltroMes');
    const elIconFiltro = document.getElementById('iconFiltroMes');
    elFiltro.addEventListener('show.bs.collapse', () => {
        elIconFiltro.className = 'bi bi-chevron-up';
        localStorage.setItem('cifra-filtro-abierto', '1');
    });
    elFiltro.addEventListener('hide.bs.collapse', () => {
        elIconFiltro.className = 'bi bi-chevron-down';
        localStorage.setItem('cifra-filtro-abierto', '0');
    });
    if (localStorage.getItem('cifra-filtro-abierto') === '1') {
        new bootstrap.Collapse(elFiltro, { toggle: false }).show();
    }

    // CSS vars para sticky: header fija su altura, topbar se pega debajo, catNav debajo de ambos
    const _setStickyOffsets = () => {
        const headerH = document.querySelector('.header')?.offsetHeight || 0;
        const topbarH = document.querySelector('.cifra-topbar')?.offsetHeight || 0;
        document.documentElement.style.setProperty('--header-height',   headerH + 'px');
        document.documentElement.style.setProperty('--sticky-nav-top', (headerH + topbarH) + 'px');
        _initCatScrollTracker();
    };
    _setStickyOffsets();
    window.addEventListener('resize', _setStickyOffsets);

    app.importesOcultos = localStorage.getItem('cifra-oculto') === '1';
    _aplicarOcultarImportes();
    cargarDatos();
    sincronizarIconDarkMode();
    document.getElementById('btnCargar').addEventListener('click', cargarDatos);
    document.getElementById('selectMes').addEventListener('change', cargarDatos);
    document.getElementById('selectAnio').addEventListener('change', cargarDatos);

    // Al abrir modal ingresos, renderizar si los datos ya están cargados
    document.getElementById('modalIngresos').addEventListener('show.bs.modal', () => {
        if (app.datos) renderizarModalIngresos();
    });

    // iOS: no dispara beforeinstallprompt → banner propio
    const isIOS        = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true
                      || window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone && !localStorage.getItem('cifra-ios-dismissed')) {
        setTimeout(_mostrarBannerInstalariOS, 2500);
    }
});

// Registrar Service Worker (PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
            .then(reg => {
                // Cuando el nuevo SW toma el control, recargar para servir assets frescos
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    window.location.reload();
                });
                // Forzar chequeo de actualización en cada carga
                reg.update();
            })
            .catch(err => console.warn('Service Worker no registrado:', err));
    });
}

// ── PWA Install prompt (Android Chrome) ─────────────────────
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    // No mostrar si ya lo cerró en esta sesión
    if (!sessionStorage.getItem('cifra-install-dismissed')) {
        _mostrarBannerInstalar();
    }
});

window.addEventListener('appinstalled', () => {
    _ocultarBannerInstalar();
    _deferredInstallPrompt = null;
});

function _mostrarBannerInstalar() {
    if (document.getElementById('bannerInstalar')) return;
    const banner = document.createElement('div');
    banner.id = 'bannerInstalar';
    banner.className = 'banner-instalar';
    banner.innerHTML = `
        <div class="banner-instalar-inner">
            <i class="bi bi-phone-fill me-2 flex-shrink-0"></i>
            <span class="flex-grow-1">Instalá Cifra como app</span>
            <button class="btn btn-sm btn-light fw-600 me-2" onclick="instalarApp()">Instalar</button>
            <button class="btn btn-sm btn-link text-white p-0 opacity-75" onclick="_cerrarBannerInstalar()">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    `;
    document.body.appendChild(banner);
}

function _ocultarBannerInstalar() {
    document.getElementById('bannerInstalar')?.remove();
}

function _cerrarBannerInstalar() {
    _ocultarBannerInstalar();
    sessionStorage.setItem('cifra-install-dismissed', '1');
}

async function instalarApp() {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const { outcome } = await _deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
        _deferredInstallPrompt = null;
        _ocultarBannerInstalar();
    }
}

// ── Banner iOS (Safari no dispara beforeinstallprompt) ───────
function _mostrarBannerInstalariOS() {
    if (document.getElementById('bannerInstalariOS')) return;
    const banner = document.createElement('div');
    banner.id = 'bannerInstalar';          // mismo id → mismo CSS
    banner.className = 'banner-instalar banner-instalar-ios';
    banner.innerHTML = `
        <div class="banner-instalar-inner" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
            <div class="d-flex align-items-center justify-content-between w-100">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-phone-fill flex-shrink-0"></i>
                    <strong>Instalá Cifra como app</strong>
                </div>
                <button class="btn btn-sm btn-link text-white p-0 opacity-75"
                    onclick="_cerrarBannerInstalariOS()">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="d-flex align-items-center gap-2" style="font-size:0.83rem;opacity:0.9">
                <span>Tocá</span>
                <i class="bi bi-box-arrow-up" style="font-size:1.15rem"></i>
                <span>y después elegí</span>
                <span style="background:rgba(255,255,255,0.15);padding:0.1rem 0.5rem;border-radius:6px;font-weight:600">
                    Agregar a inicio
                </span>
            </div>
        </div>
    `;
    document.body.appendChild(banner);
}

function _cerrarBannerInstalariOS() {
    document.getElementById('bannerInstalar')?.remove();
    localStorage.setItem('cifra-ios-dismissed', '1');
}

// ============================================================
// Dark mode
// ============================================================
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-bs-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('cifra-theme', newTheme);
    sincronizarIconDarkMode();
    // Re-renderizar elementos con colores de categoría inyectados inline
    renderizarCatNav();
    if (app.dtGastos) app.dtGastos.draw(false);
}

// Ajusta un color HEX oscuro para que sea legible en dark mode (lightness ≥ 60%)
function _ajustarColorParaDark(hex) {
    if (!hex || hex.length < 7) return '#94A3B8';
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (l >= 0.40) return hex;  // ya suficientemente claro, sin cambios
    const d = max - min;
    const s = d === 0 ? 0 : (l > 0.5 ? d / (2 - max - min) : d / (max + min));
    let h = 0;
    if (d !== 0) {
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return `hsl(${Math.round(h * 360)}, ${Math.max(Math.round(s * 100), 28)}%, 65%)`;
}

// Devuelve el color de categoría ajustado según el tema activo
function _colorCategoria(color) {
    const c = color || '#6B7280';
    return document.documentElement.getAttribute('data-bs-theme') === 'dark'
        ? _ajustarColorParaDark(c)
        : c;
}

// Ocultar/mostrar todos los importes en pantalla (modo privacidad)
function toggleImportesOcultos() {
    app.importesOcultos = !app.importesOcultos;
    localStorage.setItem('cifra-oculto', app.importesOcultos ? '1' : '0');
    _aplicarOcultarImportes();
}

function _aplicarOcultarImportes() {
    document.documentElement.classList.toggle('cifra-oculto', app.importesOcultos);
    const icon = document.getElementById('iconOcultarImportes');
    if (icon) icon.className = app.importesOcultos ? 'bi bi-eye-slash' : 'bi bi-eye';
}

function sincronizarIconDarkMode() {
    const icon = document.getElementById('iconDarkMode');
    if (!icon) return;
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    icon.className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
}

// ============================================================
// Formato currency para inputs
// ============================================================
function formatearImporteDisplay(valor) {
    const n = parseFloat(valor) || 0;
    if (n === 0) return '';
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(n);
}

function parsearImporte(texto) {
    if (!texto && texto !== 0) return 0;
    return parseFloat(
        String(texto)
            .replace(/[$ ]/g, '')   // eliminar signo $ y espacios
            .replace(/\./g, '')     // eliminar separadores de miles
            .replace(',', '.')      // coma decimal → punto
    ) || 0;
}

// Inicializar selectores de mes y año
function inicializarSelectores() {
    const selectMes = document.getElementById('selectMes');
    const selectAnio = document.getElementById('selectAnio');

    // Configurar mes actual
    selectMes.value = app.mesActual;

    // Configurar año actual
    selectAnio.value = app.anioActual;

    // Generar opciones de años (5 años atrás y 2 hacia adelante)
    const anioMin = app.anioActual - 5;
    const anioMax = app.anioActual + 2;

    selectAnio.innerHTML = '';
    for (let anio = anioMax; anio >= anioMin; anio--) {
        const option = document.createElement('option');
        option.value = anio;
        option.textContent = anio;
        if (anio === app.anioActual) {
            option.selected = true;
        }
        selectAnio.appendChild(option);
    }
}

// Cargar datos desde la API
async function cargarDatos() {
    const selectMes = document.getElementById('selectMes');
    const selectAnio = document.getElementById('selectAnio');

    app.mesActual = parseInt(selectMes.value);
    app.anioActual = parseInt(selectAnio.value);

    mostrarLoading();

    try {
        const [response, respCuentas] = await Promise.all([
            fetch(`${API_URL}?mes=${app.mesActual}&anio=${app.anioActual}`),
            fetch(`api/cuentas_api.php?mes=${app.mesActual}&anio=${app.anioActual}`)
        ]);
        const result     = await response.json();
        const resCuentas = await respCuentas.json();

        if (result.success) {
            app.datos = result.data;
            if (resCuentas.success) app.cuentas = resCuentas.data;
            renderizarDatos();
        } else {
            mostrarError('Error al cargar los datos: ' + result.message);
        }
    } catch (error) {
        mostrarError('Error de conexión: ' + error.message);
    } finally {
        ocultarLoading();
    }
}

// Renderizar datos en la interfaz
function renderizarDatos() {
    if (!app.datos) return;

    // Actualizar resumen — resumen viene separado por moneda {ARS: {...}, USD: {...}}
    const resARS = app.datos.resumen?.ARS || { total_ingresos: 0, ingresos_cobrados: 0, total_gastos: 0, gastos_pagados: 0 };
    const resUSD = app.datos.resumen?.USD || { total_ingresos: 0, ingresos_cobrados: 0, total_gastos: 0, gastos_pagados: 0 };

    // Disponible por moneda = saldo real en cuentas − gastos pendientes del mes
    const totalCuentasARS  = (app.cuentas || []).filter(c => (c.moneda || 'ARS') === 'ARS').reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0);
    const totalCuentasUSD  = (app.cuentas || []).filter(c => c.moneda === 'USD').reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0);
    const disponibleARS    = totalCuentasARS - (resARS.total_gastos - resARS.gastos_pagados);
    const disponibleUSD    = totalCuentasUSD;
    const pctPagado        = resARS.total_gastos > 0 ? Math.min(100, (resARS.gastos_pagados / resARS.total_gastos) * 100) : 0;

    document.getElementById('totalIngresos').textContent   = formatearMoneda(resARS.total_ingresos);
    document.getElementById('totalGastos').textContent     = formatearMoneda(resARS.total_gastos);
    document.getElementById('saldoDisponible').textContent = formatearMoneda(disponibleARS);

    // Topbar ARS
    const elSFH = document.getElementById('saldoFiltroHeader');
    if (elSFH) {
        elSFH.textContent = formatearMoneda(disponibleARS);
        elSFH.style.color = disponibleARS >= 0 ? 'var(--cifra-pos)' : 'var(--cifra-neg)';
    }
    // Topbar USD — solo visible si hay cuentas o gastos USD
    const hayUSD = totalCuentasUSD > 0 || resUSD.total_gastos > 0;
    const elStatUSD = document.getElementById('statUSD');
    if (elStatUSD) elStatUSD.classList.toggle('d-none', !hayUSD);
    const elUSDH = document.getElementById('saldoUSDHeader');
    if (elUSDH) {
        elUSDH.textContent = formatearMoneda(disponibleUSD, 'USD');
        elUSDH.style.color = disponibleUSD >= 0 ? 'var(--cifra-pos)' : 'var(--cifra-neg)';
    }

    const elTGH = document.getElementById('totalGastosHeader');
    if (elTGH) elTGH.textContent = formatearMoneda(resARS.total_gastos);
    const elGPH = document.getElementById('gastosPagadosHeader');
    if (elGPH) elGPH.textContent = formatearMoneda(resARS.gastos_pagados);
    const elPPH = document.getElementById('gastosPorPagarHeader');
    if (elPPH) elPPH.textContent = formatearMoneda(resARS.total_gastos - resARS.gastos_pagados);
    document.getElementById('barraProgreso').style.width   = pctPagado + '%';
    document.getElementById('barraProgreso').title         = `${pctPagado.toFixed(0)}% de gastos pagados`;

    // Color de la card según disponible ARS
    const cardSaldo = document.getElementById('cardSaldo');
    const iconSaldo = document.getElementById('iconSaldo');

    if (disponibleARS < 0) {
        cardSaldo.classList.add('negativo');
        iconSaldo.classList.remove('bi-bar-chart-steps');
        iconSaldo.classList.add('bi-exclamation-triangle-fill', 'text-danger');
    } else {
        cardSaldo.classList.remove('negativo');
        iconSaldo.classList.remove('bi-exclamation-triangle-fill', 'text-danger');
        iconSaldo.classList.add('bi-bar-chart-steps');
    }

    // Destruir DataTable gastos antes de limpiar tbody
    if (app.dtGastos) { app.dtGastos.destroy(); app.dtGastos = null; }

    // Renderizar gastos
    const gastos = app.datos.conceptos.filter(c => c.tipo === 'gasto');
    const tbodyGastos = document.getElementById('tablaGastos');
    tbodyGastos.innerHTML = '';
    gastos.forEach(concepto => {
        const filas = crearFilasConcepto(concepto, 'gasto');
        filas.forEach(fila => tbodyGastos.appendChild(fila));
    });

    // Actualizar título del mes
    document.getElementById('mesAnioActual').textContent =
        `${String(app.mesActual).padStart(2, '0')}/${app.anioActual}`;
    actualizarLabelFiltro();

    inicializarDataTables();
    renderizarCatNav();
    mostrarBannerPeriodo();
    mostrarBannerVencimientos();
    renderizarResumenCategorias();
    renderizarResumenPendientes();
    renderizarResumenIngresos();
    renderizarCuentas();
    renderizarCardCuentasHome();

    // Si el modal de ingresos está abierto, re-renderizarlo con datos frescos
    if (document.getElementById('modalIngresos')?.classList.contains('show')) {
        renderizarModalIngresos();
    }
    if (document.getElementById('modalGerencial')?.classList.contains('show')) {
        renderizarGerencial();
    }
}

function mostrarBannerVencimientos() {
    const modalBody = document.getElementById('modalVencimientosBody');
    const badgeMenu = document.getElementById('badgeMenuVenc');
    const badgeVenc = document.getElementById('badgeVencMenu');

    // Reset badges
    badgeMenu.classList.add('d-none');
    badgeVenc.classList.add('d-none');
    modalBody.innerHTML = '<p class="text-center text-muted py-3">Sin vencimientos próximos</p>';

    if (!app.datos?.conceptos) return;

    const hoy     = new Date().toISOString().split('T')[0];
    const en7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const candidatos = app.datos.conceptos.filter(c =>
        c.tipo === 'gasto' && c.fecha_vencimiento && c.pagado !== 1
    );
    const fechas = candidatos.map(c => ({ ...c, fv: c.fecha_vencimiento.split('T')[0] }));

    const vencidos = fechas.filter(c => c.fv < hoy);
    const proximos = fechas.filter(c => c.fv >= hoy && c.fv <= en7dias);

    if (vencidos.length === 0 && proximos.length === 0) return;

    // Actualizar badges
    const totalBadge = vencidos.length + proximos.length;
    badgeMenu.textContent = totalBadge;
    badgeMenu.classList.remove('d-none');
    badgeVenc.textContent = totalBadge;
    badgeVenc.classList.remove('d-none');

    const totalVencidos = vencidos.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);
    const totalProximos = proximos.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);

    const filaItem = (c, esVencido) => `
        <div class="venc-fila">
            <span class="venc-nombre">${c.nombre}</span>
            <span class="venc-fecha ${esVencido ? 'venc-fecha-vencido' : ''}">${esVencido ? 'vencido' : formatearFechaCorta(c.fv)}</span>
            <span class="venc-importe">${formatearMoneda(parseFloat(c.importe) || 0, c.moneda || 'ARS')}</span>
        </div>`;

    modalBody.innerHTML = `
        ${vencidos.length ? `
        <div class="venc-grupo">
            <div class="venc-grupo-label venc-grupo-label-vencido">Vencidos · ${formatearMoneda(totalVencidos)}</div>
            ${vencidos.map(c => filaItem(c, true)).join('')}
        </div>` : ''}
        ${proximos.length ? `
        <div class="venc-grupo">
            <div class="venc-grupo-label">Esta semana · ${formatearMoneda(totalProximos)}</div>
            ${proximos.map(c => filaItem(c, false)).join('')}
        </div>` : ''}`;
}

function mostrarBannerPeriodo() {
    // Limpiar banner anterior si existía
    document.getElementById('bannerPeriodo')?.remove();

    if (app.datos.periodo_existe) return;

    // Mes anterior (maneja enero → diciembre del año anterior)
    let prevMes = app.mesActual - 1;
    let prevAnio = app.anioActual;
    if (prevMes < 1) { prevMes = 12; prevAnio--; }

    const nombreActual = `${obtenerNombreMes(app.mesActual)} ${app.anioActual}`;
    const nombrePrev   = `${obtenerNombreMes(prevMes)} ${prevAnio}`;

    const banner = document.createElement('div');
    banner.id = 'bannerPeriodo';
    banner.className = 'alert alert-info d-flex align-items-center gap-3 mb-4';
    banner.innerHTML = `
        <i class="bi bi-calendar-plus flex-shrink-0 fs-5"></i>
        <div class="flex-grow-1">
            <strong>No hay datos para ${nombreActual}.</strong>
            Podés empezar en blanco o copiar los importes del mes anterior.
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
            <button class="btn btn-outline-secondary btn-sm" onclick="this.closest('#bannerPeriodo').remove()">
                <i class="bi bi-pencil me-1"></i>Empezar en blanco
            </button>
            <button class="btn btn-info btn-sm text-white" onclick="copiarPeriodoAnterior(${prevMes}, ${prevAnio})">
                <i class="bi bi-copy me-1"></i>Copiar de ${nombrePrev}
            </button>
        </div>
    `;

    // Insertar debajo del alertContainer
    const ref = document.getElementById('alertContainer');
    ref.parentNode.insertBefore(banner, ref.nextSibling);
}

async function copiarPeriodoAnterior(fromMes, fromAnio) {
    const nombreFrom   = `${obtenerNombreMes(fromMes)} ${fromAnio}`;
    const nombreTo     = `${obtenerNombreMes(app.mesActual)} ${app.anioActual}`;

    if (!confirm(
        `¿Copiar los importes de ${nombreFrom} a ${nombreTo}?\n\n` +
        `Solo se copian conceptos de entrada única. Podés editar los valores después.`
    )) return;

    try {
        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'copiar_periodo',
                from_mes:  fromMes,
                from_anio: fromAnio,
                to_mes:    app.mesActual,
                to_anio:   app.anioActual
            })
        });
        const result = await response.json();
        if (result.success) {
            mostrarToast(`Copiados ${result.data.copiados} registros desde ${nombreFrom}`, 'success');
            await cargarDatos();
        } else {
            mostrarError('Error al copiar: ' + result.message);
        }
    } catch (error) {
        mostrarError('Error de conexión: ' + error.message);
    }
}

function inicializarDataTables() {
    app.dtGastos = $('#dtGastos').DataTable({
        paging:   false,
        info:     false,
        ordering: false,
        dom:      't',
        autoWidth: false,
        language: { emptyTable: 'Sin datos para este período' },
        drawCallback: function() {
            inyectarCabecerasCategorias(this.api());
            _initCatScrollTracker();
        }
    });
}

// Inyectar filas de cabecera de categoría en el tbody después de cada draw de DataTables
function inyectarCabecerasCategorias(api) {
    // Calcular totales por categoría y moneda desde los datos en memoria
    const totalesPorCat = {};
    if (app.datos && app.datos.conceptos) {
        app.datos.conceptos.forEach(c => {
            if (c.categoria_id) {
                if (!totalesPorCat[c.categoria_id]) totalesPorCat[c.categoria_id] = { ARS: 0, USD: 0 };
                const m = c.moneda || 'ARS';
                totalesPorCat[c.categoria_id][m] += parseFloat(c.importe || 0);
            }
        });
    }

    let lastCatId = null;
    api.rows().every(function() {
        const tr = this.node();
        if (!tr || tr.classList.contains('categoria-header')) return;

        const catId    = tr.dataset.categoriaId    || '';
        const nombre   = tr.dataset.categoriaNombre || '';
        const color    = tr.dataset.categoriaColor  || '';
        const icono    = tr.dataset.categoriaIcono  || '';

        if (!catId || catId === lastCatId) return;
        lastCatId = catId;

        const colapsada = app.categoriasColapsadas.has(catId);
        const t = totalesPorCat[catId] || { ARS: 0, USD: 0 };
        const arsStr = t.ARS > 0 ? formatearMoneda(t.ARS) : (t.USD === 0 ? '—' : '');
        const usdStr = t.USD > 0 ? `<small class="d-block" style="font-size:0.65rem;opacity:0.8">${formatearMoneda(t.USD, 'USD')}</small>` : '';
        const totalStr = arsStr + usdStr || '—';

        const headerTr = document.createElement('tr');
        headerTr.className = 'categoria-header';
        headerTr.dataset.catToggleId = catId;
        const td = document.createElement('td');
        td.colSpan = 2;
        const displayColor = _colorCategoria(color);
        td.style.setProperty('--cat-color', displayColor);
        td.innerHTML = `<div class="categoria-header-inner">
            <i class="bi ${colapsada ? 'bi-chevron-right' : 'bi-chevron-down'} categoria-toggle-chevron" style="color:${displayColor}; font-size:0.65rem;"></i>
            ${icono ? `<i class="bi ${icono}" style="color:${displayColor}; font-size:0.78rem;"></i>` : ''}
            <span class="categoria-header-label" style="color:${displayColor}">${nombre}</span>
            <span class="categoria-header-total ms-auto text-end" style="color:${displayColor}">${totalStr}</span>
        </div>`;
        headerTr.appendChild(td);
        // En desktop: click en header colapsa/expande. En mobile: solo chips filtran.
        headerTr.addEventListener('click', () => { if (window.innerWidth >= 768) toggleCategoria(catId); });
        tr.parentNode.insertBefore(headerTr, tr);
    });

    // Reaplicar estado colapsado a las filas de concepto
    api.rows().every(function() {
        const tr = this.node();
        if (!tr || tr.classList.contains('categoria-header')) return;
        const catId = tr.dataset.categoriaId || '';
        if (catId && app.categoriasColapsadas.has(catId)) {
            tr.classList.add('cat-fila-colapsada');
        } else {
            tr.classList.remove('cat-fila-colapsada');
        }
    });

    // Reaplicar filtro mobile si estaba activo
    aplicarFiltroCategoria();
}

function toggleCategoria(catId) {
    const colapsada = app.categoriasColapsadas.has(catId);
    if (colapsada) {
        app.categoriasColapsadas.delete(catId);
    } else {
        app.categoriasColapsadas.add(catId);
    }
    const ahoraColapsada = !colapsada;

    // Actualizar ícono del encabezado
    const headerTr = document.querySelector(`[data-cat-toggle-id="${catId}"]`);
    if (headerTr) {
        const chevron = headerTr.querySelector('.categoria-toggle-chevron');
        if (chevron) chevron.className = `bi ${ahoraColapsada ? 'bi-chevron-right' : 'bi-chevron-down'} categoria-toggle-chevron`;
    }

    // Mostrar/ocultar filas de conceptos de esa categoría
    document.querySelectorAll(`[data-categoria-id="${catId}"]`).forEach(tr => {
        tr.classList.toggle('cat-fila-colapsada', ahoraColapsada);
        // Si es una fila de concepto múltiple con detalle abierto, cerrarlo
        if (ahoraColapsada && tr.classList.contains('concepto-multiple-header')) {
            const dtInstance = app.dtGastos;
            if (dtInstance) {
                const row = dtInstance.row(tr);
                if (row.child.isShown()) {
                    row.child.hide();
                    const arrow = tr.querySelector('.detalle-arrow');
                    if (arrow) arrow.classList.replace('bi-chevron-up', 'bi-chevron-down');
                }
            }
        }
    });

}

// Nav de categorías — chips horizontales filtro (solo mobile, d-md-none)
function renderizarCatNav() {
    const el = document.getElementById('catNav');
    if (!el || !app.datos) return;

    const cats = {};
    (app.datos.conceptos || []).filter(c => c.tipo === 'gasto').forEach(c => {
        const id = String(c.categoria_id || '0');
        if (!cats[id]) cats[id] = {
            id,
            nombre:          c.categoria_nombre || 'Sin cat.',
            color:           c.categoria_color  || '#6B7280',
            icono:           c.categoria_icono  || 'bi-tag',
            esSinCategoria:  !c.categoria_id,
            totalARS: 0,
            totalUSD: 0,
        };
        if ((c.moneda || 'ARS') === 'USD') cats[id].totalUSD += parseFloat(c.importe || 0);
        else                                cats[id].totalARS  += parseFloat(c.importe || 0);
    });

    // Orden: categorías con nombre primero; "Sin cat." al final
    const sorted = Object.values(cats).sort((a, b) => {
        if (a.esSinCategoria && !b.esSinCategoria) return 1;
        if (!a.esSinCategoria && b.esSinCategoria) return -1;
        return 0;
    });

    const chips = sorted.map(cat => {
        const activa = app.categoriaFiltrada === cat.id;
        const total  = cat.totalARS > 0
            ? formatearMoneda(cat.totalARS)
            : (cat.totalUSD > 0 ? formatearMoneda(cat.totalUSD, 'USD') : '—');
        return `<button class="cat-chip${activa ? ' activa' : ''}"
                    style="--chip-color:${_colorCategoria(cat.color)}"
                    data-cat-id="${cat.id}"
                    onclick="seleccionarCategoria('${cat.id}')">
                    <i class="bi ${cat.icono} cat-chip-icon"></i>
                    <span class="cat-chip-nombre">${cat.nombre}</span>
                    <span class="cat-chip-total">${total}</span>
                </button>`;
    }).join('');

    el.innerHTML = `<div class="cat-nav-scroll">${chips}</div>`;
}

// Filtro por chip: seleccionar → mostrar solo esa categoría; repetir → mostrar todo
function seleccionarCategoria(catId) {
    app.categoriaFiltrada = app.categoriaFiltrada === catId ? null : catId;
    _limpiarChipEnVista();
    _catScrollLastCat = null;
    renderizarCatNav();
    aplicarFiltroCategoria();
    // Scroll al inicio del contenido si se activó un filtro
    if (app.categoriaFiltrada) {
        setTimeout(() => {
            const contenido = document.getElementById('contenidoPrincipal');
            if (!contenido) return;
            const stickyH = parseInt(
                getComputedStyle(document.documentElement).getPropertyValue('--sticky-nav-top')
            ) || 0;
            const catNavH = document.getElementById('catNav')?.offsetHeight || 0;
            const top = contenido.getBoundingClientRect().top + window.scrollY - (stickyH + catNavH + 8);
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }, 60);
    }
}

// Scroll-tracker: resalta el chip de la categoría visible en el tope de pantalla
function _initCatScrollTracker() {
    if (_catScrollHandler) {
        window.removeEventListener('scroll', _catScrollHandler);
        _catScrollHandler = null;
    }
    if (window.innerWidth >= 768) return;

    _catScrollHandler = () => {
        if (_catScrollRafPending) return;
        _catScrollRafPending = true;
        requestAnimationFrame(() => {
            _catScrollRafPending = false;
            if (app.categoriaFiltrada) return;

            const stickyNavTop = parseInt(
                getComputedStyle(document.documentElement).getPropertyValue('--sticky-nav-top')
            ) || 0;
            const catNavH = document.getElementById('catNav')?.offsetHeight || 0;
            const zone = stickyNavTop + catNavH + 4;

            const headers = [...document.querySelectorAll('#tablaGastos .categoria-header')];
            let currentCat = null;
            for (const h of headers) {
                if (h.getBoundingClientRect().top <= zone) currentCat = h.dataset.catToggleId;
                else break;
            }

            if (currentCat !== _catScrollLastCat) {
                _catScrollLastCat = currentCat;
                if (currentCat) _resaltarChipEnVista(currentCat);
                else _limpiarChipEnVista();
            }
        });
    };
    window.addEventListener('scroll', _catScrollHandler, { passive: true });
}

function _resaltarChipEnVista(catId) {
    if (app.categoriaFiltrada) return;
    const nav = document.querySelector('.cat-nav-scroll');
    if (!nav) return;

    let targetChip = null;
    nav.querySelectorAll('.cat-chip').forEach(chip => {
        const isTarget = chip.dataset.catId === catId;
        chip.classList.toggle('en-vista', isTarget);
        if (isTarget) targetChip = chip;
    });

    if (targetChip) {
        const navRect   = nav.getBoundingClientRect();
        const chipRect  = targetChip.getBoundingClientRect();
        const scrollLeft = nav.scrollLeft + (chipRect.left - navRect.left)
                         - (navRect.width / 2) + (chipRect.width / 2);
        nav.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
}

function _limpiarChipEnVista() {
    document.querySelectorAll('.cat-chip.en-vista').forEach(c => c.classList.remove('en-vista'));
}

// Aplicar/quitar filtro de categoría en las filas del tbody (solo mobile)
function aplicarFiltroCategoria() {
    if (window.innerWidth >= 768) return;
    const catId = app.categoriaFiltrada;
    // Filas de concepto: ocultar las que no pertenecen a la categoría activa
    document.querySelectorAll('#tablaGastos tr[data-categoria-id]').forEach(tr => {
        const trCat = tr.dataset.categoriaId || '';
        tr.classList.toggle('cat-fila-oculta', catId !== null && trCat !== catId);
    });
    // Headers de categoría: ocultar todos cuando hay filtro activo (el chip ya indica cuál es)
    document.querySelectorAll('#tablaGastos tr.categoria-header').forEach(tr => {
        tr.classList.toggle('cat-fila-oculta', catId !== null);
    });
}

// Crear filas de concepto — devuelve array de <tr>
function crearFilasConcepto(concepto, tipo) {
    if (concepto.permite_multiples == 1) {
        return crearFilasMultiple(concepto, tipo);
    }
    return [crearFilaSimple(concepto, tipo)];
}

// Fila para concepto de entrada única (comportamiento original)
function crearFilaSimple(concepto, tipo) {
    const tr = document.createElement('tr');

    if (concepto.categoria_id) {
        tr.dataset.categoriaId     = concepto.categoria_id;
        tr.dataset.categoriaNombre = concepto.categoria_nombre || '';
        tr.dataset.categoriaColor  = concepto.categoria_color  || '';
        tr.dataset.categoriaIcono  = concepto.categoria_icono  || '';
    }

    // Columna nombre
    const tdNombre = document.createElement('td');
    tdNombre.setAttribute('data-order', concepto.nombre);
    const divNombre = document.createElement('div');
    divNombre.className = 'concepto-nombre';

    // Fila vencida: rojo si hay vencimiento, ya pasó y no está pagado
    const hoy = new Date().toISOString().split('T')[0];
    if (concepto.fecha_vencimiento && concepto.fecha_vencimiento < hoy && concepto.pagado !== 1) {
        tr.classList.add('tr-vencido');
    }

    // Botón pagado (gastos) / cobrado (ingresos)
    {
        const isPaid = concepto.pagado === 1;
        const esIngreso = tipo === 'ingreso';
        const btnPagado = document.createElement('button');
        btnPagado.className = `btn-pagado${isPaid ? ' pagado' : ''}`;
        btnPagado.title = isPaid
            ? (esIngreso ? 'Marcar como no cobrado' : 'Marcar como no pagado')
            : (esIngreso ? 'Marcar como cobrado'    : 'Marcar como pagado');
        btnPagado.innerHTML = `<i class="bi ${isPaid ? 'bi-check-circle-fill' : 'bi-circle'}"></i>`;
        btnPagado.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePagado(concepto.registro_id, btnPagado, tr, concepto.id);
        });
        divNombre.appendChild(btnPagado);
        if (isPaid) tr.classList.add('tr-pagado');
    }

    divNombre.appendChild(document.createTextNode(concepto.nombre));

    // Editor fecha de vencimiento: span con formato dd/mm/yy + input oculto
    const wrapVenc = document.createElement('div');
    wrapVenc.className = 'vencimiento-wrap';
    const icoVenc = document.createElement('i');
    icoVenc.className = 'bi bi-calendar-x';
    const spanVenc = document.createElement('span');
    spanVenc.className = 'vencimiento-texto';
    spanVenc.textContent = concepto.fecha_vencimiento
        ? formatearFechaCorta(concepto.fecha_vencimiento)
        : 'vence';
    const inputVenc = document.createElement('input');
    inputVenc.type  = 'date';
    inputVenc.className = 'input-vencimiento';
    inputVenc.value = concepto.fecha_vencimiento ? concepto.fecha_vencimiento.split('T')[0] : '';
    const abrirPickerVenc = e => {
        e.stopPropagation();
        try { inputVenc.showPicker(); } catch(_) { inputVenc.focus(); }
    };
    icoVenc.addEventListener('click', abrirPickerVenc);
    spanVenc.addEventListener('click', abrirPickerVenc);
    inputVenc.addEventListener('change', () => {
        spanVenc.textContent = inputVenc.value ? formatearFechaCorta(inputVenc.value) : 'vence';
        if (concepto.registro_id) {
            guardarVencimiento(concepto.registro_id, inputVenc.value, tr);
        }
    });
    wrapVenc.appendChild(icoVenc);
    wrapVenc.appendChild(spanVenc);
    wrapVenc.appendChild(inputVenc);
    divNombre.appendChild(wrapVenc);

    // Selector de cuenta (solo si ya existe registro)
    if (concepto.registro_id) {
        divNombre.appendChild(crearSelectorCuenta(concepto.registro_id, concepto.cuenta_id, concepto.moneda || 'ARS'));
    }

    tdNombre.appendChild(divNombre);
    tr.appendChild(tdNombre);

    // Columna importe
    const tdImporte = document.createElement('td');
    tdImporte.className = 'text-end';
    tdImporte.setAttribute('data-order', concepto.importe);

    const inputGroup = document.createElement('div');
    inputGroup.className = 'd-flex justify-content-end align-items-center gap-2';

    if (concepto.pagado === 1) {
        // Pagado: mostrar como label estático
        const span = document.createElement('span');
        span.className = 'importe-pagado fw-medium';
        span.textContent = concepto.importe > 0 ? formatearMoneda(concepto.importe, concepto.moneda || 'ARS') : '—';
        inputGroup.appendChild(span);
    } else {
        // No pagado: input editable
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.className = 'input-importe form-control';
        input.value = concepto.importe > 0 ? formatearMoneda(concepto.importe, concepto.moneda || 'ARS') : '';
        input.dataset.conceptoId = concepto.id;
        input.dataset.registroId = concepto.registro_id || '';
        input.placeholder = (concepto.moneda === 'USD') ? 'U$D 0,00' : '$ 0,00';

        input.addEventListener('focus', () => {
            const raw = parsearImporte(input.value);
            input.value = raw > 0 ? String(raw).replace('.', ',') : '';
            input.select();
        });
        input.addEventListener('blur', () => {
            const importe = parsearImporte(input.value);
            input.value = importe > 0 ? formatearMoneda(importe) : '';
            guardarImporte(concepto.id, importe, concepto.registro_id, input);
        });
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') input.blur(); });
        input.addEventListener('input', () => {
            input.classList.add('unsaved');
            input.classList.remove('saved');
        });

        // Botón SMVM para Cuota Alimentaria
        if (concepto.nombre.toLowerCase().includes('alimentaria')) {
            const btnSmvm = document.createElement('button');
            btnSmvm.className = 'btn btn-smvm';
            btnSmvm.title = 'Sugerir valor del SMVM vigente';
            btnSmvm.innerHTML = '<i class="bi bi-robot"></i>';
            btnSmvm.addEventListener('click', () => sugerirSMVM(input, btnSmvm, app.mesActual, app.anioActual));
            inputGroup.appendChild(btnSmvm);
        }

        // Botón Elena Limpieza
        if (concepto.nombre.toLowerCase().includes('elena')) {
            const btnElena = document.createElement('button');
            btnElena.className = 'btn btn-smvm';
            btnElena.title = 'Sugerir importe empleada doméstica (4h/semana)';
            btnElena.innerHTML = '<i class="bi bi-robot"></i>';
            btnElena.addEventListener('click', () => sugerirElena(input, btnElena, app.mesActual, app.anioActual));
            inputGroup.appendChild(btnElena);
        }

        // Botón Spotify Duo
        if (concepto.nombre.toLowerCase().includes('spotify')) {
            const btnSpotify = document.createElement('button');
            btnSpotify.className = 'btn btn-smvm';
            btnSpotify.title = 'Sugerir precio Spotify Duo para el mes seleccionado';
            btnSpotify.innerHTML = '<i class="bi bi-robot"></i>';
            btnSpotify.addEventListener('click', () => sugerirSpotifyDuo(input, btnSpotify, app.mesActual, app.anioActual));
            inputGroup.appendChild(btnSpotify);
        }

        // Botón YouTube Premium
        if (concepto.nombre.toLowerCase().includes('youtube')) {
            const btnYt = document.createElement('button');
            btnYt.className = 'btn btn-smvm';
            btnYt.title = 'Sugerir precio YouTube Premium al tipo de cambio actual';
            btnYt.innerHTML = '<i class="bi bi-robot"></i>';
            btnYt.addEventListener('click', () => sugerirYoutubePremium(input, btnYt));
            inputGroup.appendChild(btnYt);
        }

        inputGroup.appendChild(input);
    }

    tdImporte.appendChild(inputGroup);
    tr.appendChild(tdImporte);

    return tr;
}

// Sugerir SMVM desde la API de datos.gob.ar para el mes/año seleccionado
async function sugerirSMVM(inputElement, btnElement, mes, anio) {
    const iconOriginal = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        // Último día del mes seleccionado como límite de la consulta
        const ultimoDia = new Date(anio, mes, 0).getDate();
        const endDate = `${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`;

        const response = await fetch(
            `https://apis.datos.gob.ar/series/api/series/?ids=57.1_SMVMM_0_M_34&end_date=${endDate}&limit=1&sort=desc`
        );
        if (!response.ok) throw new Error('No se pudo obtener el SMVM');
        const json = await response.json();

        if (!json.data || json.data.length === 0) {
            throw new Error('No hay datos disponibles para el período seleccionado');
        }

        const [fechaISO, valor] = json.data[0];
        const [anioSmvm, mesSmvm] = fechaISO.split('-');
        const fechaFormateada = `${obtenerNombreMes(parseInt(mesSmvm))} ${anioSmvm}`;

        const confirmar = confirm(
            `SMVM vigente en ${obtenerNombreMes(mes)} ${anio}:\n${formatearMoneda(valor)} (ref: ${fechaFormateada})\n\n¿Usar este valor para Cuota Alimentaria?`
        );

        if (confirmar) {
            inputElement.value = valor;
            inputElement.classList.add('unsaved');
            inputElement.focus();
            inputElement.blur();
        }
    } catch (error) {
        mostrarError('No se pudo obtener el SMVM: ' + error.message);
    } finally {
        btnElement.disabled = false;
        btnElement.innerHTML = iconOriginal;
    }
}

// Filas para concepto de múltiples entradas: solo [trHeader] — detalle via DataTables child row
function crearFilasMultiple(concepto, tipo) {
    const cantRegistros = concepto.detalle ? concepto.detalle.length : 0;

    const trHeader = document.createElement('tr');
    trHeader.className = 'concepto-multiple-header';
    trHeader.style.cursor = 'pointer';
    trHeader.dataset.conceptoId = concepto.id;
    trHeader.addEventListener('click', () => toggleDetalle(concepto.id));

    if (concepto.categoria_id) {
        trHeader.dataset.categoriaId     = concepto.categoria_id;
        trHeader.dataset.categoriaNombre = concepto.categoria_nombre || '';
        trHeader.dataset.categoriaColor  = concepto.categoria_color  || '';
        trHeader.dataset.categoriaIcono  = concepto.categoria_icono  || '';
    }

    // Guardar el nodo de detalle directamente en el tr (con sus event listeners)
    trHeader._detalleNode = crearTablaDetalle(concepto);

    // Columna nombre con flecha
    const tdNombre = document.createElement('td');
    tdNombre.setAttribute('data-order', concepto.nombre);
    const divNombre = document.createElement('div');
    divNombre.className = 'concepto-nombre';

    divNombre.appendChild(document.createTextNode(concepto.nombre));

    const badge = document.createElement('span');
    badge.className = 'badge badge-count';
    badge.id = `badge-count-${concepto.id}`;
    badge.textContent = cantRegistros;
    divNombre.appendChild(badge);

    const arrow = document.createElement('i');
    arrow.className = 'bi bi-chevron-down ms-1 detalle-arrow text-muted';
    arrow.id = `arrow-${concepto.id}`;
    divNombre.appendChild(arrow);

    tdNombre.appendChild(divNombre);
    trHeader.appendChild(tdNombre);

    // Columna total — mismo estilo visual que entrada única pero readonly
    const tdTotal = document.createElement('td');
    tdTotal.className = 'text-end';
    tdTotal.setAttribute('data-order', concepto.importe);

    const inputGroupTotal = document.createElement('div');
    inputGroupTotal.className = 'd-flex justify-content-end align-items-center gap-2';

    const spanTotal = document.createElement('span');
    spanTotal.className = 'importe-pagado';
    spanTotal.id = `total-concepto-${concepto.id}`;
    spanTotal.textContent = formatearMoneda(concepto.importe, concepto.moneda || 'ARS');
    spanTotal.title = 'Total del mes — expandí para ver el detalle';

    inputGroupTotal.appendChild(spanTotal);
    tdTotal.appendChild(inputGroupTotal);
    trHeader.appendChild(tdTotal);

    return [trHeader];
}

// Tabla interior con los registros del concepto múltiple
function crearTablaDetalle(concepto) {
    const wrapper = document.createElement('div');
    wrapper.className = 'detalle-wrapper';

    const tabla = document.createElement('table');
    tabla.className = 'table table-sm mb-0 detalle-tabla';

    const tbody = document.createElement('tbody');

    // Filas de registros existentes
    if (concepto.detalle && concepto.detalle.length > 0) {
        concepto.detalle.forEach(reg => {
            tbody.appendChild(crearFilaRegistroDetalle(reg, concepto.id, concepto.moneda || 'ARS'));
        });
    } else {
        const trVacio = document.createElement('tr');
        trVacio.className = 'fila-sin-registros';
        trVacio.innerHTML = `<td colspan="4" class="text-muted text-center py-2 fst-italic">Sin registros este mes</td>`;
        tbody.appendChild(trVacio);
    }

    // Fila formulario para agregar
    tbody.appendChild(crearFilaFormNuevoRegistro(concepto.id, concepto.moneda || 'ARS', concepto.cuenta_id_default));

    tabla.appendChild(tbody);
    wrapper.appendChild(tabla);
    return wrapper;
}

// Fila de un registro individual dentro del detalle
function crearFilaRegistroDetalle(reg, conceptoId, moneda = 'ARS') {
    const tr = document.createElement('tr');
    tr.id = `registro-${reg.id}`;
    const isPaid = reg.pagado === 1;
    if (isPaid) tr.classList.add('tr-pagado');

    const hoy = new Date().toISOString().split('T')[0];
    if (reg.fecha_vencimiento && reg.fecha_vencimiento.split('T')[0] < hoy && !isPaid) {
        tr.classList.add('tr-vencido');
    }

    const fechaVenc = reg.fecha_vencimiento ? reg.fecha_vencimiento.split('T')[0] : '';

    tr.innerHTML = `
        <td class="ps-3" style="width:110px">
            <div class="d-flex align-items-center gap-2">
                <button class="btn-pagado${isPaid ? ' pagado' : ''}"
                    title="${isPaid ? 'Marcar como no pagado' : 'Marcar como pagado'}"
                    onclick="togglePagado(${reg.id}, this, this.closest('tr'))">
                    <i class="bi ${isPaid ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
                </button>
                <span class="text-muted" style="font-size:0.78rem">${formatearFechaCorta(reg.fecha)}</span>
            </div>
        </td>
        <td class="text-muted fst-italic" style="font-size:0.82rem">${reg.observaciones || '<span class="opacity-50">—</span>'}</td>
        <td class="text-end fw-medium det-importe">${formatearMoneda(reg.importe, moneda)}</td>
        <td class="text-end pe-3" style="width:50px">
            <button class="btn btn-outline-danger btn-sm py-0 px-1"
                title="Eliminar"
                onclick="eliminarRegistroMultiple(${reg.id}, ${conceptoId})">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;

    // Agregar selector de cuenta en la primera celda (bajo pagado+fecha)
    const tdFecha = tr.querySelector('td:first-child');
    const wrapCuenta = crearSelectorCuenta(reg.id, reg.cuenta_id, moneda);
    wrapCuenta.classList.add('cuenta-wrap-detalle');
    tdFecha.appendChild(wrapCuenta);

    return tr;
}

// Fila con formulario para agregar nuevo registro
function crearFilaFormNuevoRegistro(conceptoId, moneda = 'ARS', cuentaDefault = null) {
    const tr = document.createElement('tr');
    tr.className = 'fila-nuevo-registro';
    tr.id = `form-nuevo-${conceptoId}`;

    const hoy = new Date().toISOString().split('T')[0];

    // Selector de cuenta filtrado por moneda del concepto
    const cuentasMoneda = (app.cuentas || []).filter(c => (c.moneda || 'ARS') === moneda);
    const opcionesCuenta = cuentasMoneda
        .map(c => `<option value="${c.id}" ${c.id == cuentaDefault ? 'selected' : ''}>${c.nombre}</option>`)
        .join('');
    const cuentaSelectHtml = cuentasMoneda.length > 0
        ? `<select id="cuenta-nuevo-${conceptoId}" class="form-select form-select-sm mt-1" style="font-size:0.72rem">${opcionesCuenta}</select>`
        : '';

    tr.innerHTML = `
        <td class="ps-3" style="width:110px">
            <span class="form-field-label">Fecha</span>
            <input type="date" class="form-control form-control-sm input-vencimiento-detalle"
                id="fecha-nuevo-${conceptoId}" value="${hoy}">
            ${cuentaSelectHtml}
        </td>
        <td>
            <span class="form-field-label">Descripción</span>
            <input type="text" class="form-control form-control-sm"
                id="obs-nuevo-${conceptoId}" placeholder="(opcional)">
        </td>
        <td>
            <span class="form-field-label">Importe ${moneda === 'USD' ? 'U$D' : '$'}</span>
            <div class="det-importe-wrap">
                <input type="number" step="0.01" min="0" class="form-control form-control-sm text-end"
                    id="importe-nuevo-${conceptoId}" placeholder="0.00">
            </div>
        </td>
        <td class="text-end pe-3 align-middle" style="width:50px">
            <button class="btn btn-success btn-sm py-0 px-2"
                title="Agregar"
                onclick="agregarRegistroMultiple(${conceptoId})">
                <i class="bi bi-plus-lg"></i>
            </button>
        </td>
    `;

    // Seleccionar todo al enfocar y guardar con Enter en el campo importe
    const inputImporte = tr.querySelector(`#importe-nuevo-${conceptoId}`);
    inputImporte.addEventListener('focus', () => inputImporte.select());
    inputImporte.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') agregarRegistroMultiple(conceptoId);
    });

    return tr;
}

// Toggle expandir/colapsar detalle (usa DataTables child rows)
function toggleDetalle(conceptoId) {
    const trHeader = document.querySelector(`tr[data-concepto-id="${conceptoId}"]`);
    if (!trHeader) return;

    const arrow = document.getElementById(`arrow-${conceptoId}`);
    const dtInstance = app.dtGastos;
    if (!dtInstance) return;

    const row = dtInstance.row(trHeader);

    if (row.child.isShown()) {
        row.child.hide();
        arrow.classList.replace('bi-chevron-up', 'bi-chevron-down');
    } else {
        row.child(trHeader._detalleNode).show();
        arrow.classList.replace('bi-chevron-down', 'bi-chevron-up');
    }
}

// Agregar nuevo registro a concepto múltiple
async function agregarRegistroMultiple(conceptoId) {
    const fecha = document.getElementById(`fecha-nuevo-${conceptoId}`).value;
    const importeVal = document.getElementById(`importe-nuevo-${conceptoId}`).value;
    const observaciones = document.getElementById(`obs-nuevo-${conceptoId}`).value.trim();

    const importe = parseFloat(importeVal) || 0;

    if (!fecha) {
        mostrarError('Ingresá una fecha.');
        return;
    }
    if (importe <= 0) {
        mostrarError('El importe debe ser mayor a 0.');
        return;
    }

    // Cuenta: primero el selector inline del form, luego cuenta_id_default del concepto
    const cuentaSelectEl = document.getElementById(`cuenta-nuevo-${conceptoId}`);
    const cuentaId = cuentaSelectEl
        ? (parseInt(cuentaSelectEl.value) || null)
        : ((app.datos?.conceptos || []).find(c => c.id == conceptoId)?.cuenta_id_default || null);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                concepto_id: conceptoId,
                mes: app.mesActual,
                anio: app.anioActual,
                fecha,
                importe,
                observaciones: observaciones || null,
                ...(cuentaId ? { cuenta_id: cuentaId } : {})
            })
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast('Registro agregado', 'success');
            await cargarDatos();
            toggleDetalle(conceptoId);
        } else {
            mostrarError('Error al guardar: ' + result.message);
        }
    } catch (error) {
        mostrarError('Error de conexión: ' + error.message);
    }
}

// Eliminar registro individual de concepto múltiple
async function eliminarRegistroMultiple(registroId, conceptoId) {
    if (!confirm('¿Eliminar este registro?')) return;

    try {
        const response = await fetch(API_URL, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registro_id: registroId })
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast('Registro eliminado', 'success');
            await cargarDatos();
            toggleDetalle(conceptoId);
        } else {
            mostrarError('Error al eliminar: ' + result.message);
        }
    } catch (error) {
        mostrarError('Error de conexión: ' + error.message);
    }
}

// Historial de tarifas hora — Personal casas particulares, tareas generales, sin retiro
// Fuente: ARCA (ex-AFIP) — actualizar cuando la CNTCP publique nuevas escalas
const ELENA_TARIFAS = {
    '2025-01': 3089.00,
    '2025-02': 3089.00,
    '2025-03': 3089.00,
    '2025-04': 3089.00,
    '2025-05': 3089.00,
    '2025-06': 3089.00,
    '2025-07': 3229.09,
    '2025-08': 3261.38,
    '2025-09': 3293.99,
    '2025-10': 3293.99,
    '2025-11': 3340.11,
    '2025-12': 3383.53,
    '2026-01': 3494.25,
    '2026-02': 3546.67,
    '2026-03': 3599.87,
    '2026-04': 3599.87
};

// Obtener tarifa hora vigente para un mes/año dado
function getTarifaElena(mes, anio) {
    const claveBuscada = `${anio}-${String(mes).padStart(2, '0')}`;
    const claves = Object.keys(ELENA_TARIFAS).sort();
    let tarifa = null;
    let claveVigente = null;
    for (const clave of claves) {
        if (clave <= claveBuscada) {
            tarifa = ELENA_TARIFAS[clave];
            claveVigente = clave;
        }
    }
    return { tarifa, desde: claveVigente };
}

// Sugerir importe de Elena para el mes/año seleccionado
function sugerirElena(inputElement, btnElement, mes, anio) {
    const { tarifa, desde } = getTarifaElena(mes, anio);

    if (!tarifa) {
        mostrarError(`No hay tarifa registrada para ${obtenerNombreMes(mes)} ${anio}.`);
        return;
    }

    const HORAS_POR_VISITA = 4;
    const total4 = Math.round(tarifa * HORAS_POR_VISITA * 4);
    const total5 = Math.round(tarifa * HORAS_POR_VISITA * 5);

    const [anioDesde, mesDesde] = desde.split('-');
    const refTexto = desde === `${anio}-${String(mes).padStart(2, '0')}`
        ? ''
        : ` (vigente desde ${obtenerNombreMes(parseInt(mesDesde))} ${anioDesde})`;

    const msg =
        `Empleada doméstica — ${obtenerNombreMes(mes)} ${anio}\n` +
        `Tareas generales, sin retiro${refTexto}\n` +
        `Valor hora: ${formatearMoneda(tarifa)}\n\n` +
        `  • 4 semanas (16h): ${formatearMoneda(total4)}\n` +
        `  • 5 semanas (20h): ${formatearMoneda(total5)}\n\n` +
        `¿Usar cálculo de 4 semanas (${formatearMoneda(total4)})?`;

    const confirmar = confirm(msg);

    if (confirmar) {
        inputElement.value = total4;
        inputElement.classList.add('unsaved');
        inputElement.focus();
        inputElement.blur();
    }
}

// Historial de precios Spotify Duo en Argentina (ARS)
// Clave: 'YYYY-MM' — agregar nueva entrada cada vez que Spotify actualice el precio
const SPOTIFY_DUO_PRECIOS = {
    '2026-04': 4399
};

// Obtener el precio de Spotify Duo para un mes/año dado
// Si no existe entrada exacta, usa el precio vigente más reciente anterior a esa fecha
function getPrecioSpotifyDuo(mes, anio) {
    const claveBuscada = `${anio}-${String(mes).padStart(2, '0')}`;
    const claves = Object.keys(SPOTIFY_DUO_PRECIOS).sort();

    let precioVigente = null;
    let claveVigente = null;

    for (const clave of claves) {
        if (clave <= claveBuscada) {
            precioVigente = SPOTIFY_DUO_PRECIOS[clave];
            claveVigente = clave;
        }
    }

    return { precio: precioVigente, desde: claveVigente };
}

// Sugerir precio Spotify Duo para el mes/año seleccionado
function sugerirSpotifyDuo(inputElement, btnElement, mes, anio) {
    const { precio, desde } = getPrecioSpotifyDuo(mes, anio);

    if (!precio) {
        mostrarError(`No hay precio registrado de Spotify Duo para ${obtenerNombreMes(mes)} ${anio}.`);
        return;
    }

    const [anioDesde, mesDesde] = desde.split('-');
    const refTexto = desde === `${anio}-${String(mes).padStart(2, '0')}`
        ? ''
        : ` (vigente desde ${obtenerNombreMes(parseInt(mesDesde))} ${anioDesde})`;

    const confirmar = confirm(
        `Spotify Plan Duo — ${obtenerNombreMes(mes)} ${anio}${refTexto}:\n\n` +
        `${formatearMoneda(precio)}\n\n` +
        `¿Usar este valor?`
    );

    if (confirmar) {
        inputElement.value = precio;
        inputElement.classList.add('unsaved');
        inputElement.focus();
        inputElement.blur();
    }
}

// Precio base YouTube Premium individual en Argentina (USD)
// Verificar en tu cuenta de YouTube si cambia
const YOUTUBE_PREMIUM_USD = 3.19;

// Obtener y cachear cotización del dólar oficial (válido por el día)
async function fetchTipoCambioUSD() {
    const hoy    = new Date().toISOString().split('T')[0];
    const cached = localStorage.getItem('cifra-tc-usd');
    if (cached) {
        try {
            const { fecha, venta } = JSON.parse(cached);
            if (fecha === hoy) { app.tipoCambioUSD = venta; return; }
        } catch (_) {}
    }
    try {
        const resp = await fetch('https://dolarapi.com/v1/dolares/oficial');
        if (!resp.ok) return;
        const data = await resp.json();
        app.tipoCambioUSD = data.venta;
        localStorage.setItem('cifra-tc-usd', JSON.stringify({ fecha: hoy, venta: data.venta }));
    } catch (_) {}
}

// Sugerir precio de YouTube Premium (ahora en USD directamente)
async function sugerirYoutubePremium(inputElement, btnElement) {
    const iconOriginal = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        // Obtener cotización para mostrar equivalente informativo
        await fetchTipoCambioUSD();
        const equiv = app.tipoCambioUSD
            ? `\nEquivalente al dólar oficial: ${formatearMoneda(YOUTUBE_PREMIUM_USD * app.tipoCambioUSD)}`
            : '';

        const confirmar = confirm(
            `YouTube Premium Individual: U$D ${YOUTUBE_PREMIUM_USD}${equiv}\n\n¿Usar este valor?`
        );
        if (confirmar) {
            inputElement.value = String(YOUTUBE_PREMIUM_USD).replace('.', ',');
            inputElement.classList.add('unsaved');
            inputElement.focus();
            inputElement.blur();
        }
    } catch (error) {
        mostrarError('No se pudo obtener la cotización: ' + error.message);
    } finally {
        btnElement.disabled = false;
        btnElement.innerHTML = iconOriginal;
    }
}

// Obtener icono según el concepto
// Retorna { icon, color } — colores de la paleta Cifra
function obtenerIconoConcepto(nombre, tipo) {
    const n = nombre.toLowerCase();

    // ── INGRESOS ──────────────────────────────────────────────
    if (tipo === 'ingreso') {
        if (n.includes('sueldo') || n.includes('salario'))          return { icon: 'bi-briefcase-fill',          color: '#16A34A' };
        if (n.includes('ahorro'))                                   return { icon: 'bi-piggy-bank-fill',          color: '#0891B2' };
        if (n.includes('ipem') || n.includes('jubilacion'))         return { icon: 'bi-mortarboard-fill',         color: '#2563EB' };
        if (n.includes('tcer') || n.includes('hsc'))                return { icon: 'bi-building-fill-check',     color: '#16A34A' };
        return                                                             { icon: 'bi-plus-circle-fill',          color: '#16A34A' };
    }

    // ── VIVIENDA ──────────────────────────────────────────────
    if (n.includes('alquiler') || n.includes('departamento'))       return { icon: 'bi-building',                color: '#2563EB' };

    // ── SUPERMERCADO / COMPRAS ────────────────────────────────
    if (n.includes('supermercado') || n.includes('mercado'))        return { icon: 'bi-cart4',                   color: '#0891B2' };

    // ── COMBUSTIBLE ───────────────────────────────────────────
    if (n.includes('nafta') || n.includes('combustible')
        || n.includes('etios') || n.includes('tornado'))            return { icon: 'bi-fuel-pump-fill',           color: '#D97706' };

    // ── ENERGÍA ELÉCTRICA ─────────────────────────────────────
    if (n.includes('enersa') || n.includes('electric')
        || n.includes('luz'))                                       return { icon: 'bi-lightning-charge-fill',    color: '#FBBF24' };

    // ── GAS ───────────────────────────────────────────────────
    if (n.includes('redengas') || n.includes(' gas'))               return { icon: 'bi-fire',                    color: '#EA580C' };

    // ── DEPORTE / FITNESS ─────────────────────────────────────
    if (n.includes('rowing'))                                       return { icon: 'bi-bicycle',                  color: '#DC2626' };
    if (n.includes('gimnasio') || n.includes('fitness'))            return { icon: 'bi-heart-pulse-fill',         color: '#DB2777' };

    // ── STREAMING / ENTRETENIMIENTO ───────────────────────────
    if (n.includes('youtube'))                                      return { icon: 'bi-youtube',                  color: '#DC2626' };
    if (n.includes('spotify'))                                      return { icon: 'bi-music-note-beamed',        color: '#16A34A' };

    // ── TARJETA DE CRÉDITO ────────────────────────────────────
    if (n.includes('mastercard') || n.includes('visa')
        || n.includes('tarjeta'))                                   return { icon: 'bi-credit-card-2-front-fill', color: '#2563EB' };

    // ── CUOTA ALIMENTARIA / FAMILIA ───────────────────────────
    if (n.includes('alimentaria'))                                  return { icon: 'bi-people-fill',              color: '#0891B2' };

    // ── IMPUESTOS NACIONALES (AFIP) ───────────────────────────
    if (n.includes('afip') || n.includes('monotributo'))            return { icon: 'bi-receipt',                  color: '#6B7280' };

    // ── IMPUESTOS PROVINCIALES (ATER) ─────────────────────────
    if (n.includes('ater'))                                         return { icon: 'bi-file-earmark-text-fill',   color: '#D97706' };

    // ── SEGUROS (RIVADAVIA) ───────────────────────────────────
    if (n.includes('rivadavia') || n.includes('seguro'))            return { icon: 'bi-shield-fill-check',        color: '#2563EB' };

    // ── INTERNET / TELEFONÍA (PERSONAL / FLOW) ────────────────
    if (n.includes('personal') || n.includes('flow')
        || n.includes('internet') || n.includes('wifi'))            return { icon: 'bi-wifi',                     color: '#0891B2' };

    // ── COLEGIO PROFESIONAL (COPROCIER) ──────────────────────
    if (n.includes('coprocier') || n.includes('colegio prof'))      return { icon: 'bi-pc-display-horizontal',   color: '#4F46E5' };

    // ── CRÉDITO / PRÉSTAMO BANCARIO ───────────────────────────
    if (n.includes('credito') || n.includes('prestamo')
        || n.includes('cuota'))                                     return { icon: 'bi-bank2',                    color: '#DC2626' };

    // ── LIMPIEZA / MUCAMA (ELENA) ─────────────────────────────
    if (n.includes('elena') || n.includes('limpieza')
        || n.includes('mucama'))                                    return { icon: 'bi-bucket-fill',              color: '#7C3AED' };

    // ── SALUD / REMEDIOS ──────────────────────────────────────
    if (n.includes('remedios') || n.includes('farmacia')
        || n.includes('medicamento') || n.includes('salud'))        return { icon: 'bi-capsule-pill',             color: '#DB2777' };

    // ── COCHERA / ESTACIONAMIENTO ─────────────────────────────
    if (n.includes('cochera') || n.includes('garage'))              return { icon: 'bi-p-circle-fill',            color: '#6B7280' };

    // ── AIRE ACONDICIONADO ────────────────────────────────────
    if (n.includes('aire') || n.includes('acondicionado'))          return { icon: 'bi-wind',                     color: '#0891B2' };

    // ── HONORARIOS / PROFESIONALES ────────────────────────────
    if (n.includes('roy') || n.includes('udrizar')
        || n.includes('honorario') || n.includes('profesional'))    return { icon: 'bi-person-workspace',         color: '#4F46E5' };

    return { icon: 'bi-cash-stack', color: '#6B7280' };
}

// Guardar importe (conceptos de entrada única)
async function guardarImporte(conceptoId, importe, registroId, inputElement) {
    if (app.guardandoCambios) return;

    // Acepta número directo o string formateado
    const importeNumerico = typeof importe === 'number' ? importe : parsearImporte(importe);

    // No guardar si es 0 y no existe registro
    if (importeNumerico === 0 && !registroId) {
        if (inputElement) {
            inputElement.classList.remove('unsaved', 'saved');
        }
        return;
    }

    app.guardandoCambios = true;

    if (inputElement) {
        inputElement.classList.add('saving');
        inputElement.classList.remove('unsaved');
    }

    // Leer fecha de vencimiento del mismo row (si el usuario la completó)
    const trRow = inputElement?.closest('tr');
    const fechaVencimiento = trRow?.querySelector('.input-vencimiento')?.value || null;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                concepto_id: conceptoId,
                mes: app.mesActual,
                anio: app.anioActual,
                importe: importeNumerico,
                ...(fechaVencimiento ? { fecha_vencimiento: fechaVencimiento } : {})
            })
        });

        const result = await response.json();

        if (result.success) {
            if (inputElement) {
                inputElement.classList.add('saved');
                inputElement.classList.remove('saving');
                setTimeout(() => inputElement.classList.remove('saved'), 2000);
                // Sincronizar data-order del td para sorting de DataTables
                const td = inputElement.closest('td');
                if (td) td.setAttribute('data-order', importeNumerico);
            }
            mostrarToast('Guardado correctamente', 'success');
            await cargarDatos();
        } else {
            mostrarError('Error al guardar: ' + result.message);
            if (inputElement) inputElement.classList.remove('saving');
        }
    } catch (error) {
        mostrarError('Error de conexión: ' + error.message);
        if (inputElement) inputElement.classList.remove('saving');
    } finally {
        app.guardandoCambios = false;
    }
}

// Guardar fecha de vencimiento de un registro
async function guardarVencimiento(registroId, fecha, trElement) {
    try {
        const response = await fetch(API_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registro_id: registroId, fecha_vencimiento: fecha || null })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        const hoy = new Date().toISOString().split('T')[0];
        if (trElement) {
            const isPaid = trElement.classList.contains('tr-pagado');
            const vencido = fecha && fecha < hoy && !isPaid;
            trElement.classList.toggle('tr-vencido', vencido);
        }
    } catch (error) {
        mostrarError('Error al guardar vencimiento: ' + error.message);
    }
}

// Toggle estado pagado de un registro
async function togglePagado(registroId, btnElement, trElement, conceptoId = null) {
    const isPaid       = btnElement.classList.contains('pagado');
    const newPagado    = isPaid ? 0 : 1;
    let registroCreado = false;

    try {
        // Si no hay registro todavía, crear uno con importe 0 antes de patchear
        if (!registroId && conceptoId && newPagado === 1) {
            const respCrear = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concepto_id: conceptoId, mes: app.mesActual, anio: app.anioActual, importe: 0 })
            });
            const resCrear = await respCrear.json();
            if (!resCrear.success) throw new Error(resCrear.message);
            registroId     = resCrear.data.id;
            registroCreado = true;
        }

        const response = await fetch(API_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registro_id: registroId, pagado: newPagado })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        const paid = newPagado === 1;
        btnElement.classList.toggle('pagado', paid);
        btnElement.querySelector('i').className = paid ? 'bi bi-check-circle-fill' : 'bi bi-circle';
        btnElement.title = paid ? 'Marcar como no pagado' : 'Marcar como pagado';
        if (trElement) {
            trElement.classList.toggle('tr-pagado', paid);
            if (paid) trElement.classList.remove('tr-vencido'); // pagado → no mostrar rojo
        }
        // Recargar filas y saldos (re-renderiza input/label según estado pagado)
        await cargarDatos();
    } catch (error) {
        mostrarError('Error al actualizar: ' + error.message);
    }
}

// Formatear moneda — acepta 'ARS' (default) o 'USD'
function formatearMoneda(valor, moneda = 'ARS') {
    if (moneda === 'USD') {
        const num = parseFloat(valor);
        const formatted = Math.abs(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (num < 0 ? '-' : '') + 'U$D\u00A0' + formatted;
    }
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(valor);
}

// Formatear fecha ISO a dd/mm/yy
function formatearFechaCorta(fechaISO) {
    if (!fechaISO) return '';
    const [y, m, d] = fechaISO.split('T')[0].split('-');
    return `${d}/${m}/${y.slice(2)}`;
}

// Obtener nombre del mes
function obtenerNombreMes(numeroMes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[numeroMes - 1];
}

// Toggle sección resumen

function actualizarLabelFiltro() {
    const el = document.getElementById('filtroMesLabel');
    if (el) el.textContent = `${obtenerNombreMes(app.mesActual)} ${app.anioActual}`;
}

function renderizarResumenIngresos() {
    const el = document.getElementById('resumenIngresosDetalle');
    if (!el || !app.datos) return;

    const ingresos = (app.datos.conceptos || []).filter(c => c.tipo === 'ingreso');

    if (!ingresos.length) {
        el.innerHTML = '<div class="px-3 py-2 text-muted small">Sin ingresos registrados</div>';
        return;
    }

    el.innerHTML = ingresos.map(c => {
        const cobrado = c.pagado === 1;
        const imp     = parseFloat(c.importe || 0);
        const moneda  = c.moneda || 'ARS';
        return `
        <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
            <span class="small ${cobrado ? '' : 'text-muted'}">
                <i class="bi ${cobrado ? 'bi-check-circle-fill' : 'bi-circle'} me-1" style="font-size:.75rem;color:${cobrado ? 'var(--cifra-pos)' : 'inherit'}"></i>
                ${c.nombre}
            </span>
            <span class="small fw-medium" style="color:${cobrado ? 'var(--cifra-pos)' : 'var(--bs-secondary-color)'}">${imp > 0 ? formatearMoneda(imp, moneda) : '—'}</span>
        </div>`;
    }).join('');
}

function renderizarResumenPendientes() {
    const el = document.getElementById('resumenPendientes');
    if (!el || !app.datos) return;

    const pendientes = app.datos.conceptos.filter(c =>
        c.tipo === 'gasto' && c.pagado !== 1 && parseFloat(c.importe) > 0
    ).sort((a, b) => parseFloat(b.importe) - parseFloat(a.importe));

    if (!pendientes.length) {
        el.innerHTML = `
            <div class="resumen-pendientes-header">Pendientes de pago</div>
            <div class="resumen-pendientes-vacio">
                <i class="bi bi-check-circle text-success"></i> Todo pagado
            </div>`;
        return;
    }

    const pendientesARS = pendientes.filter(c => (c.moneda || 'ARS') === 'ARS');
    const pendientesUSD = pendientes.filter(c => c.moneda === 'USD');
    const totalARS = pendientesARS.reduce((s, c) => s + parseFloat(c.importe), 0);
    const totalUSD = pendientesUSD.reduce((s, c) => s + parseFloat(c.importe), 0);

    const filasPendiente = (lista, moneda) => lista.map(c => `
        <div class="resumen-pendiente-row">
            <span class="resumen-pendiente-punto" style="background:${c.categoria_color || '#94a3b8'}"></span>
            <span class="resumen-pendiente-nombre">${c.nombre}</span>
            <span class="resumen-pendiente-importe">${formatearMoneda(parseFloat(c.importe), moneda)}</span>
        </div>`).join('');

    const totalUSDHtml = totalUSD > 0 ? `
        <div class="resumen-pendiente-total">
            <span>Total pendiente USD</span>
            <span>${formatearMoneda(totalUSD, 'USD')}</span>
        </div>` : '';

    el.innerHTML = `
        <div class="resumen-pendientes-header">Pendientes de pago</div>
        ${filasPendiente(pendientesARS, 'ARS')}
        ${filasPendiente(pendientesUSD, 'USD')}
        <div class="resumen-pendiente-total">
            <span>Total pendiente ARS</span>
            <span>${formatearMoneda(totalARS)}</span>
        </div>
        ${totalUSDHtml}`;
}

function renderizarResumenCategorias() {
    const el = document.getElementById('resumenCategorias');
    if (!el || !app.datos) return;

    const gastosPorCat = {};
    app.datos.conceptos
        .filter(c => c.tipo === 'gasto' && parseFloat(c.importe) > 0)
        .forEach(c => {
            const key = c.categoria_id || 0;
            if (!gastosPorCat[key]) {
                gastosPorCat[key] = {
                    nombre: c.categoria_nombre || 'Sin categoría',
                    color:  c.categoria_color  || '#94a3b8',
                    icono:  c.categoria_icono   || 'bi-tag',
                    totalARS: 0,
                    totalUSD: 0,
                };
            }
            const m = c.moneda || 'ARS';
            if (m === 'USD') gastosPorCat[key].totalUSD += parseFloat(c.importe);
            else             gastosPorCat[key].totalARS += parseFloat(c.importe);
        });

    const cats = Object.values(gastosPorCat).sort((a, b) => b.totalARS - a.totalARS);
    if (!cats.length) { el.innerHTML = ''; return; }

    const totalGastosARS = cats.reduce((s, c) => s + c.totalARS, 0);

    el.innerHTML = `
        <div class="resumen-cats-header">
            <span>Gastos por categoría</span>
        </div>
        ${cats.map(cat => {
            const pct = totalGastosARS > 0 ? (cat.totalARS / totalGastosARS * 100) : 0;
            const partes = [];
            if (cat.totalARS > 0) partes.push(formatearMoneda(cat.totalARS, 'ARS'));
            if (cat.totalUSD > 0) partes.push(formatearMoneda(cat.totalUSD, 'USD'));
            const importeStr = partes.join(' + ') || '—';
            return `
            <div class="resumen-cat-row">
                <div class="resumen-cat-info">
                    <span class="resumen-cat-dot" style="background:${cat.color}"></span>
                    <span class="resumen-cat-nombre">${cat.nombre}</span>
                </div>
                <div class="resumen-cat-barra-wrap">
                    <div class="resumen-cat-barra" style="width:${pct.toFixed(1)}%;background:${cat.color}"></div>
                </div>
                <div class="resumen-cat-cifras">
                    <span class="resumen-cat-importe">${importeStr}</span>
                    <span class="resumen-cat-pct">${cat.totalARS > 0 ? pct.toFixed(0) + '%' : ''}</span>
                </div>
            </div>`;
        }).join('')}`;
}

function toggleStatsExtra() {
    const extra = document.getElementById('statsExtra');
    const btn = document.getElementById('btnStatsMore');
    const visible = extra.classList.toggle('visible');
    btn.classList.toggle('expanded', visible);
    if (visible) {
        setTimeout(() => {
            document.addEventListener('click', _cerrarStatsExtra, { once: true, capture: true });
        }, 0);
    }
}
function _cerrarStatsExtra(e) {
    const extra = document.getElementById('statsExtra');
    const btn = document.getElementById('btnStatsMore');
    if (extra && !extra.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        extra.classList.remove('visible');
        btn.classList.remove('expanded');
    } else if (extra) {
        // clic dentro del dropdown: re-registrar para cerrarlo después
        document.addEventListener('click', _cerrarStatsExtra, { once: true, capture: true });
    }
}

// ============================================================
// Panel Gerencial
// ============================================================
function abrirModalGerencial() {
    document.getElementById('mesAnioGerencial').textContent =
        `${String(app.mesActual).padStart(2, '0')}/${app.anioActual}`;
    renderizarGerencial();
    new bootstrap.Modal(document.getElementById('modalGerencial')).show();
}

function renderizarGerencial() {
    const body = document.getElementById('modalGerencialBody');
    if (!body || !app.datos) return;

    const resARS = app.datos.resumen?.ARS || { total_ingresos: 0, ingresos_cobrados: 0, total_gastos: 0, gastos_pagados: 0 };
    const resUSD = app.datos.resumen?.USD || { total_ingresos: 0, ingresos_cobrados: 0, total_gastos: 0, gastos_pagados: 0 };

    const cuentasARS     = (app.cuentas || []).filter(c => (c.moneda || 'ARS') === 'ARS');
    const cuentasUSD     = (app.cuentas || []).filter(c => c.moneda === 'USD');
    const totalCtasARS   = cuentasARS.reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0);
    const totalCtasUSD   = cuentasUSD.reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0);

    const pendientesARS  = Math.max(0, resARS.total_gastos - resARS.gastos_pagados);
    const pendientesUSD  = Math.max(0, resUSD.total_gastos - resUSD.gastos_pagados);
    const disponibleARS  = totalCtasARS - pendientesARS;
    const resultadoARS   = resARS.ingresos_cobrados - resARS.gastos_pagados;
    const pctGastos      = resARS.total_gastos > 0 ? Math.min(100, resARS.gastos_pagados / resARS.total_gastos * 100) : 0;
    const pctIngresos    = resARS.total_ingresos > 0 ? Math.min(100, resARS.ingresos_cobrados / resARS.total_ingresos * 100) : 0;
    const cantPend       = app.datos.conceptos.filter(c => c.tipo === 'gasto' && c.pagado !== 1 && parseFloat(c.importe) > 0).length;

    // Semáforo
    let semColor, semLabel;
    if (disponibleARS < 0) {
        semColor = 'var(--color-danger)';  semLabel = 'Saldo insuficiente';
    } else if (pendientesARS > disponibleARS) {
        semColor = 'var(--color-warning)'; semLabel = 'Fondos ajustados';
    } else {
        semColor = 'var(--color-success)'; semLabel = 'Situación sólida';
    }

    // Alertas de vencimiento
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const en7d = new Date(hoy.getTime() + 7 * 86400000);
    const fmtDate = d => { const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y.slice(2)}`; };
    const diasHasta = d => {
        const [y,m,dd] = d.split('-');
        const diff = Math.round((new Date(+y, m-1, +dd) - hoy) / 86400000);
        return diff === 0 ? 'hoy' : diff === 1 ? 'mañana' : `en ${diff}d`;
    };
    const diasDesde = d => {
        const [y,m,dd] = d.split('-');
        const diff = Math.round((hoy - new Date(+y, m-1, +dd)) / 86400000);
        return diff <= 0 ? 'hoy' : diff === 1 ? 'ayer' : `hace ${diff}d`;
    };
    const vencidos = app.datos.conceptos.filter(c => {
        if (c.tipo !== 'gasto' || c.pagado === 1 || !c.fecha_vencimiento) return false;
        const [y,m,dd] = c.fecha_vencimiento.split('-');
        return new Date(+y, m-1, +dd) < hoy;
    }).sort((a, b) => parseFloat(b.importe) - parseFloat(a.importe));
    const proximos = app.datos.conceptos.filter(c => {
        if (c.tipo !== 'gasto' || c.pagado === 1 || !c.fecha_vencimiento) return false;
        const [y,m,dd] = c.fecha_vencimiento.split('-');
        const f = new Date(+y, m-1, +dd);
        return f >= hoy && f <= en7d;
    }).sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));

    // Categorías (solo gastos)
    const catMap = {};
    app.datos.conceptos.filter(c => c.tipo === 'gasto' && parseFloat(c.importe) > 0).forEach(c => {
        const k = c.categoria_id || 0;
        if (!catMap[k]) catMap[k] = {
            nombre: c.categoria_nombre || 'Sin cat.',
            color:  _colorCategoria(c.categoria_color || '#94a3b8'),
            totalARS: 0, totalUSD: 0,
        };
        (c.moneda || 'ARS') === 'USD' ? (catMap[k].totalUSD += parseFloat(c.importe))
                                       : (catMap[k].totalARS += parseFloat(c.importe));
    });
    const cats        = Object.values(catMap).sort((a, b) => b.totalARS - a.totalARS);
    const totalCatARS = cats.reduce((s, c) => s + c.totalARS, 0);

    // ── HTML ──────────────────────────────────────────────────────────
    const resColor   = resultadoARS >= 0 ? 'var(--cifra-pos)' : 'var(--cifra-neg)';
    const dispColor  = disponibleARS >= 0 ? 'var(--cifra-pos)' : 'var(--cifra-neg)';
    const dispBg     = disponibleARS >= 0 ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)';

    // Sección 1 — KPIs
    const kpisHtml = `
    <div class="ger-section">
        <div class="row g-2">
            <div class="col-6 col-md-3">
                <div class="ger-kpi">
                    <div class="ger-kpi-label"><i class="bi bi-arrow-up-circle me-1"></i>Ingresos cobrados</div>
                    <div class="ger-kpi-valor" style="color:var(--cifra-pos)">${formatearMoneda(resARS.ingresos_cobrados)}</div>
                    <div class="ger-prog"><div class="ger-prog-bar" style="width:${pctIngresos.toFixed(1)}%;background:var(--color-success)"></div></div>
                    <div class="ger-kpi-sub">${pctIngresos.toFixed(0)}% de ${formatearMoneda(resARS.total_ingresos)}</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="ger-kpi">
                    <div class="ger-kpi-label"><i class="bi bi-arrow-down-circle me-1"></i>Gastos pagados</div>
                    <div class="ger-kpi-valor" style="color:var(--cifra-neg)">${formatearMoneda(resARS.gastos_pagados)}</div>
                    <div class="ger-prog"><div class="ger-prog-bar" style="width:${pctGastos.toFixed(1)}%;background:var(--color-danger)"></div></div>
                    <div class="ger-kpi-sub">${pctGastos.toFixed(0)}% de ${formatearMoneda(resARS.total_gastos)}</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="ger-kpi">
                    <div class="ger-kpi-label"><i class="bi bi-hourglass-split me-1"></i>Por pagar</div>
                    <div class="ger-kpi-valor" style="color:var(--color-warning)">${formatearMoneda(pendientesARS)}</div>
                    <div class="ger-kpi-sub">${cantPend} concepto${cantPend !== 1 ? 's' : ''} pendiente${cantPend !== 1 ? 's' : ''}</div>
                    ${pendientesUSD > 0 ? `<div class="ger-kpi-sub">${formatearMoneda(pendientesUSD,'USD')}</div>` : ''}
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="ger-kpi">
                    <div class="ger-kpi-label"><i class="bi bi-balance-scale me-1"></i>Resultado neto</div>
                    <div class="ger-kpi-valor" style="color:${resColor}">${resultadoARS >= 0 ? '+' : ''}${formatearMoneda(resultadoARS)}</div>
                    <div class="ger-semaforo">
                        <span class="ger-sem-dot" style="background:${semColor}"></span>
                        <span style="color:${semColor};font-size:0.68rem;font-weight:600">${semLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Sección 2 — Liquidez
    const cuentasRows = (app.cuentas || []).map(c => {
        const m = c.moneda || 'ARS';
        return `<div class="ger-fila">
            <span class="ger-dot" style="background:${c.color || '#6B7280'}"></span>
            <span class="ger-fila-nombre">${c.nombre}</span>
            <span class="ger-fila-valor">${formatearMoneda(c.saldo_actual, m)}</span>
        </div>`;
    }).join('');

    const liquidezHtml = `
    <div class="ger-section">
        <div class="ger-section-title">Liquidez</div>
        ${cuentasRows}
        <div class="ger-totales-block">
            <div class="ger-total-fila">
                <span>Total ARS</span>
                <span>${formatearMoneda(totalCtasARS)}</span>
            </div>
            ${totalCtasUSD > 0 ? `<div class="ger-total-fila">
                <span>Total USD</span>
                <span>${formatearMoneda(totalCtasUSD,'USD')}</span>
            </div>` : ''}
            <div class="ger-total-fila" style="color:var(--color-warning)">
                <span>Pendiente mes</span>
                <span>− ${formatearMoneda(pendientesARS)}</span>
            </div>
        </div>
        <div class="ger-disponible-row" style="background:${dispBg}">
            <span>Disponible real</span>
            <span style="color:${dispColor}">${formatearMoneda(disponibleARS)}</span>
        </div>
    </div>`;

    // Sección 3 — Distribución
    const distribHtml = `
    <div class="ger-section ger-distrib">
        <div class="ger-section-title">Distribución de gastos</div>
        ${cats.length ? cats.map(cat => {
            const pct = totalCatARS > 0 ? cat.totalARS / totalCatARS * 100 : 0;
            const parts = [];
            if (cat.totalARS > 0) parts.push(formatearMoneda(cat.totalARS));
            if (cat.totalUSD > 0) parts.push(formatearMoneda(cat.totalUSD, 'USD'));
            return `<div class="ger-cat-row">
                <span class="ger-dot" style="background:${cat.color}"></span>
                <span class="ger-cat-nombre" title="${cat.nombre}">${cat.nombre}</span>
                <div class="ger-cat-bar-wrap">
                    <div class="ger-cat-bar" style="width:${pct.toFixed(1)}%;background:${cat.color}"></div>
                </div>
                <span class="ger-cat-importe">${parts.join(' + ') || '—'}</span>
                <span class="ger-cat-pct">${pct > 0 ? pct.toFixed(0) + '%' : ''}</span>
            </div>`;
        }).join('') : '<p class="text-muted small mb-0">Sin gastos este período.</p>'}
    </div>`;

    // Sección 4 — Alertas
    let alertasInner = '';
    if (!vencidos.length && !proximos.length) {
        alertasInner = `<div class="ger-ok"><i class="bi bi-check-circle-fill me-2"></i>Sin alertas de vencimiento</div>`;
    } else {
        if (vencidos.length) {
            alertasInner += `<div class="ger-alerta-titulo" style="color:var(--color-danger)">
                <i class="bi bi-exclamation-circle-fill me-1"></i>Vencidos (${vencidos.length})</div>`;
            alertasInner += vencidos.map(c => `<div class="ger-fila">
                <span class="ger-fila-nombre">${c.nombre}</span>
                <span class="ger-fila-valor" style="color:var(--color-danger)">${formatearMoneda(c.importe, c.moneda||'ARS')}</span>
                <span class="ger-fila-meta">${fmtDate(c.fecha_vencimiento)} · ${diasDesde(c.fecha_vencimiento)}</span>
            </div>`).join('');
        }
        if (proximos.length) {
            alertasInner += `<div class="ger-alerta-titulo${vencidos.length ? ' mt-3' : ''}" style="color:var(--color-warning)">
                <i class="bi bi-clock-fill me-1"></i>Próximos 7 días (${proximos.length})</div>`;
            alertasInner += proximos.map(c => `<div class="ger-fila">
                <span class="ger-fila-nombre">${c.nombre}</span>
                <span class="ger-fila-valor" style="color:var(--color-warning)">${formatearMoneda(c.importe, c.moneda||'ARS')}</span>
                <span class="ger-fila-meta">${fmtDate(c.fecha_vencimiento)} · ${diasHasta(c.fecha_vencimiento)}</span>
            </div>`).join('');
        }
    }

    body.innerHTML = kpisHtml
        + `<div class="row g-0 ger-mid-row">
               <div class="col-md-5 ger-col-border">${liquidezHtml}</div>
               <div class="col-md-7">${distribHtml}</div>
           </div>`
        + `<div class="ger-section"><div class="ger-section-title"><i class="bi bi-bell me-1"></i>Alertas</div>${alertasInner}</div>`;
}

function abrirModalResumen() {
    const modal = document.getElementById('modalResumen');
    modal.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el =>
        bootstrap.Tooltip.getOrCreateInstance(el, { trigger: 'hover focus' })
    );
    new bootstrap.Modal(modal).show();
}

function abrirModalCuentas() {
    new bootstrap.Modal(document.getElementById('modalCuentas')).show();
}

function abrirModalIngresos() {
    document.getElementById('mesAnioIngresos').textContent =
        `${String(app.mesActual).padStart(2, '0')}/${app.anioActual}`;
    ocultarFormNuevoIngreso();
    renderizarModalIngresos();
    new bootstrap.Modal(document.getElementById('modalIngresos')).show();
}

function renderizarModalIngresos() {
    const body = document.getElementById('modalIngresosBody');
    if (!body) return;

    const ingresos = (app.datos?.conceptos || []).filter(c => c.tipo === 'ingreso');

    if (!ingresos.length) {
        body.innerHTML = '<p class="text-center text-muted py-4">Sin conceptos de ingreso. Usá "Nuevo ingreso" para agregar.</p>';
        document.getElementById('totalIngresosModal').innerHTML = '';
        return;
    }

    const rows = ingresos.map(c => {
        const isPaid   = c.pagado === 1;
        const fechaVal = c.fecha ? c.fecha.split('T')[0] : '';
        const moneda   = c.moneda || 'ARS';
        const imp      = c.importe > 0 ? formatearMoneda(c.importe, moneda) : '';
        const cuentasOpts = app.cuentas
            .filter(cu => (cu.moneda || 'ARS') === moneda)
            .map(cu => `<option value="${cu.id}">${cu.nombre}</option>`).join('');
        const hasReg   = !!c.registro_id;

        return `
        <div class="ingreso-row ${isPaid ? 'ingreso-row-cobrado' : ''}"
             data-concepto-id="${c.id}"
             data-registro-id="${c.registro_id || ''}">

            <button class="btn-pagado ${isPaid ? 'pagado' : ''}"
                    title="${isPaid ? 'Marcar como no cobrado' : 'Marcar como cobrado'}"
                    onclick="toggleCobradoIngreso(${c.registro_id || 'null'}, ${c.id}, this)">
                <i class="bi ${isPaid ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
            </button>

            <div class="ingreso-body">
                <div class="ingreso-linea1" id="ingreso-nombre-wrap-${c.id}">
                    <span class="ingreso-nombre">${c.nombre}</span>
                    <button class="btn-edit-ingreso" title="Editar concepto"
                            onclick="mostrarEditConceptoIngreso(${c.id})">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <input type="text" inputmode="decimal"
                           class="ingreso-importe input-importe form-control form-control-sm"
                           value="${imp}"
                           data-concepto-id="${c.id}"
                           data-registro-id="${c.registro_id || ''}"
                           placeholder="0,00"
                           onfocus="const v=parsearImporte(this.value);this.value=v>0?String(v).replace('.',','):'';this.select()"
                           onblur="guardarImporteIngreso(this)"
                           onkeypress="if(event.key==='Enter')this.blur()"
                           oninput="this.classList.add('unsaved');this.classList.remove('saved')">
                </div>
                <div class="ingreso-linea2">
                    <select class="ingreso-cuenta form-select form-select-sm"
                            data-cuenta-actual="${c.cuenta_id || ''}"
                            ${!hasReg ? 'disabled' : `onchange="guardarCuentaRegistro(${c.registro_id}, this.value || null)"`}>
                        <option value="">— Cuenta —</option>
                        ${cuentasOpts}
                    </select>
                    <input type="date" class="ingreso-fecha form-control form-control-sm"
                           value="${fechaVal}"
                           ${!hasReg ? 'disabled title="Ingresá el importe primero"' : `onchange="guardarFechaIngreso(${c.registro_id}, this.value, this)"`}>
                </div>
            </div>
        </div>`;
    }).join('');

    body.innerHTML = `<div class="ingreso-lista">${rows}</div>`;

    // Setear valor del select de cuenta (no se puede en template string directamente)
    ingresos.forEach(c => {
        if (!c.cuenta_id) return;
        const row = body.querySelector(`[data-concepto-id="${c.id}"]`);
        if (row) {
            const sel = row.querySelector('.ingreso-cuenta');
            if (sel) sel.value = c.cuenta_id;
        }
    });

    // Totales
    const total    = ingresos.reduce((s, c) => s + parseFloat(c.importe || 0), 0);
    const cobrado  = ingresos.filter(c => c.pagado === 1).reduce((s, c) => s + parseFloat(c.importe || 0), 0);
    const pendiente = total - cobrado;

    const tooltips = [
        { label: 'Total',     valor: total,     cls: '',           title: 'Suma de todos los ingresos del mes, cobrados o no' },
        { label: 'Cobrado',   valor: cobrado,   cls: 'cifra-pos-text', title: 'Ingresos ya recibidos (marcados con ✓)' },
        { label: 'Pendiente', valor: pendiente, cls: 'text-muted', title: 'Ingresos que todavía no cobraste' },
    ];

    const container = document.getElementById('totalIngresosModal');
    container.innerHTML = tooltips.map(t => `
        <div class="ingreso-total-item">
            <span class="ingreso-total-label">
                ${t.label}
                <i class="bi bi-info-circle ingreso-total-info"
                   data-bs-toggle="tooltip"
                   data-bs-placement="top"
                   data-bs-title="${t.title}"></i>
            </span>
            <span class="ingreso-total-valor ${t.cls}">${formatearMoneda(t.valor)}</span>
        </div>`).join('');

    container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el =>
        new bootstrap.Tooltip(el, { trigger: 'hover focus' })
    );
}

async function toggleCobradoIngreso(registroId, conceptoId, btn) {
    const isPaid   = btn.classList.contains('pagado');
    const newPagado = isPaid ? 0 : 1;

    // Si no hay registro, crear uno vacío primero
    if (!registroId && newPagado === 1) {
        const r = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concepto_id: conceptoId, mes: app.mesActual, anio: app.anioActual, importe: 0 })
        });
        const res = await r.json();
        if (!res.success) { mostrarError(res.message); return; }
        registroId = res.data.id;
    }
    if (!registroId) return;

    try {
        const resp = await fetch(API_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registro_id: registroId, pagado: newPagado })
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);
        await cargarDatos(); // re-renderiza el modal vía renderizarDatos()
    } catch (e) {
        mostrarError('Error: ' + e.message);
    }
}

async function guardarFechaIngreso(registroId, valor, input) {
    if (!registroId) return;
    try {
        const resp = await fetch(API_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registro_id: registroId, fecha: valor || null })
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);
        // Actualizar en memoria
        const c = app.datos?.conceptos?.find(c => c.registro_id == registroId);
        if (c) c.fecha = valor;
    } catch (e) {
        mostrarError('Error al guardar fecha: ' + e.message);
        if (input) input.classList.add('is-invalid');
    }
}

async function guardarImporteIngreso(input) {
    const importe    = parsearImporte(input.value);
    input.value      = importe > 0 ? formatearMoneda(importe) : '';
    const conceptoId = parseInt(input.dataset.conceptoId);
    const registroId = input.dataset.registroId ? parseInt(input.dataset.registroId) : null;
    // guardarImporte ya llama cargarDatos(), que re-renderiza el modal si está abierto
    await guardarImporte(conceptoId, importe, registroId, input);
}

function mostrarEditConceptoIngreso(conceptoId) {
    const wrap = document.getElementById(`ingreso-nombre-wrap-${conceptoId}`);
    if (!wrap) return;

    const concepto = app.datos?.conceptos?.find(c => c.id == conceptoId);
    if (!concepto) return;

    const cuentasOpts = [
        '<option value="">— Sin cuenta —</option>',
        ...app.cuentas.map(cu =>
            `<option value="${cu.id}">${cu.nombre}</option>`)
    ].join('');

    wrap.innerHTML = `
        <div class="ingreso-edit-form">
            <input type="text" class="form-control form-control-sm" style="max-width:160px"
                   id="edit-ing-nombre-${conceptoId}" value="${concepto.nombre}">
            <select class="form-select form-select-sm" style="max-width:130px"
                    id="edit-ing-cuenta-${conceptoId}">
                ${cuentasOpts}
            </select>
            <button class="btn btn-success btn-sm" onclick="guardarEditConceptoIngreso(${conceptoId})">
                <i class="bi bi-check-lg"></i>
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="renderizarModalIngresos()">
                <i class="bi bi-x-lg"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" title="Desactivar concepto"
                    onclick="toggleActivoConcepto(${conceptoId}, 0).then(()=>cargarDatos())">
                <i class="bi bi-eye-slash"></i>
            </button>
        </div>`;

    // Preseleccionar cuenta por defecto actual
    const selCuenta = document.getElementById(`edit-ing-cuenta-${conceptoId}`);
    if (selCuenta && concepto.cuenta_id_default) selCuenta.value = concepto.cuenta_id_default;
}

async function guardarEditConceptoIngreso(conceptoId) {
    const nombre    = document.getElementById(`edit-ing-nombre-${conceptoId}`)?.value?.trim();
    const cuentaDef = document.getElementById(`edit-ing-cuenta-${conceptoId}`)?.value || null;
    if (!nombre) { mostrarError('El nombre no puede estar vacío'); return; }

    try {
        const resp = await fetch(CONCEPTOS_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: conceptoId, nombre, cuenta_id_default: cuentaDef || null })
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);
        mostrarToast('Concepto actualizado', 'success');
        await cargarDatos(); // re-renderiza todo
    } catch (e) {
        mostrarError('Error: ' + e.message);
    }
}

function mostrarFormNuevoIngreso() {
    const form = document.getElementById('formNuevoIngreso');
    form.classList.remove('d-none');

    // Poblar select de cuentas
    const sel = document.getElementById('nuevoIngresoCuenta');
    sel.innerHTML = '<option value="">— Sin cuenta —</option>' +
        app.cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    document.getElementById('nuevoIngresoNombre').value  = '';
    document.getElementById('nuevoIngresoImporte').value = '';
    document.getElementById('nuevoIngresoNombre').focus();
}

function ocultarFormNuevoIngreso() {
    document.getElementById('formNuevoIngreso')?.classList.add('d-none');
}

async function guardarNuevoIngreso() {
    const nombre   = document.getElementById('nuevoIngresoNombre').value.trim();
    const cuentaDef = document.getElementById('nuevoIngresoCuenta').value || null;
    const importeStr = document.getElementById('nuevoIngresoImporte').value;
    const importe  = parsearImporte(importeStr);

    if (!nombre) { mostrarError('El nombre es obligatorio'); return; }

    try {
        // 1. Crear concepto
        const respC = await fetch(CONCEPTOS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, tipo: 'ingreso', cuenta_id_default: cuentaDef || null })
        });
        const resC = await respC.json();
        if (!resC.success) throw new Error(resC.message);
        const nuevoConceptoId = resC.data?.id;

        // 2. Crear registro del mes si hay importe
        if (nuevoConceptoId && importe > 0) {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    concepto_id: nuevoConceptoId,
                    mes: app.mesActual,
                    anio: app.anioActual,
                    importe
                })
            });
        }

        ocultarFormNuevoIngreso();
        mostrarToast(`"${nombre}" agregado`, 'success');
        await cargarDatos();
    } catch (e) {
        mostrarError('Error: ' + e.message);
    }
}

function abrirModalVencimientos() {
    new bootstrap.Modal(document.getElementById('modalVencimientos')).show();
}

// Mostrar loading
function mostrarLoading() {
    document.getElementById('loading').classList.remove('d-none');
    document.getElementById('contenidoPrincipal').classList.add('d-none');
}

// Ocultar loading
function ocultarLoading() {
    document.getElementById('loading').classList.add('d-none');
    document.getElementById('contenidoPrincipal').classList.remove('d-none');
}

// Mostrar error
function mostrarError(mensaje) {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

// ============================================================
// ABM Conceptos
// ============================================================

const CONCEPTOS_API_URL = 'api/conceptos_api.php';
const CATEGORIAS_API_URL = 'api/categorias_api.php';

async function abrirModalConceptos() {
    const modal = new bootstrap.Modal(document.getElementById('modalConceptos'));
    modal.show();
    await Promise.all([cargarConceptosModal(), cargarCategoriasModal()]);
}

async function cargarConceptosModal() {
    try {
        const [respConceptos, respCategorias] = await Promise.all([
            fetch(CONCEPTOS_API_URL),
            fetch(CATEGORIAS_API_URL)
        ]);
        const resC   = await respConceptos.json();
        const resCat = await respCategorias.json();
        if (!resC.success) throw new Error(resC.message);

        app.categorias = resCat.success ? resCat.data : [];

        const gastos = resC.data.filter(c => c.tipo === 'gasto');
        renderizarListaConceptos('listaGastos', gastos);
        poblarSelectCategorias();
    } catch (error) {
        mostrarError('Error al cargar conceptos: ' + error.message);
    }
}

// Poblar todos los <select> de categorías con la lista actual de app.categorias
function poblarSelectCategorias() {
    const opciones = ['<option value="">— Sin categoría —</option>',
        ...app.categorias.map(c =>
            `<option value="${c.id}" style="color:${c.color}">${c.icono ? '● ' : ''}${c.nombre}</option>`
        )
    ].join('');

    ['nuevoCategoria'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { const val = el.value; el.innerHTML = opciones; el.value = val; }
    });

    // También los selects de edición inline (edit-categoria-N)
    document.querySelectorAll('[id^="edit-categoria-"]').forEach(el => {
        const val = el.value;
        el.innerHTML = opciones;
        el.value = val;
    });
}

function renderizarListaConceptos(containerId, conceptos) {
    const container = document.getElementById(containerId);
    if (conceptos.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-2">Sin conceptos.</p>';
        return;
    }

    const opcionesCat = ['<option value="">— Sin cat. —</option>',
        ...app.categorias.map(cat =>
            `<option value="${cat.id}">${cat.nombre}</option>`
        )
    ].join('');

    const lista = document.createElement('div');
    lista.className = 'concepto-lista';

    conceptos.forEach(c => {
        const activo     = c.activo == 1;
        const multiples  = c.permite_multiples == 1;
        const esUSD      = (c.moneda || 'ARS') === 'USD';
        const catBadge   = c.categoria_id
            ? `<span class="badge rounded-pill" style="background:${c.categoria_color};color:#fff;font-size:0.68rem">${c.categoria_nombre}</span>`
            : '';

        const item = document.createElement('div');
        item.className = 'concepto-item';
        item.id = `fila-concepto-${c.id}`;

        item.innerHTML = `
            <!-- Vista lectura -->
            <div class="concepto-ver">
                <div class="concepto-ver-main">
                    <span class="concepto-ver-nombre ${!activo ? 'text-muted text-decoration-line-through' : ''}">${c.nombre}</span>
                    <div class="concepto-ver-meta">
                        ${catBadge}
                        <span class="concepto-meta-chip">Ord: ${c.orden}</span>
                        <span class="badge ${multiples ? 'bg-info' : 'bg-secondary bg-opacity-25 text-secondary border'}" style="font-size:0.68rem">
                            ${multiples ? 'Multi' : 'Único'}
                        </span>
                        <span class="badge ${esUSD ? 'text-bg-warning' : 'bg-secondary bg-opacity-25 text-secondary border'}" style="font-size:0.68rem">
                            ${esUSD ? 'USD' : 'ARS'}
                        </span>
                        <span class="badge ${activo ? 'bg-success' : 'bg-secondary'}" style="font-size:0.68rem">
                            ${activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                </div>
                <div class="concepto-ver-btns">
                    <button class="btn btn-outline-primary btn-sm" title="Editar" onclick="editarConcepto(${c.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn ${activo ? 'btn-outline-warning' : 'btn-outline-success'} btn-sm"
                        title="${activo ? 'Desactivar' : 'Activar'}"
                        onclick="toggleActivoConcepto(${c.id}, ${activo ? 0 : 1})">
                        <i class="bi ${activo ? 'bi-eye-slash' : 'bi-eye'}"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" title="Eliminar"
                        onclick="eliminarConcepto(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>

            <!-- Vista edición -->
            <div class="concepto-edit d-none">
                <div class="row g-2 align-items-end">
                    <div class="col-12 col-sm-4">
                        <label class="form-label form-label-sm mb-1">Nombre</label>
                        <input type="text" class="form-control form-control-sm"
                            id="edit-nombre-${c.id}" value="${c.nombre}">
                    </div>
                    <div class="col-8 col-sm-3">
                        <label class="form-label form-label-sm mb-1">Categoría</label>
                        <select class="form-select form-select-sm" id="edit-categoria-${c.id}">
                            ${opcionesCat}
                        </select>
                    </div>
                    <div class="col-4 col-sm-2">
                        <label class="form-label form-label-sm mb-1">Orden</label>
                        <input type="number" class="form-control form-control-sm text-center"
                            id="edit-orden-${c.id}" value="${c.orden}" min="1">
                    </div>
                    <div class="col-6 col-sm-1 d-flex flex-column align-items-center">
                        <label class="form-label form-label-sm mb-1">Multi</label>
                        <div class="form-check form-switch mb-0">
                            <input class="form-check-input" type="checkbox" role="switch"
                                id="edit-multiples-${c.id}" ${multiples ? 'checked' : ''}>
                        </div>
                    </div>
                    <div class="col-6 col-sm-1">
                        <label class="form-label form-label-sm mb-1">Moneda</label>
                        <select class="form-select form-select-sm" id="edit-moneda-${c.id}"
                                onchange="actualizarCtaDefEdit(${c.id})">
                            <option value="ARS" ${!esUSD ? 'selected' : ''}>ARS</option>
                            <option value="USD" ${esUSD ? 'selected' : ''}>USD</option>
                        </select>
                    </div>
                    <div class="col-6 col-sm-2">
                        <label class="form-label form-label-sm mb-1">Cuenta default</label>
                        <select class="form-select form-select-sm" id="edit-cuentadef-${c.id}"></select>
                    </div>
                    <div class="col-6 col-sm-2 d-flex gap-1 justify-content-end align-items-end">
                        <button class="btn btn-success btn-sm flex-fill" onclick="guardarEdicionConcepto(${c.id})">
                            <i class="bi bi-check-lg"></i> Guardar
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="cancelarEdicionConcepto(${c.id})">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        if (c.categoria_id) {
            const sel = item.querySelector(`#edit-categoria-${c.id}`);
            if (sel) sel.value = c.categoria_id;
        }

        // Poblar cuentas filtradas por moneda del concepto
        const selCtaDef = item.querySelector(`#edit-cuentadef-${c.id}`);
        if (selCtaDef) {
            const mon = c.moneda || 'ARS';
            selCtaDef.innerHTML = '<option value="">— Sin cuenta —</option>' +
                (app.cuentas || []).filter(cu => (cu.moneda || 'ARS') === mon)
                    .map(cu => `<option value="${cu.id}">${cu.nombre}</option>`).join('');
            if (c.cuenta_id_default) selCtaDef.value = c.cuenta_id_default;
        }

        lista.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(lista);
}

function editarConcepto(id) {
    const fila = document.getElementById(`fila-concepto-${id}`);
    fila.querySelector('.concepto-ver').classList.add('d-none');
    fila.querySelector('.concepto-edit').classList.remove('d-none');
    document.getElementById(`edit-nombre-${id}`).focus();
}

function cancelarEdicionConcepto(id) {
    const fila = document.getElementById(`fila-concepto-${id}`);
    fila.querySelector('.concepto-ver').classList.remove('d-none');
    fila.querySelector('.concepto-edit').classList.add('d-none');
}

async function guardarEdicionConcepto(id) {
    const nombre = document.getElementById(`edit-nombre-${id}`).value.trim();
    const orden  = document.getElementById(`edit-orden-${id}`).value;
    const permite_multiples = document.getElementById(`edit-multiples-${id}`).checked ? 1 : 0;
    const catEl  = document.getElementById(`edit-categoria-${id}`);
    const categoria_id = catEl && catEl.value !== '' ? parseInt(catEl.value) : null;
    const moneda = document.getElementById(`edit-moneda-${id}`)?.value || 'ARS';
    const ctaDef = document.getElementById(`edit-cuentadef-${id}`)?.value || null;

    if (!nombre) {
        mostrarError('El nombre no puede estar vacío.');
        return;
    }

    try {
        const response = await fetch(CONCEPTOS_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, nombre, orden, permite_multiples, categoria_id, moneda, cuenta_id_default: ctaDef || null })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast('Concepto actualizado', 'success');
        await cargarConceptosModal();
        await cargarDatos();
    } catch (error) {
        mostrarError('Error al guardar: ' + error.message);
    }
}

async function toggleActivoConcepto(id, nuevoActivo) {
    const accion = nuevoActivo ? 'activar' : 'desactivar';
    if (!confirm(`¿Seguro que querés ${accion} este concepto?`)) return;

    try {
        const response = await fetch(CONCEPTOS_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, activo: nuevoActivo })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast(`Concepto ${nuevoActivo ? 'activado' : 'desactivado'}`, 'success');
        await cargarConceptosModal();
        await cargarDatos();
    } catch (error) {
        mostrarError('Error: ' + error.message);
    }
}

async function eliminarConcepto(id, nombre) {
    if (!confirm(`¿Eliminar el concepto "${nombre}"?\n\nSolo es posible si el importe está en 0 en todos los meses.`)) return;

    try {
        const response = await fetch(CONCEPTOS_API_URL, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const result = await response.json();
        if (!result.success) {
            mostrarError(result.message);
            return;
        }

        mostrarToast('Concepto eliminado', 'success');
        await cargarConceptosModal();
        await cargarDatos();
    } catch (error) {
        mostrarError('Error al eliminar: ' + error.message);
    }
}

function actualizarCtaDefNuevo() {
    const moneda = document.getElementById('nuevoMoneda')?.value || 'ARS';
    const sel = document.getElementById('nuevoCtaDef');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Sin cuenta —</option>' +
        (app.cuentas || []).filter(c => (c.moneda || 'ARS') === moneda)
            .map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function actualizarCtaDefEdit(id) {
    const moneda = document.getElementById(`edit-moneda-${id}`)?.value || 'ARS';
    const sel = document.getElementById(`edit-cuentadef-${id}`);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">— Sin cuenta —</option>' +
        (app.cuentas || []).filter(c => (c.moneda || 'ARS') === moneda)
            .map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    sel.value = prev;
}

function mostrarFormNuevo(tipo) {
    const form = document.getElementById('formNuevoConcepto');
    document.getElementById('nuevoTipo').value = tipo;
    document.getElementById('nuevoNombre').value = '';
    document.getElementById('nuevoOrden').value = '';
    document.getElementById('nuevoPermiteMultiples').checked = false;
    document.getElementById('nuevoCategoria').value = '';
    document.getElementById('nuevoMoneda').value = 'ARS';
    actualizarCtaDefNuevo();
    form.classList.remove('d-none');
    document.getElementById('nuevoNombre').focus();
}

function cancelarNuevoConcepto() {
    document.getElementById('formNuevoConcepto').classList.add('d-none');
}

async function guardarNuevoConcepto() {
    const nombre = document.getElementById('nuevoNombre').value.trim();
    const tipo   = document.getElementById('nuevoTipo').value;
    const orden  = document.getElementById('nuevoOrden').value;
    const permite_multiples = document.getElementById('nuevoPermiteMultiples').checked ? 1 : 0;
    const catVal = document.getElementById('nuevoCategoria').value;
    const categoria_id = catVal !== '' ? parseInt(catVal) : null;
    const moneda = document.getElementById('nuevoMoneda')?.value || 'ARS';
    const ctaDef = document.getElementById('nuevoCtaDef')?.value || null;

    if (!nombre) {
        mostrarError('El nombre no puede estar vacío.');
        return;
    }

    try {
        const response = await fetch(CONCEPTOS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, tipo, orden: orden || undefined, permite_multiples, categoria_id, moneda, cuenta_id_default: ctaDef || null })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast('Concepto creado correctamente', 'success');
        cancelarNuevoConcepto();
        await cargarConceptosModal();
        await cargarDatos();

        const tabBtn = document.getElementById('tab-gastos-btn');
        if (tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
    } catch (error) {
        mostrarError('Error al crear: ' + error.message);
    }
}

// ============================================================
// ABM Categorías
// ============================================================

async function cargarCategoriasModal() {
    try {
        const response = await fetch(CATEGORIAS_API_URL);
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        app.categorias = result.data;
        renderizarListaCategorias(result.data);
        poblarSelectCategorias();
    } catch (error) {
        mostrarError('Error al cargar categorías: ' + error.message);
    }
}

function renderizarListaCategorias(categorias) {
    const container = document.getElementById('listaCategorias');
    if (!container) return;

    if (categorias.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-2">Sin categorías. Creá la primera.</p>';
        return;
    }

    const tabla = document.createElement('table');
    tabla.className = 'table table-sm table-hover align-middle mb-0';
    tabla.innerHTML = `
        <thead class="table-light">
            <tr>
                <th style="width:44px"></th>
                <th>Nombre</th>
                <th class="text-center" style="width:60px">Orden</th>
                <th style="width:80px"></th>
            </tr>
        </thead>
        <tbody id="tbody-categorias"></tbody>
    `;

    const tbody = tabla.querySelector('tbody');
    let draggingEl = null;

    categorias.forEach(cat => {
        const tr = document.createElement('tr');
        tr.id = `fila-categoria-${cat.id}`;
        tr.dataset.catId = cat.id;
        tr.draggable = true;
        tr.innerHTML = `
            <td style="vertical-align:middle">
                <span class="cat-drag-handle" title="Arrastrar para reordenar"><i class="bi bi-grip-vertical"></i></span>
                <span class="categoria-dot d-inline-block ms-1" style="background:${cat.color}; width:10px; height:10px; border-radius:50%; vertical-align:middle"></span>
            </td>
            <td colspan="2">
                <span class="cat-nombre-texto d-flex justify-content-between align-items-center">
                    <span>
                        ${cat.icono ? `<i class="bi ${cat.icono} me-1" style="color:${cat.color}"></i>` : ''}
                        ${cat.nombre}
                    </span>
                    <span class="cat-orden-texto text-muted small me-1">${cat.orden}</span>
                </span>
                <div class="cat-nombre-edit d-none d-flex flex-wrap gap-1 align-items-center">
                    <input type="color" id="edit-cat-color-${cat.id}" class="form-control form-control-sm form-control-color flex-shrink-0" style="width:32px;padding:2px" value="${cat.color}">
                    <input type="text" id="edit-cat-nombre-${cat.id}" class="form-control form-control-sm flex-grow-1" style="min-width:80px" value="${cat.nombre}">
                    <input type="text" id="edit-cat-icono-${cat.id}" class="form-control form-control-sm flex-shrink-0" style="width:90px" placeholder="bi-house-fill" value="${cat.icono || ''}">
                    <input type="number" id="edit-cat-orden-${cat.id}" class="form-control form-control-sm text-center flex-shrink-0" style="width:50px" value="${cat.orden}" min="1">
                    <button class="btn btn-success btn-sm flex-shrink-0" onclick="guardarEdicionCategoria(${cat.id})"><i class="bi bi-check-lg"></i></button>
                    <button class="btn btn-outline-secondary btn-sm flex-shrink-0" onclick="cancelarEdicionCategoria(${cat.id})"><i class="bi bi-x-lg"></i></button>
                </div>
            </td>
            <td class="text-end" style="vertical-align:middle">
                <div class="cat-acciones-ver d-flex gap-1 justify-content-end">
                    <button class="btn btn-outline-primary btn-sm" title="Editar" onclick="editarCategoria(${cat.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" title="Eliminar" onclick="eliminarCategoria(${cat.id}, '${cat.nombre.replace(/'/g, "\\'")}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;

        tr.addEventListener('dragstart', (e) => {
            draggingEl = tr;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => tr.classList.add('cat-dragging'), 0);
        });

        tr.addEventListener('dragend', () => {
            tr.classList.remove('cat-dragging');
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('cat-drag-over-top', 'cat-drag-over-bottom'));
            draggingEl = null;
        });

        tr.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!draggingEl || draggingEl === tr) return;
            const mid = tr.getBoundingClientRect().top + tr.getBoundingClientRect().height / 2;
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('cat-drag-over-top', 'cat-drag-over-bottom'));
            tr.classList.add(e.clientY < mid ? 'cat-drag-over-top' : 'cat-drag-over-bottom');
        });

        tr.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (!draggingEl || draggingEl === tr) return;
            const mid = tr.getBoundingClientRect().top + tr.getBoundingClientRect().height / 2;
            tbody.insertBefore(draggingEl, e.clientY < mid ? tr : tr.nextSibling);
            tr.classList.remove('cat-drag-over-top', 'cat-drag-over-bottom');
            await guardarOrdenCategorias(tbody);
        });

        tbody.appendChild(tr);
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive';
    wrapper.appendChild(tabla);
    container.innerHTML = '';
    container.appendChild(wrapper);
}

async function guardarOrdenCategorias(tbody) {
    const rows = Array.from(tbody.querySelectorAll('tr[data-cat-id]'));
    const updates = rows.map((tr, i) => ({ id: parseInt(tr.dataset.catId), orden: i + 1 }));

    // Actualizar visualmente los números de orden
    updates.forEach(({ id, orden }) => {
        const span = document.querySelector(`#fila-categoria-${id} .cat-orden-texto`);
        if (span) span.textContent = orden;
    });

    try {
        await Promise.all(updates.map(({ id, orden }) =>
            fetch(CATEGORIAS_API_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, orden })
            })
        ));
        mostrarToast('Orden guardado', 'success');
        await cargarDatos();
    } catch (error) {
        mostrarError('Error al guardar orden: ' + error.message);
    }
}

function mostrarFormNuevaCategoria() {
    document.getElementById('catNombre').value = '';
    document.getElementById('catColor').value  = '#2563EB';
    document.getElementById('catIcono').value  = '';
    document.getElementById('catOrden').value  = '';
    document.getElementById('formNuevaCategoria').classList.remove('d-none');
    document.getElementById('catNombre').focus();
}

function cancelarNuevaCategoria() {
    document.getElementById('formNuevaCategoria').classList.add('d-none');
}

async function guardarNuevaCategoria() {
    const nombre = document.getElementById('catNombre').value.trim();
    const color  = document.getElementById('catColor').value;
    const icono  = document.getElementById('catIcono').value.trim();
    const orden  = document.getElementById('catOrden').value;

    if (!nombre) {
        mostrarError('El nombre de la categoría no puede estar vacío.');
        return;
    }

    try {
        const response = await fetch(CATEGORIAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, color, icono: icono || '', orden: orden || undefined })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast('Categoría creada', 'success');
        cancelarNuevaCategoria();
        await cargarCategoriasModal();
    } catch (error) {
        mostrarError('Error al crear categoría: ' + error.message);
    }
}

function editarCategoria(id) {
    const fila = document.getElementById(`fila-categoria-${id}`);
    fila.querySelectorAll('.cat-nombre-texto, .cat-acciones-ver').forEach(el => el.classList.add('d-none'));
    fila.querySelector('.cat-nombre-edit').classList.remove('d-none');
    document.getElementById(`edit-cat-nombre-${id}`).focus();
}

function cancelarEdicionCategoria(id) {
    const fila = document.getElementById(`fila-categoria-${id}`);
    fila.querySelectorAll('.cat-nombre-texto, .cat-acciones-ver').forEach(el => el.classList.remove('d-none'));
    fila.querySelector('.cat-nombre-edit').classList.add('d-none');
}

async function guardarEdicionCategoria(id) {
    const nombre = document.getElementById(`edit-cat-nombre-${id}`).value.trim();
    const color  = document.getElementById(`edit-cat-color-${id}`).value;
    const icono  = document.getElementById(`edit-cat-icono-${id}`).value.trim();
    const orden  = document.getElementById(`edit-cat-orden-${id}`).value;

    if (!nombre) {
        mostrarError('El nombre no puede estar vacío.');
        return;
    }

    try {
        const response = await fetch(CATEGORIAS_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, nombre, color, icono, orden: parseInt(orden) || 0 })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast('Categoría actualizada', 'success');
        await cargarCategoriasModal();
        await cargarDatos();
    } catch (error) {
        mostrarError('Error al guardar: ' + error.message);
    }
}

async function eliminarCategoria(id, nombre) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?\nLos conceptos asociados quedarán sin categoría.`)) return;

    try {
        const response = await fetch(CATEGORIAS_API_URL, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast('Categoría eliminada', 'success');
        await cargarCategoriasModal();
        await cargarDatos();
    } catch (error) {
        mostrarError('Error al eliminar: ' + error.message);
    }
}

// ============================================================
// Cuentas bancarias
// ============================================================

function crearSelectorCuenta(registroId, cuentaId, moneda = 'ARS') {
    const wrap = document.createElement('div');
    wrap.className = 'cuenta-wrap';

    const dot = document.createElement('span');
    dot.className = 'cuenta-dot';
    const cuentaActual = app.cuentas.find(c => c.id == cuentaId);
    dot.style.background = cuentaActual ? cuentaActual.color : '#d1d5db';

    const sel = document.createElement('select');
    sel.className = 'cuenta-select';

    const optNone = new Option('Cuenta…', '');
    sel.appendChild(optNone);
    // Solo mostrar cuentas de la misma moneda que el concepto
    app.cuentas.filter(c => (c.moneda || 'ARS') === moneda).forEach(c => {
        const opt = new Option(c.nombre, c.id);
        if (c.id == cuentaId) opt.selected = true;
        sel.appendChild(opt);
    });

    sel.addEventListener('change', async () => {
        const nuevaId = sel.value ? parseInt(sel.value) : null;
        const nuevaCuenta = app.cuentas.find(c => c.id == nuevaId);
        dot.style.background = nuevaCuenta ? nuevaCuenta.color : '#d1d5db';
        await guardarCuentaRegistro(registroId, nuevaId);
    });

    wrap.appendChild(dot);
    wrap.appendChild(sel);
    return wrap;
}

async function guardarCuentaRegistro(registroId, cuentaId) {
    try {
        const response = await fetch(API_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registro_id: registroId, cuenta_id: cuentaId })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        // Actualizar app.datos en memoria para que el modal no revierta la selección
        if (app.datos?.conceptos) {
            const c = app.datos.conceptos.find(c => c.registro_id == registroId);
            if (c) c.cuenta_id = cuentaId ? parseInt(cuentaId) : null;
        }
        mostrarToast('Cuenta guardada', 'success');
        await cargarCuentas();
    } catch (error) {
        mostrarError('Error al guardar cuenta: ' + error.message);
    }
}

async function cargarCuentas() {
    try {
        const resp = await fetch(`api/cuentas_api.php?mes=${app.mesActual}&anio=${app.anioActual}`);
        const result = await resp.json();
        if (result.success) {
            app.cuentas = result.data;
            renderizarCuentas();
            renderizarCardCuentasHome();
        }
    } catch (_) {}
}

function renderizarCardCuentasHome() {
    const el = document.getElementById('totalCuentasTopbar');
    if (!el || !app.cuentas || !app.cuentas.length) return;
    const totalARS = app.cuentas.filter(c => (c.moneda || 'ARS') === 'ARS').reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0);
    el.textContent = formatearMoneda(totalARS);
}

function renderizarCuentas() {
    const contenedor = document.getElementById('cardCuentas');
    if (!contenedor) return;
    if (!app.cuentas || app.cuentas.length === 0) {
        contenedor.innerHTML = '';
        return;
    }

    const totalARS  = app.cuentas.filter(c => (c.moneda || 'ARS') === 'ARS').reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0);
    const totalUSD  = app.cuentas.filter(c => c.moneda === 'USD').reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0);

    const tipoLabel = {
        cuenta_corriente: 'Cta. corriente',
        caja_ahorro:      'Caja de ahorro',
        billetera:        'Billetera virtual'
    };

    const filasHtml = app.cuentas.map(c => {
        const saldo    = parseFloat(c.saldo_actual || 0);
        const fechaStr = c.fecha_saldo ? formatearFechaCorta(c.fecha_saldo) : '—';

        const monedaCuenta = c.moneda || 'ARS';
        const badgeUSD = monedaCuenta === 'USD'
            ? '<span class="badge text-bg-warning ms-1" style="font-size:0.6rem;vertical-align:middle">USD</span>'
            : '';

        return `
        <div class="cuenta-item">
            <div class="cuenta-item-header">
                <div class="d-flex align-items-center gap-2">
                    <span class="cuenta-dot-lg" style="background:${c.color}"></span>
                    <div>
                        <span class="cuenta-nombre">${c.nombre}${badgeUSD}</span>
                        <span class="cuenta-tipo">${tipoLabel[c.tipo] || c.tipo}</span>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <div class="text-end">
                        <div class="cuenta-stat-valor">${formatearMoneda(saldo, monedaCuenta)}</div>
                        <div class="cuenta-stat-fecha">${fechaStr}</div>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-ghost-muted btn-sm" title="Transferir" onclick="abrirModalTransferencia(${c.id})">
                            <i class="bi bi-arrow-left-right"></i>
                        </button>
                        ${c.tipo !== 'billetera' ? `<button class="btn btn-ghost-muted btn-sm" title="Extracción Efectivo" onclick="registrarExtraccion(${c.id})"><i class="bi bi-cash-stack"></i></button>` : ''}
                        <button class="btn btn-ghost-muted btn-sm" title="Actualizar saldo" onclick="actualizarSaldoCuenta(${c.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    const consolidadoUSD = totalUSD > 0
        ? `<div class="cuenta-consolidado-row">
               <span class="cuenta-consolidado-label">Total en cuentas USD</span>
               <span class="cuenta-consolidado-valor">${formatearMoneda(totalUSD, 'USD')}</span>
           </div>` : '';

    contenedor.innerHTML = `
    <div class="cuenta-lista">${filasHtml}</div>
    <div class="cuenta-consolidado">
        <div class="cuenta-consolidado-row">
            <span class="cuenta-consolidado-label">Total en cuentas ARS</span>
            <span class="cuenta-consolidado-valor">${formatearMoneda(totalARS)}</span>
        </div>
        ${consolidadoUSD}
    </div>`;

    contenedor.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el =>
        new bootstrap.Tooltip(el, { trigger: 'hover focus' })
    );
}

function mostrarFormNuevaCuenta() {
    const contenedor = document.getElementById('cardCuentas');
    if (contenedor.querySelector('#formNuevaCuenta')) return; // ya abierto

    const form = document.createElement('div');
    form.id = 'formNuevaCuenta';
    form.className = 'nueva-cuenta-form';
    form.innerHTML = `
        <div class="nueva-cuenta-titulo">Nueva cuenta</div>
        <div class="nueva-cuenta-campos">
            <input type="text" id="nc-nombre" class="form-control form-control-sm" placeholder="Nombre *">
            <input type="text" id="nc-banco"  class="form-control form-control-sm" placeholder="Banco / entidad">
            <select id="nc-tipo" class="form-select form-select-sm">
                <option value="caja_ahorro">Caja de ahorro</option>
                <option value="cuenta_corriente">Cuenta corriente</option>
                <option value="billetera">Billetera virtual</option>
            </select>
            <div class="nueva-cuenta-color">
                <label class="nueva-cuenta-color-label">Color</label>
                <input type="color" id="nc-color" class="form-control form-control-color form-control-sm" value="#6c757d">
            </div>
            <input type="text" inputmode="decimal" id="nc-saldo" class="form-control form-control-sm" placeholder="Saldo inicial (0)">
        </div>
        <div class="nueva-cuenta-acciones">
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('formNuevaCuenta').remove()">Cancelar</button>
            <button class="btn btn-sm btn-primary" onclick="guardarNuevaCuenta()">Guardar</button>
        </div>`;
    contenedor.appendChild(form);
    document.getElementById('nc-nombre').focus();
}

async function guardarNuevaCuenta() {
    const nombre = document.getElementById('nc-nombre').value.trim();
    if (!nombre) { mostrarError('El nombre es obligatorio'); return; }

    const payload = {
        nombre,
        banco:        document.getElementById('nc-banco').value.trim(),
        tipo:         document.getElementById('nc-tipo').value,
        color:        document.getElementById('nc-color').value,
        saldo_actual: parseFloat(document.getElementById('nc-saldo').value.replace(',', '.')) || 0,
    };

    try {
        const resp = await fetch('api/cuentas_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);
        mostrarToast('Cuenta creada', 'success');
        await cargarCuentas();
        document.getElementById('formNuevaCuenta')?.remove();
    } catch (e) {
        mostrarError('Error al crear cuenta: ' + e.message);
    }
}

function abrirModalTransferencia(cuentaOrigenId = null) {
    const sel1 = document.getElementById('transfOrigen');
    const sel2 = document.getElementById('transfDestino');

    const options = app.cuentas.map(c =>
        `<option value="${c.id}">${c.nombre}</option>`
    ).join('');
    sel1.innerHTML = options;
    sel2.innerHTML = options;

    if (cuentaOrigenId) sel1.value = cuentaOrigenId;
    // Pre-seleccionar destino distinto al origen
    const otra = app.cuentas.find(c => c.id != (cuentaOrigenId || app.cuentas[0]?.id));
    if (otra) sel2.value = otra.id;

    document.getElementById('transfImporte').value    = '';
    document.getElementById('transfDescripcion').value = '';

    new bootstrap.Modal(document.getElementById('modalTransferencia')).show();
}

async function realizarTransferencia() {
    const origen      = parseInt(document.getElementById('transfOrigen').value);
    const destino     = parseInt(document.getElementById('transfDestino').value);
    const importe     = parsearImporte(document.getElementById('transfImporte').value);
    const descripcion = document.getElementById('transfDescripcion').value.trim();

    if (origen === destino) { mostrarError('Las cuentas deben ser distintas'); return; }
    if (!importe || importe <= 0) { mostrarError('Importe inválido'); return; }

    try {
        const resp = await fetch('api/movimientos_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'transferencia', cuenta_origen_id: origen, cuenta_destino_id: destino, importe, descripcion })
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);

        bootstrap.Modal.getInstance(document.getElementById('modalTransferencia'))?.hide();
        mostrarToast('Transferencia realizada', 'success');
        await cargarCuentas();
    } catch (error) {
        mostrarError('Error: ' + error.message);
    }
}

async function registrarExtraccion(cuentaId) {
    const cuenta = app.cuentas.find(c => c.id == cuentaId);
    if (!cuenta) return;

    const inputStr = prompt(`Extracción Efectivo — ${cuenta.nombre}\nImporte:`);
    if (inputStr === null) return;

    const importe = parsearImporte(inputStr);
    if (!importe || importe <= 0) { mostrarError('Importe inválido'); return; }

    try {
        const resp = await fetch('api/movimientos_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo: 'extraccion',
                cuenta_id: cuentaId,
                importe,
                fecha: new Date().toISOString().split('T')[0]
            })
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast(`Extracción de ${formatearMoneda(importe)} registrada`, 'success');
        await cargarDatos();
    } catch (error) {
        mostrarError('Error: ' + error.message);
    }
}

function abrirModalGastoRapido() {
    // Poblar selector con conceptos múltiples de gasto activos
    const sel = document.getElementById('grConcepto');
    const conceptos = (app.datos?.conceptos || [])
        .filter(c => c.tipo === 'gasto' && c.permite_multiples == 1 && c.activo != 0);
    sel.innerHTML = conceptos.length
        ? conceptos.map(c => `<option value="${c.id}" data-default-cuenta="${c.cuenta_id_default || ''}" data-moneda="${c.moneda || 'ARS'}">${c.nombre}</option>`).join('')
        : '<option value="">— Sin conceptos disponibles —</option>';

    const selCuenta = document.getElementById('grCuenta');
    const grImporte = document.getElementById('grImporte');

    // Actualiza cuentas e importe según moneda del concepto seleccionado
    const actualizarPorConcepto = () => {
        const opt = sel.options[sel.selectedIndex];
        if (!opt) return;
        const moneda = opt.dataset.moneda || 'ARS';
        selCuenta.innerHTML = '<option value="">Seleccioná una cuenta…</option>' +
            app.cuentas.filter(c => (c.moneda || 'ARS') === moneda)
                .map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        if (opt.dataset.defaultCuenta) selCuenta.value = opt.dataset.defaultCuenta;
        grImporte.placeholder = moneda === 'USD' ? 'U$D 0,00' : '$ 0,00';
    };

    actualizarPorConcepto();
    sel.onchange = actualizarPorConcepto;

    // Fecha por defecto: hoy
    document.getElementById('grFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('grImporte').value = '';
    document.getElementById('grDescripcion').value = '';

    new bootstrap.Modal(document.getElementById('modalGastoRapido')).show();
    setTimeout(() => document.getElementById('grImporte').focus(), 400);
}

async function guardarGastoRapido() {
    const conceptoId = parseInt(document.getElementById('grConcepto').value);
    const cuentaId   = parseInt(document.getElementById('grCuenta').value) || null;
    const fecha      = document.getElementById('grFecha').value;
    const importe    = parsearImporte(document.getElementById('grImporte').value);
    const desc       = document.getElementById('grDescripcion').value.trim();

    if (!conceptoId) { mostrarError('Seleccioná un concepto.'); return; }
    if (!cuentaId)   { mostrarError('Seleccioná una cuenta.'); return; }
    if (!fecha)      { mostrarError('Ingresá una fecha.'); return; }
    if (importe <= 0){ mostrarError('El importe debe ser mayor a 0.'); return; }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                concepto_id: conceptoId,
                cuenta_id: cuentaId,
                mes: app.mesActual,
                anio: app.anioActual,
                fecha,
                importe,
                observaciones: desc || null
            })
        });
        const result = await res.json();
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalGastoRapido')).hide();
            mostrarToast('Gasto agregado', 'success');
            await cargarDatos();
        } else {
            mostrarError('Error: ' + result.message);
        }
    } catch (e) {
        mostrarError('Error de conexión.');
    }
}

async function abrirModalMovimientos() {
    const modal = new bootstrap.Modal(document.getElementById('modalMovimientos'));
    modal.show();

    const body = document.getElementById('modalMovimientosBody');
    body.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
        const resp = await fetch('api/movimientos_api.php?limit=50');
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);

        if (!result.data.length) {
            body.innerHTML = '<p class="text-center text-muted py-4">Sin movimientos registrados</p>';
            return;
        }

        const tipoInfo = {
            ingreso:      { label: 'Cobro',         icon: 'bi-arrow-down-circle text-success', cls: 'text-success' },
            pago_gasto:   { label: 'Pago',          icon: 'bi-arrow-up-circle text-danger',    cls: 'text-danger'  },
            transferencia:{ label: 'Transferencia', icon: 'bi-arrow-left-right text-primary',  cls: ''             },
            extraccion:   { label: 'Extracción Efectivo',icon: 'bi-cash-stack text-warning',        cls: 'text-danger'  },
        };

        const rows = result.data.map(m => {
            const t = tipoInfo[m.tipo] || { label: m.tipo, icon: 'bi-circle', cls: '' };
            const cuentaStr = m.tipo === 'transferencia'
                ? `${m.cuenta_origen || '?'} → ${m.cuenta_destino || '?'}`
                : (m.cuenta_origen || m.cuenta_destino || '—');
            const desc = m.observaciones || m.descripcion || '';

            const fechaStr = (m.fecha || '').replace('T', ' ');
            const [fechaParte, horaParte] = fechaStr.split(' ');
            const [yy, mm, dd] = (fechaParte || '').split('-');
            const fechaFmt = fechaParte ? `${dd}/${mm}/${(yy || '').slice(2)}` : '—';
            const horaFmt  = horaParte  ? horaParte.slice(0, 5) : '';

            return `
            <div class="d-flex align-items-start gap-2 px-3 py-2 border-bottom">
                <div class="text-muted text-center flex-shrink-0" style="min-width:2.8rem;font-size:.72rem;line-height:1.4">
                    <div>${fechaFmt}</div>
                    ${horaFmt ? `<div>${horaFmt}</div>` : ''}
                </div>
                <div class="flex-grow-1" style="font-size:.82rem;min-width:0">
                    <div class="text-truncate"><i class="bi ${t.icon} me-1"></i><strong>${t.label}</strong> · ${cuentaStr}</div>
                    ${desc ? `<div class="text-muted text-truncate">${desc}</div>` : ''}
                </div>
                <div class="fw-medium ${t.cls} flex-shrink-0 text-end" style="font-size:.82rem">${formatearMoneda(m.importe)}</div>
            </div>`;
        }).join('');

        body.innerHTML = `<div>${rows}</div>`;
    } catch (error) {
        body.innerHTML = `<div class="alert alert-danger m-3">Error: ${error.message}</div>`;
    }
}

async function actualizarSaldoCuenta(cuentaId) {
    const cuenta = app.cuentas.find(c => c.id == cuentaId);
    if (!cuenta) return;

    const actual = parseFloat(cuenta.saldo_actual || 0);
    const input  = prompt(
        `Nuevo saldo de ${cuenta.nombre}:\n(Usá coma como decimal — ej: 125.000,50)`,
        actual > 0 ? String(actual).replace('.', ',') : ''
    );
    if (input === null) return;

    const saldo = parsearImporte(input);
    if (isNaN(saldo) || saldo < 0) {
        mostrarError('Importe inválido.');
        return;
    }

    try {
        const response = await fetch('api/cuentas_api.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: cuentaId, saldo_actual: saldo })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        mostrarToast(`Saldo de ${cuenta.nombre} actualizado`, 'success');
        await cargarCuentas();
    } catch (error) {
        mostrarError('Error al actualizar saldo: ' + error.message);
    }
}

// ============================================================
// Mostrar toast (notificación pequeña)
function mostrarToast(mensaje, tipo = 'success') {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }

    const toastId = 'toast-' + Date.now();
    const iconClass = tipo === 'success' ? 'bi-check-circle-fill text-success' : 'bi-info-circle-fill text-info';

    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi ${iconClass} me-2"></i>
                    ${mensaje}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 2000 });
    toast.show();

    toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
}

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

// Estado de la aplicación
const app = {
    mesActual: new Date().getMonth() + 1,
    anioActual: new Date().getFullYear(),
    datos: null,
    guardandoCambios: false,
    dtIngresos: null,
    dtGastos: null,
    categorias: [],
    categoriasColapsadas: new Set()
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    inicializarSelectores();
    cargarDatos();
    sincronizarIconDarkMode();
    document.getElementById('btnCargar').addEventListener('click', cargarDatos);
    document.getElementById('selectMes').addEventListener('change', cargarDatos);
    document.getElementById('selectAnio').addEventListener('change', cargarDatos);

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
        navigator.serviceWorker.register('./sw.js')
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
        const response = await fetch(`${API_URL}?mes=${app.mesActual}&anio=${app.anioActual}`);
        const result = await response.json();

        if (result.success) {
            app.datos = result.data;
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

    // Actualizar resumen
    document.getElementById('totalIngresos').textContent = formatearMoneda(app.datos.resumen.total_ingresos);
    document.getElementById('totalGastos').textContent = formatearMoneda(app.datos.resumen.total_gastos);
    const elDisponible = document.getElementById('saldoDisponible');
    if (elDisponible) elDisponible.textContent = formatearMoneda(app.datos.resumen.saldo_disponible);
    document.getElementById('saldo').textContent = formatearMoneda(app.datos.resumen.saldo);

    // Color del saldo según disponible (ingresos - gastos pagados)
    const cardSaldo = document.getElementById('cardSaldo');
    const iconSaldo = document.getElementById('iconSaldo');
    const disponible = app.datos.resumen.saldo_disponible;

    if (disponible < 0) {
        cardSaldo.classList.add('negativo');
        cardSaldo.classList.remove('border-primary');
        cardSaldo.classList.add('border-warning');
        iconSaldo.classList.remove('bi-wallet2', 'text-primary');
        iconSaldo.classList.add('bi-exclamation-triangle-fill', 'text-warning');
    } else {
        cardSaldo.classList.remove('negativo', 'border-warning');
        cardSaldo.classList.add('border-primary');
        iconSaldo.classList.remove('bi-exclamation-triangle-fill', 'text-warning');
        iconSaldo.classList.add('bi-wallet2', 'text-primary');
    }

    // Destruir DataTables ANTES de limpiar tbody (evita reinicio sucio)
    if (app.dtIngresos) { app.dtIngresos.destroy(); app.dtIngresos = null; }
    if (app.dtGastos)   { app.dtGastos.destroy();   app.dtGastos = null; }

    // Separar ingresos y gastos
    const ingresos = app.datos.conceptos.filter(c => c.tipo === 'ingreso');
    const gastos = app.datos.conceptos.filter(c => c.tipo === 'gasto');

    // Renderizar ingresos
    const tbodyIngresos = document.getElementById('tablaIngresos');
    tbodyIngresos.innerHTML = '';
    ingresos.forEach(concepto => {
        const filas = crearFilasConcepto(concepto, 'ingreso');
        filas.forEach(fila => tbodyIngresos.appendChild(fila));
    });

    // Renderizar gastos
    const tbodyGastos = document.getElementById('tablaGastos');
    tbodyGastos.innerHTML = '';
    gastos.forEach(concepto => {
        const filas = crearFilasConcepto(concepto, 'gasto');
        filas.forEach(fila => tbodyGastos.appendChild(fila));
    });

    // Actualizar título del mes
    document.getElementById('mesAnioActual').textContent =
        `${String(app.mesActual).padStart(2, '0')}/${app.anioActual}`;

    inicializarDataTables();
    mostrarBannerPeriodo();
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
    const opciones = {
        paging:   false,
        info:     false,
        ordering: false,      // orden fijo desde la API — respeta agrupación por categoría
        dom:      't',
        autoWidth: false,
        language: { emptyTable: 'Sin datos para este período' },
        drawCallback: function() {
            inyectarCabecerasCategorias(this.api());
        }
    };

    app.dtIngresos = $('#dtIngresos').DataTable(opciones);
    app.dtGastos   = $('#dtGastos').DataTable(opciones);
}

// Inyectar filas de cabecera de categoría en el tbody después de cada draw de DataTables
function inyectarCabecerasCategorias(api) {
    // Calcular totales por categoría desde los datos en memoria
    const totalesPorCat = {};
    if (app.datos && app.datos.conceptos) {
        app.datos.conceptos.forEach(c => {
            if (c.categoria_id) {
                totalesPorCat[c.categoria_id] = (totalesPorCat[c.categoria_id] || 0) + parseFloat(c.importe || 0);
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
        const total     = totalesPorCat[catId] || 0;

        const headerTr = document.createElement('tr');
        headerTr.className = 'categoria-header';
        headerTr.dataset.catToggleId = catId;
        const td = document.createElement('td');
        td.colSpan = 2;
        td.innerHTML = `<div class="categoria-header-inner">
            <i class="bi ${colapsada ? 'bi-chevron-right' : 'bi-chevron-down'} categoria-toggle-chevron" style="color:${color}; font-size:0.65rem;"></i>
            <span class="categoria-dot" style="background:${color}"></span>
            ${icono ? `<i class="bi ${icono}" style="color:${color}; font-size:0.78rem;"></i>` : ''}
            <span class="categoria-header-label" style="color:${color}">${nombre}</span>
            <span class="categoria-header-total ms-auto">${formatearMoneda(total)}</span>
        </div>`;
        headerTr.appendChild(td);
        headerTr.addEventListener('click', () => toggleCategoria(catId));
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
            const dtInstance = tr.closest('#dtIngresos') ? app.dtIngresos : app.dtGastos;
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

    // Botón pagado — todos los gastos (si no hay registro se crea con importe 0 al hacer click)
    if (tipo === 'gasto') {
        const isPaid = concepto.pagado === 1;
        const btnPagado = document.createElement('button');
        btnPagado.className = `btn-pagado${isPaid ? ' pagado' : ''}`;
        btnPagado.title = isPaid ? 'Marcar como no pagado' : 'Marcar como pagado';
        btnPagado.innerHTML = `<i class="bi ${isPaid ? 'bi-check-circle-fill' : 'bi-circle'}"></i>`;
        btnPagado.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePagado(concepto.registro_id, btnPagado, tr, concepto.id);
        });
        divNombre.appendChild(btnPagado);
        if (isPaid) tr.classList.add('tr-pagado');
    }

    divNombre.appendChild(document.createTextNode(concepto.nombre));

    // Input fecha de vencimiento — siempre visible
    const wrapVenc = document.createElement('div');
    wrapVenc.className = 'vencimiento-wrap';
    const icoVenc = document.createElement('i');
    icoVenc.className = 'bi bi-calendar-x';
    const inputVenc = document.createElement('input');
    inputVenc.type  = 'date';
    inputVenc.className = 'input-vencimiento';
    inputVenc.title = 'Fecha de vencimiento del concepto';
    inputVenc.value = concepto.fecha_vencimiento ? concepto.fecha_vencimiento.split('T')[0] : '';
    inputVenc.addEventListener('click', e => e.stopPropagation());
    inputVenc.addEventListener('change', () => {
        if (concepto.registro_id) {
            // Ya tiene registro: PATCH directo
            guardarVencimiento(concepto.registro_id, inputVenc.value, tr);
        }
        // Sin registro aún: se incluirá en el POST cuando se guarde el importe
    });
    wrapVenc.appendChild(icoVenc);
    wrapVenc.appendChild(inputVenc);
    divNombre.appendChild(wrapVenc);

    tdNombre.appendChild(divNombre);
    tr.appendChild(tdNombre);

    // Columna importe
    const tdImporte = document.createElement('td');
    tdImporte.className = 'text-end';
    tdImporte.setAttribute('data-order', concepto.importe);

    const inputGroup = document.createElement('div');
    inputGroup.className = 'd-flex justify-content-end align-items-center gap-2';

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.className = 'input-importe form-control';
    input.value = concepto.importe > 0 ? formatearMoneda(concepto.importe) : '';
    input.dataset.conceptoId = concepto.id;
    input.dataset.registroId = concepto.registro_id || '';
    input.placeholder = '$ 0,00';

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

    // Botón SMVM para Cuota Alimentaria (va a la izquierda del input)
    if (concepto.nombre.toLowerCase().includes('alimentaria')) {
        const btnSmvm = document.createElement('button');
        btnSmvm.className = 'btn btn-outline-info btn-sm btn-smvm';
        btnSmvm.title = 'Sugerir valor del SMVM vigente';
        btnSmvm.innerHTML = '<i class="bi bi-robot"></i>';
        btnSmvm.addEventListener('click', () => sugerirSMVM(input, btnSmvm, app.mesActual, app.anioActual));
        inputGroup.appendChild(btnSmvm);
    }

    // Botón Elena Limpieza (va a la izquierda del input)
    if (concepto.nombre.toLowerCase().includes('elena')) {
        const btnElena = document.createElement('button');
        btnElena.className = 'btn btn-outline-secondary btn-sm btn-smvm';
        btnElena.title = 'Sugerir importe empleada doméstica (4h/semana)';
        btnElena.innerHTML = '<i class="bi bi-robot"></i>';
        btnElena.addEventListener('click', () => sugerirElena(input, btnElena, app.mesActual, app.anioActual));
        inputGroup.appendChild(btnElena);
    }

    // Botón Spotify Duo (va a la izquierda del input)
    if (concepto.nombre.toLowerCase().includes('spotify')) {
        const btnSpotify = document.createElement('button');
        btnSpotify.className = 'btn btn-outline-success btn-sm btn-smvm';
        btnSpotify.title = 'Sugerir precio Spotify Duo para el mes seleccionado';
        btnSpotify.innerHTML = '<i class="bi bi-robot"></i>';
        btnSpotify.addEventListener('click', () => sugerirSpotifyDuo(input, btnSpotify, app.mesActual, app.anioActual));
        inputGroup.appendChild(btnSpotify);
    }

    // Botón cotización YouTube Premium (va a la izquierda del input)
    if (concepto.nombre.toLowerCase().includes('youtube')) {
        const btnYt = document.createElement('button');
        btnYt.className = 'btn btn-outline-danger btn-sm btn-smvm';
        btnYt.title = 'Sugerir precio YouTube Premium al tipo de cambio actual';
        btnYt.innerHTML = '<i class="bi bi-robot"></i>';
        btnYt.addEventListener('click', () => sugerirYoutubePremium(input, btnYt));
        inputGroup.appendChild(btnYt);
    }

    inputGroup.appendChild(input);

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
    badge.className = 'badge bg-secondary ms-2';
    badge.id = `badge-count-${concepto.id}`;
    badge.textContent = cantRegistros;
    divNombre.appendChild(badge);

    const arrow = document.createElement('i');
    arrow.className = 'bi bi-chevron-down ms-2 detalle-arrow text-muted';
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

    const inputTotal = document.createElement('input');
    inputTotal.type = 'text';
    inputTotal.className = 'input-importe form-control input-importe-readonly';
    inputTotal.id = `total-concepto-${concepto.id}`;
    inputTotal.value = formatearMoneda(concepto.importe);
    inputTotal.readOnly = true;
    inputTotal.tabIndex = -1;
    inputTotal.title = 'Total del mes — expandí para ver el detalle';

    inputGroupTotal.appendChild(inputTotal);
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
            tbody.appendChild(crearFilaRegistroDetalle(reg, concepto.id));
        });
    } else {
        const trVacio = document.createElement('tr');
        trVacio.className = 'fila-sin-registros';
        trVacio.innerHTML = `<td colspan="4" class="text-muted text-center py-2 fst-italic">Sin registros este mes</td>`;
        tbody.appendChild(trVacio);
    }

    // Fila formulario para agregar
    tbody.appendChild(crearFilaFormNuevoRegistro(concepto.id));

    tabla.appendChild(tbody);
    wrapper.appendChild(tabla);
    return wrapper;
}

// Fila de un registro individual dentro del detalle
function crearFilaRegistroDetalle(reg, conceptoId) {
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
        <td class="ps-4 text-muted" style="width:110px">
            ${formatearFecha(reg.fecha)}
            <div style="margin-top:2px">
                <input type="date" class="form-control form-control-sm input-vencimiento-detalle"
                    value="${fechaVenc}" title="Vencimiento"
                    onchange="guardarVencimiento(${reg.id}, this.value, this.closest('tr'))">
            </div>
        </td>
        <td class="text-end fw-medium">${formatearMoneda(reg.importe)}</td>
        <td class="text-muted fst-italic">${reg.observaciones || ''}</td>
        <td class="text-end pe-3" style="width:80px">
            <button class="btn-pagado${isPaid ? ' pagado' : ''}"
                title="${isPaid ? 'Marcar como no pagado' : 'Marcar como pagado'}"
                onclick="togglePagado(${reg.id}, this, this.closest('tr'))">
                <i class="bi ${isPaid ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm py-0 px-1"
                title="Eliminar"
                onclick="eliminarRegistroMultiple(${reg.id}, ${conceptoId})">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    return tr;
}

// Fila con formulario para agregar nuevo registro
function crearFilaFormNuevoRegistro(conceptoId) {
    const tr = document.createElement('tr');
    tr.className = 'fila-nuevo-registro';
    tr.id = `form-nuevo-${conceptoId}`;

    const hoy = new Date().toISOString().split('T')[0];

    tr.innerHTML = `
        <td class="ps-3" style="width:140px">
            <input type="date" class="form-control form-control-sm"
                id="fecha-nuevo-${conceptoId}" value="${hoy}">
            <input type="date" class="form-control form-control-sm input-vencimiento-detalle mt-1"
                id="vence-nuevo-${conceptoId}" title="Vencimiento (opcional)">
        </td>
        <td>
            <input type="number" step="0.01" min="0" class="form-control form-control-sm text-end"
                id="importe-nuevo-${conceptoId}" placeholder="0.00">
        </td>
        <td>
            <input type="text" class="form-control form-control-sm"
                id="obs-nuevo-${conceptoId}" placeholder="Observaciones (opcional)">
        </td>
        <td class="text-end pe-3" style="width:50px">
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
    const dtInstance = trHeader.closest('#dtIngresos') ? app.dtIngresos : app.dtGastos;
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
    const fechaVencimiento = document.getElementById(`vence-nuevo-${conceptoId}`)?.value || null;

    const importe = parseFloat(importeVal) || 0;

    if (!fecha) {
        mostrarError('Ingresá una fecha.');
        return;
    }
    if (importe <= 0) {
        mostrarError('El importe debe ser mayor a 0.');
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                concepto_id: conceptoId,
                mes: app.mesActual,
                anio: app.anioActual,
                fecha,
                fecha_vencimiento: fechaVencimiento || null,
                importe,
                observaciones: observaciones || null
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

// Sugerir precio de YouTube Premium convertido a ARS al dólar oficial
async function sugerirYoutubePremium(inputElement, btnElement) {
    const iconOriginal = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
        if (!response.ok) throw new Error('No se pudo obtener la cotización');
        const oficial = await response.json();

        const venta = oficial.venta;
        const valorARS = Math.round(YOUTUBE_PREMIUM_USD * venta);
        const fecha = new Date(oficial.fechaActualizacion).toLocaleDateString('es-AR');

        const confirmar = confirm(
            `YouTube Premium Individual: USD ${YOUTUBE_PREMIUM_USD}\n` +
            `Dólar oficial al ${fecha}: $${venta.toLocaleString('es-AR')}\n\n` +
            `Valor estimado: ${formatearMoneda(valorARS)}\n\n` +
            `¿Usar este valor?`
        );

        if (confirmar) {
            inputElement.value = valorARS;
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
        // Recargar para que el botón tenga el registro_id correcto en su closure
        if (registroCreado) await cargarDatos();
    } catch (error) {
        mostrarError('Error al actualizar: ' + error.message);
    }
}

// Formatear moneda
function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(valor);
}

// Formatear fecha ISO a dd/mm/yyyy
function formatearFecha(fechaISO) {
    if (!fechaISO) return '';
    const [y, m, d] = fechaISO.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
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
function toggleResumen() {
    const contenido = document.getElementById('contenidoResumen');
    const icon = document.getElementById('iconToggleResumen');
    const oculto = contenido.classList.contains('d-none');
    contenido.classList.toggle('d-none', !oculto);
    icon.classList.toggle('bi-chevron-down', !oculto);
    icon.classList.toggle('bi-chevron-up', oculto);
}

// Toggle sección ingresos
function toggleTablaIngresos() {
    const contenido = document.getElementById('contenidoIngresos');
    const icon = document.getElementById('iconToggleIngresos');
    const oculto = contenido.classList.contains('d-none');
    contenido.classList.toggle('d-none', !oculto);
    icon.classList.toggle('bi-chevron-down', !oculto);
    icon.classList.toggle('bi-chevron-up', oculto);
    // Recalcular columnas de DataTables al hacerse visible
    if (oculto && app.dtIngresos) {
        app.dtIngresos.columns.adjust().draw(false);
    }
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
        const resC = await respConceptos.json();
        const resCat = await respCategorias.json();
        if (!resC.success) throw new Error(resC.message);

        app.categorias = resCat.success ? resCat.data : [];

        const ingresos = resC.data.filter(c => c.tipo === 'ingreso');
        const gastos   = resC.data.filter(c => c.tipo === 'gasto');

        renderizarListaConceptos('listaIngresos', ingresos);
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

    if (!nombre) {
        mostrarError('El nombre no puede estar vacío.');
        return;
    }

    try {
        const response = await fetch(CONCEPTOS_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, nombre, orden, permite_multiples, categoria_id })
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

function mostrarFormNuevo(tipo) {
    const form = document.getElementById('formNuevoConcepto');
    document.getElementById('nuevoTipo').value = tipo;
    document.getElementById('nuevoNombre').value = '';
    document.getElementById('nuevoOrden').value = '';
    document.getElementById('nuevoPermiteMultiples').checked = false;
    document.getElementById('nuevoCategoria').value = '';
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

    if (!nombre) {
        mostrarError('El nombre no puede estar vacío.');
        return;
    }

    try {
        const response = await fetch(CONCEPTOS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, tipo, orden: orden || undefined, permite_multiples, categoria_id })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast('Concepto creado correctamente', 'success');
        cancelarNuevoConcepto();
        await cargarConceptosModal();
        await cargarDatos();

        const tabBtn = document.getElementById(tipo === 'ingreso' ? 'tab-ingresos-btn' : 'tab-gastos-btn');
        bootstrap.Tab.getOrCreateInstance(tabBtn).show();
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
            <td>
                <span class="cat-drag-handle" title="Arrastrar para reordenar"><i class="bi bi-grip-vertical"></i></span>
                <span class="categoria-dot d-inline-block ms-1" style="background:${cat.color}; width:10px; height:10px; border-radius:50%; vertical-align:middle"></span>
            </td>
            <td>
                <span class="cat-nombre-texto">
                    ${cat.icono ? `<i class="bi ${cat.icono} me-1" style="color:${cat.color}"></i>` : ''}
                    ${cat.nombre}
                </span>
                <span class="cat-nombre-edit d-none d-flex gap-1 align-items-center">
                    <input type="color" id="edit-cat-color-${cat.id}" class="form-control form-control-sm form-control-color" style="width:36px;padding:2px" value="${cat.color}">
                    <input type="text" id="edit-cat-nombre-${cat.id}" class="form-control form-control-sm" style="width:130px" value="${cat.nombre}">
                    <input type="text" id="edit-cat-icono-${cat.id}" class="form-control form-control-sm" style="width:110px" placeholder="bi-house-fill" value="${cat.icono || ''}">
                </span>
            </td>
            <td class="text-center">
                <span class="cat-orden-texto">${cat.orden}</span>
                <span class="cat-orden-edit d-none">
                    <input type="number" id="edit-cat-orden-${cat.id}" class="form-control form-control-sm text-center" style="width:55px" value="${cat.orden}">
                </span>
            </td>
            <td class="text-end">
                <div class="cat-acciones-ver d-flex gap-1 justify-content-end">
                    <button class="btn btn-outline-primary btn-sm" title="Editar" onclick="editarCategoria(${cat.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" title="Eliminar" onclick="eliminarCategoria(${cat.id}, '${cat.nombre.replace(/'/g, "\\'")}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="cat-acciones-edit d-none d-flex gap-1 justify-content-end">
                    <button class="btn btn-success btn-sm" onclick="guardarEdicionCategoria(${cat.id})">
                        <i class="bi bi-check-lg"></i>
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="cancelarEdicionCategoria(${cat.id})">
                        <i class="bi bi-x-lg"></i>
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
    fila.querySelectorAll('.cat-nombre-texto, .cat-orden-texto, .cat-acciones-ver').forEach(el => el.classList.add('d-none'));
    fila.querySelectorAll('.cat-nombre-edit, .cat-orden-edit, .cat-acciones-edit').forEach(el => el.classList.remove('d-none'));
    document.getElementById(`edit-cat-nombre-${id}`).focus();
}

function cancelarEdicionCategoria(id) {
    const fila = document.getElementById(`fila-categoria-${id}`);
    fila.querySelectorAll('.cat-nombre-texto, .cat-orden-texto, .cat-acciones-ver').forEach(el => el.classList.remove('d-none'));
    fila.querySelectorAll('.cat-nombre-edit, .cat-orden-edit, .cat-acciones-edit').forEach(el => el.classList.add('d-none'));
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

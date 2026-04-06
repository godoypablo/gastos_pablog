/**
 * JavaScript para Sistema de Gastos Personales
 */

const API_URL = 'api/gastos_api.php';

// Estado de la aplicación
const app = {
    mesActual: new Date().getMonth() + 1,
    anioActual: new Date().getFullYear(),
    datos: null,
    guardandoCambios: false
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    inicializarSelectores();
    cargarDatos();

    // Event listeners
    document.getElementById('btnCargar').addEventListener('click', cargarDatos);
});

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
    document.getElementById('saldo').textContent = formatearMoneda(app.datos.resumen.saldo);

    // Cambiar estilo del saldo según si es positivo o negativo
    const cardSaldo = document.getElementById('cardSaldo');
    const iconSaldo = document.getElementById('iconSaldo');
    const textSaldo = document.getElementById('saldo');

    if (app.datos.resumen.saldo < 0) {
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

    // Separar ingresos y gastos
    const ingresos = app.datos.conceptos.filter(c => c.tipo === 'ingreso');
    const gastos = app.datos.conceptos.filter(c => c.tipo === 'gasto');

    // Renderizar ingresos
    const tbodyIngresos = document.getElementById('tablaIngresos');
    tbodyIngresos.innerHTML = '';
    ingresos.forEach(concepto => {
        tbodyIngresos.appendChild(crearFilaConcepto(concepto, 'ingreso'));
    });

    // Renderizar gastos
    const tbodyGastos = document.getElementById('tablaGastos');
    tbodyGastos.innerHTML = '';
    gastos.forEach(concepto => {
        tbodyGastos.appendChild(crearFilaConcepto(concepto, 'gasto'));
    });

    // Actualizar título del mes
    document.getElementById('mesAnioActual').textContent =
        `${obtenerNombreMes(app.mesActual)} ${app.anioActual}`;
}

// Crear fila de concepto
function crearFilaConcepto(concepto, tipo) {
    const tr = document.createElement('tr');

    // Columna nombre con icono
    const tdNombre = document.createElement('td');
    tdNombre.className = 'concepto-nombre';

    const icon = document.createElement('i');
    icon.className = `bi concepto-icon ${obtenerIconoConcepto(concepto.nombre, tipo)}`;
    tdNombre.appendChild(icon);

    const nombreText = document.createTextNode(concepto.nombre);
    tdNombre.appendChild(nombreText);
    tr.appendChild(tdNombre);

    // Columna importe
    const tdImporte = document.createElement('td');
    tdImporte.className = 'text-end';

    const inputGroup = document.createElement('div');
    inputGroup.className = 'd-flex justify-content-end align-items-center gap-2';

    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.className = 'input-importe form-control';
    input.value = concepto.importe;
    input.dataset.conceptoId = concepto.id;
    input.dataset.registroId = concepto.registro_id || '';
    input.placeholder = '0.00';

    // Evento para guardar cambios al perder foco o presionar Enter
    input.addEventListener('blur', () => guardarImporte(concepto.id, input.value, concepto.registro_id, input));
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    // Marcar como no guardado al cambiar
    input.addEventListener('input', () => {
        input.classList.add('unsaved');
        input.classList.remove('saved');
    });

    inputGroup.appendChild(input);
    tdImporte.appendChild(inputGroup);
    tr.appendChild(tdImporte);

    return tr;
}

// Obtener icono según el concepto
function obtenerIconoConcepto(nombre, tipo) {
    const nombreLower = nombre.toLowerCase();

    if (tipo === 'ingreso') {
        if (nombreLower.includes('sueldo')) return 'bi-briefcase-fill text-success';
        if (nombreLower.includes('ahorro')) return 'bi-piggy-bank-fill text-success';
        return 'bi-currency-dollar text-success';
    }

    // Gastos
    if (nombreLower.includes('alquiler') || nombreLower.includes('departamento')) return 'bi-house-fill text-primary';
    if (nombreLower.includes('supermercado')) return 'bi-cart-fill text-info';
    if (nombreLower.includes('nafta') || nombreLower.includes('etios') || nombreLower.includes('tornado')) return 'bi-fuel-pump-fill text-warning';
    if (nombreLower.includes('gimnasio') || nombreLower.includes('rowing')) return 'bi-heart-pulse-fill text-danger';
    if (nombreLower.includes('youtube') || nombreLower.includes('spotify') || nombreLower.includes('flow')) return 'bi-play-circle-fill text-danger';
    if (nombreLower.includes('enersa') || nombreLower.includes('gas')) return 'bi-lightning-charge-fill text-warning';
    if (nombreLower.includes('remedios')) return 'bi-capsule-pill text-danger';
    if (nombreLower.includes('cochera')) return 'bi-car-front-fill text-secondary';
    if (nombreLower.includes('alimentaria')) return 'bi-people-fill text-info';
    if (nombreLower.includes('mastercard')) return 'bi-credit-card-fill text-primary';
    if (nombreLower.includes('afip') || nombreLower.includes('monotributo')) return 'bi-file-earmark-text-fill text-secondary';
    if (nombreLower.includes('seguro') || nombreLower.includes('rivadavia') || nombreLower.includes('ater')) return 'bi-shield-fill-check text-info';

    return 'bi-cash-stack text-secondary';
}

// Guardar importe
async function guardarImporte(conceptoId, importe, registroId, inputElement) {
    if (app.guardandoCambios) return;

    const importeNumerico = parseFloat(importe) || 0;

    // No guardar si es 0 y no existe registro
    if (importeNumerico === 0 && !registroId) {
        if (inputElement) {
            inputElement.classList.remove('unsaved', 'saved');
        }
        return;
    }

    app.guardandoCambios = true;

    // Mostrar feedback visual
    if (inputElement) {
        inputElement.classList.add('saving');
        inputElement.classList.remove('unsaved');
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                concepto_id: conceptoId,
                mes: app.mesActual,
                anio: app.anioActual,
                importe: importeNumerico
            })
        });

        const result = await response.json();

        if (result.success) {
            // Mostrar feedback de éxito
            if (inputElement) {
                inputElement.classList.add('saved');
                inputElement.classList.remove('saving');

                // Remover clase después de 2 segundos
                setTimeout(() => {
                    inputElement.classList.remove('saved');
                }, 2000);
            }

            // Mostrar toast de éxito
            mostrarToast('Guardado correctamente', 'success');

            // Recargar datos para actualizar resumen
            await cargarDatos();
        } else {
            mostrarError('Error al guardar: ' + result.message);
            if (inputElement) {
                inputElement.classList.remove('saving');
            }
        }
    } catch (error) {
        mostrarError('Error de conexión: ' + error.message);
        if (inputElement) {
            inputElement.classList.remove('saving');
        }
    } finally {
        app.guardandoCambios = false;
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

// Obtener nombre del mes
function obtenerNombreMes(numeroMes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[numeroMes - 1];
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

async function abrirModalConceptos() {
    const modal = new bootstrap.Modal(document.getElementById('modalConceptos'));
    modal.show();
    await cargarConceptosModal();
}

async function cargarConceptosModal() {
    try {
        const response = await fetch(CONCEPTOS_API_URL);
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        const ingresos = result.data.filter(c => c.tipo === 'ingreso');
        const gastos   = result.data.filter(c => c.tipo === 'gasto');

        renderizarListaConceptos('listaIngresos', ingresos);
        renderizarListaConceptos('listaGastos', gastos);
    } catch (error) {
        mostrarError('Error al cargar conceptos: ' + error.message);
    }
}

function renderizarListaConceptos(containerId, conceptos) {
    const container = document.getElementById(containerId);
    if (conceptos.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-2">Sin conceptos.</p>';
        return;
    }

    const tabla = document.createElement('table');
    tabla.className = 'table table-sm table-hover align-middle mb-0';
    tabla.innerHTML = `
        <thead class="table-light">
            <tr>
                <th>Nombre</th>
                <th class="text-center" style="width:70px">Orden</th>
                <th class="text-center" style="width:80px">Estado</th>
                <th style="width:80px"></th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = tabla.querySelector('tbody');
    conceptos.forEach(c => {
        const tr = document.createElement('tr');
        tr.id = `fila-concepto-${c.id}`;
        tr.innerHTML = `
            <td>
                <span class="concepto-nombre-texto ${!c.activo ? 'text-muted text-decoration-line-through' : ''}">${c.nombre}</span>
                <span class="concepto-nombre-edit d-none">
                    <input type="text" class="form-control form-control-sm d-inline-block" style="width:180px"
                        id="edit-nombre-${c.id}" value="${c.nombre}">
                </span>
            </td>
            <td class="text-center">
                <span class="concepto-orden-texto">${c.orden}</span>
                <span class="concepto-orden-edit d-none">
                    <input type="number" class="form-control form-control-sm d-inline-block text-center" style="width:60px"
                        id="edit-orden-${c.id}" value="${c.orden}" min="1">
                </span>
            </td>
            <td class="text-center">
                <span class="badge ${c.activo ? 'bg-success' : 'bg-secondary'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
            </td>
            <td class="text-end">
                <div class="acciones-ver d-flex gap-1 justify-content-end">
                    <button class="btn btn-outline-primary btn-sm" title="Editar" onclick="editarConcepto(${c.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn ${c.activo ? 'btn-outline-warning' : 'btn-outline-success'} btn-sm"
                        title="${c.activo ? 'Desactivar' : 'Activar'}"
                        onclick="toggleActivoConcepto(${c.id}, ${c.activo ? 0 : 1})">
                        <i class="bi ${c.activo ? 'bi-eye-slash' : 'bi-eye'}"></i>
                    </button>
                </div>
                <div class="acciones-edit d-none d-flex gap-1 justify-content-end">
                    <button class="btn btn-success btn-sm" title="Guardar" onclick="guardarEdicionConcepto(${c.id})">
                        <i class="bi bi-check-lg"></i>
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" title="Cancelar" onclick="cancelarEdicionConcepto(${c.id})">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    container.innerHTML = '';
    container.appendChild(tabla);
}

function editarConcepto(id) {
    const fila = document.getElementById(`fila-concepto-${id}`);
    fila.querySelectorAll('.concepto-nombre-texto, .concepto-orden-texto, .acciones-ver').forEach(el => el.classList.add('d-none'));
    fila.querySelectorAll('.concepto-nombre-edit, .concepto-orden-edit, .acciones-edit').forEach(el => el.classList.remove('d-none'));
    document.getElementById(`edit-nombre-${id}`).focus();
}

function cancelarEdicionConcepto(id) {
    const fila = document.getElementById(`fila-concepto-${id}`);
    fila.querySelectorAll('.concepto-nombre-texto, .concepto-orden-texto, .acciones-ver').forEach(el => el.classList.remove('d-none'));
    fila.querySelectorAll('.concepto-nombre-edit, .concepto-orden-edit, .acciones-edit').forEach(el => el.classList.add('d-none'));
}

async function guardarEdicionConcepto(id) {
    const nombre = document.getElementById(`edit-nombre-${id}`).value.trim();
    const orden  = document.getElementById(`edit-orden-${id}`).value;

    if (!nombre) {
        mostrarError('El nombre no puede estar vacío.');
        return;
    }

    try {
        const response = await fetch(CONCEPTOS_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, nombre, orden })
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

function mostrarFormNuevo(tipo) {
    const form = document.getElementById('formNuevoConcepto');
    document.getElementById('nuevoTipo').value = tipo;
    document.getElementById('nuevoNombre').value = '';
    document.getElementById('nuevoOrden').value = '';
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

    if (!nombre) {
        mostrarError('El nombre no puede estar vacío.');
        return;
    }

    try {
        const response = await fetch(CONCEPTOS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, tipo, orden: orden || undefined })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        mostrarToast('Concepto creado correctamente', 'success');
        cancelarNuevoConcepto();
        await cargarConceptosModal();
        await cargarDatos();

        // Cambiar al tab correspondiente
        const tabBtn = document.getElementById(tipo === 'ingreso' ? 'tab-ingresos-btn' : 'tab-gastos-btn');
        bootstrap.Tab.getOrCreateInstance(tabBtn).show();
    } catch (error) {
        mostrarError('Error al crear: ' + error.message);
    }
}

// ============================================================
// Mostrar toast (notificación pequeña)
function mostrarToast(mensaje, tipo = 'success') {
    // Crear contenedor de toasts si no existe
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
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 2000
    });

    toast.show();

    // Remover el toast del DOM después de que se oculte
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

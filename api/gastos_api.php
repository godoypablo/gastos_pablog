<?php
/**
 * API REST para Sistema de Gastos Personales
 */
 ini_set('display_errors', 1);
  error_reporting(E_ALL);


header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once '../config/database.php';
require_once '../config/auth_check.php';
require_auth_or_401();

// Función para enviar respuesta JSON
function sendResponse($success, $data = null, $message = '', $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Obtener método HTTP
$method = $_SERVER['REQUEST_METHOD'];

// Responder preflight CORS (necesario para PATCH)
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Obtener conexión a BD
    $db = Database::getInstance()->getConnection();


    switch ($method) {
        case 'GET':
            $mes = isset($_GET['mes']) ? (int)$_GET['mes'] : date('n');
            $anio = isset($_GET['anio']) ? (int)$_GET['anio'] : date('Y');

            // Conceptos con total agregado, incluyendo datos de categoría
            $sql = "SELECT
                        c.id,
                        c.nombre,
                        c.tipo,
                        c.orden,
                        c.permite_multiples,
                        c.categoria_id,
                        cat.nombre  AS categoria_nombre,
                        cat.color   AS categoria_color,
                        cat.icono   AS categoria_icono,
                        COALESCE(SUM(rm.importe), 0.00) as importe,
                        MIN(rm.id) as registro_id,
                        MAX(rm.pagado) as pagado,
                        MIN(rm.fecha_vencimiento) as fecha_vencimiento
                    FROM conceptos c
                    LEFT JOIN categorias cat ON c.categoria_id = cat.id
                    LEFT JOIN registros_mensuales rm ON c.id = rm.concepto_id
                        AND rm.mes = :mes
                        AND rm.anio = :anio
                    WHERE c.activo = 1
                    GROUP BY c.id, c.nombre, c.tipo, c.orden, c.permite_multiples,
                             c.categoria_id, cat.nombre, cat.color, cat.icono
                    ORDER BY c.tipo DESC,
                             COALESCE(cat.orden, 9999) ASC,
                             COALESCE(cat.id, 9999) ASC,
                             c.orden ASC";

            $stmt = $db->prepare($sql);
            $stmt->execute(['mes' => $mes, 'anio' => $anio]);
            $conceptos = $stmt->fetchAll();

            // Detalle de registros para conceptos multi-entrada
            $sql_detalle = "SELECT rm.id, rm.concepto_id, rm.fecha, rm.fecha_vencimiento, rm.importe, rm.observaciones, rm.pagado
                            FROM registros_mensuales rm
                            INNER JOIN conceptos c ON rm.concepto_id = c.id
                            WHERE rm.mes = :mes AND rm.anio = :anio AND c.permite_multiples = 1
                            ORDER BY rm.fecha ASC, rm.id ASC";
            $stmt_detalle = $db->prepare($sql_detalle);
            $stmt_detalle->execute(['mes' => $mes, 'anio' => $anio]);
            $detalles = $stmt_detalle->fetchAll();

            // Agrupar detalles por concepto_id
            $detalles_por_concepto = [];
            foreach ($detalles as $d) {
                $detalles_por_concepto[$d['concepto_id']][] = $d;
            }

            // Calcular totales y agregar detalle
            $total_ingresos = 0;
            $total_gastos = 0;

            foreach ($conceptos as &$concepto) {
                $concepto['permite_multiples'] = (bool)$concepto['permite_multiples'];
                $concepto['pagado']            = (int)($concepto['pagado'] ?? 0);
                if ($concepto['permite_multiples']) {
                    $detalle = $detalles_por_concepto[$concepto['id']] ?? [];
                    foreach ($detalle as &$d) {
                        $d['pagado'] = (int)($d['pagado'] ?? 0);
                    }
                    unset($d);
                    $concepto['detalle'] = $detalle;
                }
                if ($concepto['tipo'] === 'ingreso') {
                    $total_ingresos += $concepto['importe'];
                } else {
                    $total_gastos += $concepto['importe'];
                }
            }
            unset($concepto);

            $saldo = $total_ingresos - $total_gastos;

            // Gastos efectivamente pagados (para saldo disponible)
            $stmt_pagados = $db->prepare(
                "SELECT COALESCE(SUM(rm.importe), 0)
                 FROM registros_mensuales rm
                 INNER JOIN conceptos c ON rm.concepto_id = c.id
                 WHERE rm.mes = :mes AND rm.anio = :anio
                   AND c.tipo = 'gasto' AND c.activo = 1 AND rm.pagado = 1
                   AND rm.importe > 0"
            );
            $stmt_pagados->execute(['mes' => $mes, 'anio' => $anio]);
            $gastos_pagados = (float)$stmt_pagados->fetchColumn();
            $saldo_disponible = $total_ingresos - $gastos_pagados;

            // Detectar si el período tiene al menos un registro
            $stmt_existe = $db->prepare(
                "SELECT COUNT(*) FROM registros_mensuales WHERE mes = :mes AND anio = :anio"
            );
            $stmt_existe->execute(['mes' => $mes, 'anio' => $anio]);
            $periodo_existe = (int)$stmt_existe->fetchColumn() > 0;

            sendResponse(true, [
                'mes'          => $mes,
                'anio'         => $anio,
                'periodo_existe' => $periodo_existe,
                'conceptos'    => $conceptos,
                'resumen'      => [
                    'total_ingresos'  => $total_ingresos,
                    'total_gastos'    => $total_gastos,
                    'gastos_pagados'  => $gastos_pagados,
                    'saldo_disponible'=> $saldo_disponible,
                    'saldo'           => $saldo
                ]
            ]);
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);

            if (!isset($input['concepto_id'], $input['mes'], $input['anio'], $input['importe'])) {
                sendResponse(false, null, 'Faltan datos requeridos', 400);
            }

            $concepto_id = (int)$input['concepto_id'];
            $mes = (int)$input['mes'];
            $anio = (int)$input['anio'];
            $importe = (float)$input['importe'];
            $observaciones = isset($input['observaciones']) ? $input['observaciones'] : null;
            $fecha_vencimiento = (isset($input['fecha_vencimiento']) && $input['fecha_vencimiento']) ? $input['fecha_vencimiento'] : null;

            // Verificar si el concepto permite múltiples entradas
            $stmt = $db->prepare("SELECT permite_multiples FROM conceptos WHERE id = :id");
            $stmt->execute(['id' => $concepto_id]);
            $concepto = $stmt->fetch();

            if (!$concepto) {
                sendResponse(false, null, 'Concepto no encontrado', 404);
            }

            if ($concepto['permite_multiples']) {
                // Multi-entrada: siempre INSERT con fecha y pagado=1 por defecto
                $fecha = isset($input['fecha']) ? $input['fecha'] : date('Y-m-d');
                $sql = "INSERT INTO registros_mensuales (concepto_id, mes, anio, fecha, importe, observaciones, pagado)
                        VALUES (:concepto_id, :mes, :anio, :fecha, :importe, :observaciones, 1)";
                $stmt = $db->prepare($sql);
                $stmt->execute([
                    'concepto_id'      => $concepto_id,
                    'mes'              => $mes,
                    'anio'             => $anio,
                    'fecha'            => $fecha,
                    'importe'          => $importe,
                    'observaciones'    => $observaciones
                ]);
                sendResponse(true, ['id' => $db->lastInsertId()], 'Registro creado correctamente');
            } else {
                // Entrada única: upsert
                $sql = "SELECT id FROM registros_mensuales
                        WHERE concepto_id = :concepto_id AND mes = :mes AND anio = :anio";
                $stmt = $db->prepare($sql);
                $stmt->execute(['concepto_id' => $concepto_id, 'mes' => $mes, 'anio' => $anio]);
                $registro_existente = $stmt->fetch();

                if ($registro_existente) {
                    $sets   = ['importe = :importe', 'observaciones = :observaciones'];
                    $params = ['importe' => $importe, 'observaciones' => $observaciones, 'id' => $registro_existente['id']];
                    if (array_key_exists('fecha_vencimiento', $input)) {
                        $sets[]                    = 'fecha_vencimiento = :fecha_vencimiento';
                        $params['fecha_vencimiento'] = $fecha_vencimiento;
                    }
                    $stmt = $db->prepare("UPDATE registros_mensuales SET " . implode(', ', $sets) . " WHERE id = :id");
                    $stmt->execute($params);
                    sendResponse(true, ['id' => $registro_existente['id']], 'Registro actualizado correctamente');
                } else {
                    $sql = "INSERT INTO registros_mensuales (concepto_id, mes, anio, importe, observaciones, fecha_vencimiento)
                            VALUES (:concepto_id, :mes, :anio, :importe, :observaciones, :fecha_vencimiento)";
                    $stmt = $db->prepare($sql);
                    $stmt->execute([
                        'concepto_id'       => $concepto_id,
                        'mes'               => $mes,
                        'anio'              => $anio,
                        'importe'           => $importe,
                        'observaciones'     => $observaciones,
                        'fecha_vencimiento' => $fecha_vencimiento
                    ]);
                    sendResponse(true, ['id' => $db->lastInsertId()], 'Registro creado correctamente');
                }
            }
            break;

        case 'DELETE':
            $input = json_decode(file_get_contents('php://input'), true);

            if (!isset($input['registro_id'])) {
                sendResponse(false, null, 'Falta el ID del registro', 400);
            }

            $registro_id = (int)$input['registro_id'];

            $sql = "DELETE FROM registros_mensuales WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute(['id' => $registro_id]);

            sendResponse(true, null, 'Registro eliminado correctamente');
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);

            if (($input['action'] ?? '') !== 'copiar_periodo') {
                sendResponse(false, null, 'Acción no reconocida', 400);
            }

            $from_mes  = (int)$input['from_mes'];
            $from_anio = (int)$input['from_anio'];
            $to_mes    = (int)$input['to_mes'];
            $to_anio   = (int)$input['to_anio'];

            // Copia registros de entrada única del período origen al destino
            // Omite conceptos que ya tengan registro en el período destino
            $sql_copy = "INSERT INTO registros_mensuales (concepto_id, mes, anio, importe)
                         SELECT rm.concepto_id, :to_mes, :to_anio, rm.importe
                         FROM registros_mensuales rm
                         INNER JOIN conceptos c ON rm.concepto_id = c.id AND c.activo = 1
                         WHERE rm.mes = :from_mes AND rm.anio = :from_anio
                           AND c.permite_multiples = 0
                           AND NOT EXISTS (
                               SELECT 1 FROM registros_mensuales rm2
                               WHERE rm2.concepto_id = rm.concepto_id
                                 AND rm2.mes = :to_mes2 AND rm2.anio = :to_anio2
                           )";
            $stmt_copy = $db->prepare($sql_copy);
            $stmt_copy->execute([
                'to_mes'    => $to_mes,
                'to_anio'   => $to_anio,
                'from_mes'  => $from_mes,
                'from_anio' => $from_anio,
                'to_mes2'   => $to_mes,
                'to_anio2'  => $to_anio,
            ]);

            $copiados = $stmt_copy->rowCount();
            sendResponse(true, ['copiados' => $copiados],
                "Se copiaron {$copiados} registros desde {$from_mes}/{$from_anio}");
            break;

        case 'PATCH':
            $input = json_decode(file_get_contents('php://input'), true);

            if (!isset($input['registro_id'])) {
                sendResponse(false, null, 'Falta registro_id', 400);
            }

            $registro_id = (int)$input['registro_id'];

            $sets   = [];
            $params = ['id' => $registro_id];

            if (array_key_exists('pagado', $input)) {
                $sets[]          = 'pagado = :pagado';
                $params['pagado'] = $input['pagado'] ? 1 : 0;
            }
            if (array_key_exists('fecha_vencimiento', $input)) {
                $sets[]                    = 'fecha_vencimiento = :fecha_vencimiento';
                $params['fecha_vencimiento'] = ($input['fecha_vencimiento'] !== '' && $input['fecha_vencimiento'] !== null)
                    ? $input['fecha_vencimiento'] : null;
            }

            if (empty($sets)) sendResponse(false, null, 'Nada que actualizar', 400);

            $stmt = $db->prepare("UPDATE registros_mensuales SET " . implode(', ', $sets) . " WHERE id = :id");
            $stmt->execute($params);

            $msg = isset($params['pagado'])
                ? ($params['pagado'] ? 'Marcado como pagado' : 'Marcado como no pagado')
                : 'Vencimiento actualizado';
            sendResponse(true, null, $msg);
            break;

        default:
            sendResponse(false, null, 'Método no permitido', 405);
            break;
    }
} catch (Exception $e) {
    sendResponse(false, null, 'Error: ' . $e->getMessage(), 500);
}

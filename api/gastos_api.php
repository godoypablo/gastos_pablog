<?php
/**
 * API REST para Sistema de Gastos Personales
 */
 ini_set('display_errors', 1);
  error_reporting(E_ALL);


header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

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
                        MIN(rm.id) as registro_id
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
            $sql_detalle = "SELECT rm.id, rm.concepto_id, rm.fecha, rm.importe, rm.observaciones
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
                if ($concepto['permite_multiples']) {
                    $concepto['detalle'] = $detalles_por_concepto[$concepto['id']] ?? [];
                }
                if ($concepto['tipo'] === 'ingreso') {
                    $total_ingresos += $concepto['importe'];
                } else {
                    $total_gastos += $concepto['importe'];
                }
            }
            unset($concepto);

            $saldo = $total_ingresos - $total_gastos;

            sendResponse(true, [
                'mes' => $mes,
                'anio' => $anio,
                'conceptos' => $conceptos,
                'resumen' => [
                    'total_ingresos' => $total_ingresos,
                    'total_gastos' => $total_gastos,
                    'saldo' => $saldo
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

            // Verificar si el concepto permite múltiples entradas
            $stmt = $db->prepare("SELECT permite_multiples FROM conceptos WHERE id = :id");
            $stmt->execute(['id' => $concepto_id]);
            $concepto = $stmt->fetch();

            if (!$concepto) {
                sendResponse(false, null, 'Concepto no encontrado', 404);
            }

            if ($concepto['permite_multiples']) {
                // Multi-entrada: siempre INSERT con fecha
                $fecha = isset($input['fecha']) ? $input['fecha'] : date('Y-m-d');
                $sql = "INSERT INTO registros_mensuales (concepto_id, mes, anio, fecha, importe, observaciones)
                        VALUES (:concepto_id, :mes, :anio, :fecha, :importe, :observaciones)";
                $stmt = $db->prepare($sql);
                $stmt->execute([
                    'concepto_id' => $concepto_id,
                    'mes' => $mes,
                    'anio' => $anio,
                    'fecha' => $fecha,
                    'importe' => $importe,
                    'observaciones' => $observaciones
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
                    $sql = "UPDATE registros_mensuales
                            SET importe = :importe, observaciones = :observaciones
                            WHERE id = :id";
                    $stmt = $db->prepare($sql);
                    $stmt->execute([
                        'importe' => $importe,
                        'observaciones' => $observaciones,
                        'id' => $registro_existente['id']
                    ]);
                    sendResponse(true, ['id' => $registro_existente['id']], 'Registro actualizado correctamente');
                } else {
                    $sql = "INSERT INTO registros_mensuales (concepto_id, mes, anio, importe, observaciones)
                            VALUES (:concepto_id, :mes, :anio, :importe, :observaciones)";
                    $stmt = $db->prepare($sql);
                    $stmt->execute([
                        'concepto_id' => $concepto_id,
                        'mes' => $mes,
                        'anio' => $anio,
                        'importe' => $importe,
                        'observaciones' => $observaciones
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

        default:
            sendResponse(false, null, 'Método no permitido', 405);
            break;
    }
} catch (Exception $e) {
    sendResponse(false, null, 'Error: ' . $e->getMessage(), 500);
}

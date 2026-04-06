<?php
/**
 * API REST para Sistema de Gastos Personales
 */

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
            // Obtener datos del mes/año
            $mes = isset($_GET['mes']) ? (int)$_GET['mes'] : date('n');
            $anio = isset($_GET['anio']) ? (int)$_GET['anio'] : date('Y');

            // Obtener todos los conceptos con sus importes del mes/año especificado
            $sql = "SELECT
                        c.id,
                        c.nombre,
                        c.tipo,
                        c.orden,
                        COALESCE(rm.importe, 0.00) as importe,
                        rm.observaciones,
                        rm.id as registro_id
                    FROM conceptos c
                    LEFT JOIN registros_mensuales rm ON c.id = rm.concepto_id
                        AND rm.mes = :mes
                        AND rm.anio = :anio
                    WHERE c.activo = 1
                    ORDER BY c.tipo DESC, c.orden ASC";

            $stmt = $db->prepare($sql);
            $stmt->execute(['mes' => $mes, 'anio' => $anio]);
            $conceptos = $stmt->fetchAll();

            // Calcular totales
            $total_ingresos = 0;
            $total_gastos = 0;

            foreach ($conceptos as $concepto) {
                if ($concepto['tipo'] === 'ingreso') {
                    $total_ingresos += $concepto['importe'];
                } else {
                    $total_gastos += $concepto['importe'];
                }
            }

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
            // Guardar o actualizar registro
            $input = json_decode(file_get_contents('php://input'), true);

            if (!isset($input['concepto_id'], $input['mes'], $input['anio'], $input['importe'])) {
                sendResponse(false, null, 'Faltan datos requeridos', 400);
            }

            $concepto_id = (int)$input['concepto_id'];
            $mes = (int)$input['mes'];
            $anio = (int)$input['anio'];
            $importe = (float)$input['importe'];
            $observaciones = isset($input['observaciones']) ? $input['observaciones'] : null;

            // Verificar si existe el registro
            $sql = "SELECT id FROM registros_mensuales
                    WHERE concepto_id = :concepto_id AND mes = :mes AND anio = :anio";
            $stmt = $db->prepare($sql);
            $stmt->execute(['concepto_id' => $concepto_id, 'mes' => $mes, 'anio' => $anio]);
            $registro_existente = $stmt->fetch();

            if ($registro_existente) {
                // Actualizar
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
                // Insertar
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
            break;

        case 'DELETE':
            // Eliminar registro
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

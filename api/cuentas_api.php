<?php
/**
 * API REST para Cuentas Bancarias
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once '../config/database.php';
require_once '../config/auth_check.php';
require_auth_or_401();

function sendResponse($success, $data = null, $message = '', $code = 200) {
    http_response_code($code);
    echo json_encode(['success' => $success, 'data' => $data, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = Database::getInstance()->getConnection();

    switch ($method) {

        case 'GET':
            $mes  = isset($_GET['mes'])  ? (int)$_GET['mes']  : date('n');
            $anio = isset($_GET['anio']) ? (int)$_GET['anio'] : date('Y');

            $sql = "SELECT
                        cu.id, cu.nombre, cu.banco, cu.tipo, cu.moneda, cu.color,
                        cu.saldo_actual, cu.fecha_saldo, cu.activo,
                        COALESCE(SUM(
                            CASE WHEN rm.mes = :mes AND rm.anio = :anio AND rm.pagado = 1
                                      AND con.tipo = 'gasto'
                                 THEN rm.importe ELSE 0 END
                        ), 0) AS total_pagado_mes,
                        COALESCE(SUM(
                            CASE WHEN rm.mes = :mes2 AND rm.anio = :anio2
                                      AND con.tipo = 'gasto'
                                 THEN rm.importe ELSE 0 END
                        ), 0) AS total_mes
                    FROM cuentas cu
                    LEFT JOIN registros_mensuales rm ON rm.cuenta_id = cu.id
                    LEFT JOIN conceptos con ON con.id = rm.concepto_id
                    WHERE cu.activo = 1
                    GROUP BY cu.id, cu.nombre, cu.banco, cu.tipo, cu.moneda, cu.color,
                             cu.saldo_actual, cu.fecha_saldo, cu.activo
                    ORDER BY cu.id ASC";

            $stmt = $db->prepare($sql);
            $stmt->execute([
                'mes'   => $mes,
                'anio'  => $anio,
                'mes2'  => $mes,
                'anio2' => $anio,
            ]);
            $cuentas = $stmt->fetchAll();

            foreach ($cuentas as &$c) {
                $c['saldo_actual']    = (float)$c['saldo_actual'];
                $c['total_pagado_mes'] = (float)$c['total_pagado_mes'];
                $c['total_mes']       = (float)$c['total_mes'];
            }
            unset($c);

            sendResponse(true, $cuentas);
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['id'])) {
                sendResponse(false, null, 'id es requerido', 400);
            }

            $id     = (int)$input['id'];
            $fields = [];
            $params = ['id' => $id];

            if (array_key_exists('saldo_actual', $input)) {
                $fields[] = 'saldo_actual = :saldo_actual';
                $fields[] = 'fecha_saldo  = :fecha_saldo';
                $params['saldo_actual'] = (float)$input['saldo_actual'];
                $params['fecha_saldo']  = date('Y-m-d');
            }
            if (!empty($input['nombre'])) {
                $fields[] = 'nombre = :nombre';
                $params['nombre'] = trim($input['nombre']);
            }
            if (!empty($input['color'])) {
                $fields[] = 'color = :color';
                $params['color'] = $input['color'];
            }

            if (empty($fields)) {
                sendResponse(false, null, 'Sin campos para actualizar', 400);
            }

            $db->prepare(
                "UPDATE cuentas SET " . implode(', ', $fields) . " WHERE id = :id"
            )->execute($params);

            sendResponse(true, null, 'Cuenta actualizada');
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['nombre'])) {
                sendResponse(false, null, 'nombre es requerido', 400);
            }
            $tipos_validos = ['cuenta_corriente', 'caja_ahorro', 'billetera'];
            if (empty($input['tipo']) || !in_array($input['tipo'], $tipos_validos)) {
                sendResponse(false, null, 'tipo inválido', 400);
            }

            $moneda = isset($input['moneda']) && $input['moneda'] === 'USD' ? 'USD' : 'ARS';

            $stmt = $db->prepare(
                "INSERT INTO cuentas (nombre, banco, tipo, moneda, color, saldo_actual, fecha_saldo)
                 VALUES (:nombre, :banco, :tipo, :moneda, :color, :saldo, :fecha)"
            );
            $stmt->execute([
                'nombre' => trim($input['nombre']),
                'banco'  => trim($input['banco'] ?? ''),
                'tipo'   => $input['tipo'],
                'moneda' => $moneda,
                'color'  => $input['color'] ?? '#6c757d',
                'saldo'  => (float)($input['saldo_actual'] ?? 0),
                'fecha'  => date('Y-m-d'),
            ]);

            sendResponse(true, ['id' => $db->lastInsertId()], 'Cuenta creada');
            break;

        default:
            sendResponse(false, null, 'Método no permitido', 405);
    }

} catch (Exception $e) {
    sendResponse(false, null, 'Error: ' . $e->getMessage(), 500);
}

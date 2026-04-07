<?php
/**
 * API REST para ABM de Conceptos
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

function sendResponse($success, $data = null, $message = '', $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'data'    => $data,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = Database::getInstance()->getConnection();

    switch ($method) {

        case 'GET':
            $stmt = $db->query(
                "SELECT c.id, c.nombre, c.tipo, c.orden, c.activo, c.permite_multiples,
                        c.categoria_id, cat.nombre AS categoria_nombre, cat.color AS categoria_color
                 FROM conceptos c
                 LEFT JOIN categorias cat ON c.categoria_id = cat.id
                 ORDER BY c.tipo DESC, COALESCE(cat.orden, 9999) ASC, c.orden ASC"
            );
            sendResponse(true, $stmt->fetchAll());
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['nombre']) || empty($input['tipo'])) {
                sendResponse(false, null, 'nombre y tipo son requeridos', 400);
            }

            $nombre = trim($input['nombre']);
            $tipo   = $input['tipo'];

            if (!in_array($tipo, ['ingreso', 'gasto'])) {
                sendResponse(false, null, 'tipo debe ser ingreso o gasto', 400);
            }

            // Calcular orden: max actual del tipo + 1
            $stmt = $db->prepare("SELECT COALESCE(MAX(orden), 0) + 1 AS next_orden FROM conceptos WHERE tipo = :tipo");
            $stmt->execute(['tipo' => $tipo]);
            $next_orden = (int)$stmt->fetchColumn();

            $orden = isset($input['orden']) && $input['orden'] !== '' ? (int)$input['orden'] : $next_orden;
            $permite_multiples = !empty($input['permite_multiples']) ? 1 : 0;
            $categoria_id = !empty($input['categoria_id']) ? (int)$input['categoria_id'] : null;

            $stmt = $db->prepare(
                "INSERT INTO conceptos (nombre, tipo, orden, permite_multiples, categoria_id) VALUES (:nombre, :tipo, :orden, :permite_multiples, :categoria_id)"
            );
            $stmt->execute(['nombre' => $nombre, 'tipo' => $tipo, 'orden' => $orden, 'permite_multiples' => $permite_multiples, 'categoria_id' => $categoria_id]);

            sendResponse(true, ['id' => $db->lastInsertId()], 'Concepto creado correctamente');
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['id'])) {
                sendResponse(false, null, 'id es requerido', 400);
            }

            $id = (int)$input['id'];
            $fields = [];
            $params = ['id' => $id];

            if (isset($input['nombre']) && trim($input['nombre']) !== '') {
                $fields[] = 'nombre = :nombre';
                $params['nombre'] = trim($input['nombre']);
            }
            if (isset($input['tipo']) && in_array($input['tipo'], ['ingreso', 'gasto'])) {
                $fields[] = 'tipo = :tipo';
                $params['tipo'] = $input['tipo'];
            }
            if (isset($input['orden']) && $input['orden'] !== '') {
                $fields[] = 'orden = :orden';
                $params['orden'] = (int)$input['orden'];
            }
            if (isset($input['activo'])) {
                $fields[] = 'activo = :activo';
                $params['activo'] = $input['activo'] ? 1 : 0;
            }
            if (isset($input['permite_multiples'])) {
                $fields[] = 'permite_multiples = :permite_multiples';
                $params['permite_multiples'] = $input['permite_multiples'] ? 1 : 0;
            }
            if (array_key_exists('categoria_id', $input)) {
                $fields[] = 'categoria_id = :categoria_id';
                $params['categoria_id'] = !empty($input['categoria_id']) ? (int)$input['categoria_id'] : null;
            }

            if (empty($fields)) {
                sendResponse(false, null, 'No hay campos para actualizar', 400);
            }

            $sql = "UPDATE conceptos SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            sendResponse(true, null, 'Concepto actualizado correctamente');
            break;

        case 'DELETE':
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['id'])) {
                sendResponse(false, null, 'id es requerido', 400);
            }

            $id = (int)$input['id'];

            // Validar que no tenga registros con importe distinto de 0
            $stmt = $db->prepare(
                "SELECT COUNT(*) FROM registros_mensuales WHERE concepto_id = :id AND importe != 0"
            );
            $stmt->execute(['id' => $id]);
            if ((int)$stmt->fetchColumn() > 0) {
                sendResponse(false, null, 'No se puede eliminar: el concepto tiene importes registrados. Primero ponelos en 0.', 409);
            }

            // Eliminar registros en 0 que pudieran existir y luego el concepto
            $stmt = $db->prepare("DELETE FROM registros_mensuales WHERE concepto_id = :id");
            $stmt->execute(['id' => $id]);

            $stmt = $db->prepare("DELETE FROM conceptos WHERE id = :id");
            $stmt->execute(['id' => $id]);

            sendResponse(true, null, 'Concepto eliminado correctamente');
            break;

        default:
            sendResponse(false, null, 'Método no permitido', 405);
    }

} catch (Exception $e) {
    sendResponse(false, null, 'Error: ' . $e->getMessage(), 500);
}

<?php
/**
 * API REST para ABM de Categorías
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
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
            $stmt = $db->query(
                "SELECT id, nombre, color, icono, orden, activo
                 FROM categorias
                 WHERE activo = 1
                 ORDER BY orden ASC, nombre ASC"
            );
            sendResponse(true, $stmt->fetchAll());
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['nombre']) || empty($input['color'])) {
                sendResponse(false, null, 'nombre y color son requeridos', 400);
            }

            $stmt = $db->prepare("SELECT COALESCE(MAX(orden), 0) + 1 AS next FROM categorias");
            $stmt->execute();
            $next_orden = (int)$stmt->fetchColumn();

            $stmt = $db->prepare(
                "INSERT INTO categorias (nombre, color, icono, orden) VALUES (:nombre, :color, :icono, :orden)"
            );
            $stmt->execute([
                'nombre' => trim($input['nombre']),
                'color'  => $input['color'],
                'icono'  => isset($input['icono']) && $input['icono'] !== '' ? $input['icono'] : null,
                'orden'  => isset($input['orden']) && $input['orden'] !== '' ? (int)$input['orden'] : $next_orden
            ]);
            sendResponse(true, ['id' => $db->lastInsertId()], 'Categoría creada');
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['id'])) {
                sendResponse(false, null, 'id es requerido', 400);
            }

            $id     = (int)$input['id'];
            $fields = [];
            $params = ['id' => $id];

            if (isset($input['nombre']) && $input['nombre'] !== '') {
                $fields[] = 'nombre = :nombre'; $params['nombre'] = trim($input['nombre']);
            }
            if (isset($input['color']) && $input['color'] !== '') {
                $fields[] = 'color = :color'; $params['color'] = $input['color'];
            }
            if (array_key_exists('icono', $input)) {
                $fields[] = 'icono = :icono';
                $params['icono'] = ($input['icono'] !== '') ? $input['icono'] : null;
            }
            if (isset($input['orden'])) {
                $fields[] = 'orden = :orden'; $params['orden'] = (int)$input['orden'];
            }
            if (isset($input['activo'])) {
                $fields[] = 'activo = :activo'; $params['activo'] = $input['activo'] ? 1 : 0;
            }

            if (empty($fields)) {
                sendResponse(false, null, 'Sin campos para actualizar', 400);
            }

            $db->prepare("UPDATE categorias SET " . implode(', ', $fields) . " WHERE id = :id")->execute($params);
            sendResponse(true, null, 'Categoría actualizada');
            break;

        case 'DELETE':
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['id'])) {
                sendResponse(false, null, 'id es requerido', 400);
            }

            $id = (int)$input['id'];

            // Desasociar conceptos antes de eliminar
            $db->prepare("UPDATE conceptos SET categoria_id = NULL WHERE categoria_id = :id")->execute(['id' => $id]);
            $db->prepare("DELETE FROM categorias WHERE id = :id")->execute(['id' => $id]);

            sendResponse(true, null, 'Categoría eliminada');
            break;

        default:
            sendResponse(false, null, 'Método no permitido', 405);
    }

} catch (Exception $e) {
    sendResponse(false, null, 'Error: ' . $e->getMessage(), 500);
}

<?php
/**
 * API REST para Movimientos de Cuentas
 * GET  → lista movimientos (opcional: ?cuenta_id=X&limit=N)
 * POST → tipo=transferencia | tipo=extraccion
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
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

        // ── GET: listar movimientos ────────────────────────────
        case 'GET':
            $cuenta_id = isset($_GET['cuenta_id']) ? (int)$_GET['cuenta_id'] : null;
            $limit     = isset($_GET['limit'])     ? min((int)$_GET['limit'], 200) : 100;

            $where  = $cuenta_id
                ? "WHERE (m.cuenta_origen_id = :cid OR m.cuenta_destino_id = :cid2)"
                : "WHERE 1=1";
            $params = $cuenta_id ? ['cid' => $cuenta_id, 'cid2' => $cuenta_id] : [];

            $sql = "SELECT
                        m.id, m.fecha, m.tipo, m.importe, m.descripcion,
                        co.nombre AS cuenta_origen,  co.color AS color_origen,
                        cd.nombre AS cuenta_destino, cd.color AS color_destino,
                        rm.observaciones
                    FROM movimientos_cuenta m
                    LEFT JOIN cuentas co ON m.cuenta_origen_id  = co.id
                    LEFT JOIN cuentas cd ON m.cuenta_destino_id = cd.id
                    LEFT JOIN registros_mensuales rm ON m.registro_id = rm.id
                    $where
                    ORDER BY m.fecha DESC, m.id DESC
                    LIMIT $limit";

            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $movs = $stmt->fetchAll();

            foreach ($movs as &$m) {
                $m['importe'] = (float)$m['importe'];
            }
            unset($m);

            sendResponse(true, $movs);
            break;

        // ── POST: transferencia o extraccion ──────────────────
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            $tipo  = $input['tipo'] ?? '';

            // ── Transferencia entre cuentas ──────────────────
            if ($tipo === 'transferencia') {
                if (empty($input['cuenta_origen_id']) || empty($input['cuenta_destino_id']) || !isset($input['importe'])) {
                    sendResponse(false, null, 'Faltan datos: cuenta_origen_id, cuenta_destino_id, importe', 400);
                }

                $origen      = (int)$input['cuenta_origen_id'];
                $destino     = (int)$input['cuenta_destino_id'];
                $importe     = (float)$input['importe'];
                $descripcion = isset($input['descripcion']) ? trim($input['descripcion']) : null;

                if ($origen === $destino) {
                    sendResponse(false, null, 'Las cuentas de origen y destino deben ser distintas', 400);
                }
                if ($importe <= 0) {
                    sendResponse(false, null, 'El importe debe ser mayor a cero', 400);
                }

                // Validar saldo suficiente en cuenta origen
                $stmt_s = $db->prepare("SELECT saldo_actual, nombre FROM cuentas WHERE id = :id AND activo = 1");
                $stmt_s->execute(['id' => $origen]);
                $co = $stmt_s->fetch();
                if (!$co) sendResponse(false, null, 'Cuenta origen no encontrada', 404);
                if ((float)$co['saldo_actual'] < $importe) {
                    sendResponse(false, null,
                        'Saldo insuficiente en "' . $co['nombre'] . '". ' .
                        'Disponible: $' . number_format((float)$co['saldo_actual'], 2, ',', '.') . ' — ' .
                        'Requerido: $' . number_format($importe, 2, ',', '.'),
                        422);
                }

                $db->beginTransaction();
                try {
                    $db->prepare(
                        "INSERT INTO movimientos_cuenta (tipo, cuenta_origen_id, cuenta_destino_id, importe, descripcion)
                         VALUES ('transferencia', :orig, :dest, :imp, :desc)"
                    )->execute(['orig' => $origen, 'dest' => $destino, 'imp' => $importe, 'desc' => $descripcion]);

                    $db->prepare("UPDATE cuentas SET saldo_actual = saldo_actual - :imp, fecha_saldo = CURDATE() WHERE id = :id")
                       ->execute(['imp' => $importe, 'id' => $origen]);

                    $db->prepare("UPDATE cuentas SET saldo_actual = saldo_actual + :imp, fecha_saldo = CURDATE() WHERE id = :id")
                       ->execute(['imp' => $importe, 'id' => $destino]);

                    $db->commit();
                } catch (Exception $e) {
                    $db->rollBack();
                    throw $e;
                }

                sendResponse(true, null, 'Transferencia realizada correctamente');
            }

            // ── Extracción Efectivo ───────────────────────────────
            elseif ($tipo === 'extraccion') {
                if (empty($input['cuenta_id']) || !isset($input['importe'])) {
                    sendResponse(false, null, 'Faltan datos: cuenta_id, importe', 400);
                }

                $cuenta_id = (int)$input['cuenta_id'];
                $importe   = (float)$input['importe'];
                $fecha     = !empty($input['fecha']) ? $input['fecha'] : date('Y-m-d');
                $mes       = (int)date('n', strtotime($fecha));
                $anio      = (int)date('Y', strtotime($fecha));

                if ($importe <= 0) {
                    sendResponse(false, null, 'El importe debe ser mayor a cero', 400);
                }

                // Verificar cuenta y saldo antes de proceder
                $stmt_s2 = $db->prepare("SELECT saldo_actual, nombre, tipo FROM cuentas WHERE id = :id AND activo = 1");
                $stmt_s2->execute(['id' => $cuenta_id]);
                $cext = $stmt_s2->fetch();
                if (!$cext) sendResponse(false, null, 'Cuenta no encontrada', 404);
                if ($cext['tipo'] === 'billetera') {
                    sendResponse(false, null, 'Las extracciones de efectivo no están disponibles para billeteras virtuales', 400);
                }
                if ((float)$cext['saldo_actual'] < $importe) {
                    sendResponse(false, null,
                        'Saldo insuficiente en "' . $cext['nombre'] . '". ' .
                        'Disponible: $' . number_format((float)$cext['saldo_actual'], 2, ',', '.') . ' — ' .
                        'Requerido: $' . number_format($importe, 2, ',', '.'),
                        422);
                }

                // (validaciones de billetera y saldo ya hechas arriba)

                // Obtener concepto Extracción Efectivo
                $stmt_conc = $db->query("SELECT id FROM conceptos WHERE nombre = 'Extracción Efectivo' AND tipo = 'gasto' LIMIT 1");
                $concepto  = $stmt_conc->fetch();
                if (!$concepto) {
                    sendResponse(false, null, 'Concepto "Extracción Efectivo" no encontrado. Verificar migración.', 500);
                }
                $concepto_id = (int)$concepto['id'];

                $db->beginTransaction();
                try {
                    // Registro mensual como gasto pagado
                    $db->prepare(
                        "INSERT INTO registros_mensuales (concepto_id, mes, anio, fecha, importe, pagado, cuenta_id)
                         VALUES (:cid, :mes, :anio, :fecha, :imp, 1, :cuenta_id)"
                    )->execute([
                        'cid'      => $concepto_id,
                        'mes'      => $mes,
                        'anio'     => $anio,
                        'fecha'    => $fecha,
                        'imp'      => $importe,
                        'cuenta_id'=> $cuenta_id,
                    ]);
                    $registro_id = (int)$db->lastInsertId();

                    // Movimiento
                    $db->prepare(
                        "INSERT INTO movimientos_cuenta (tipo, cuenta_origen_id, importe, registro_id)
                         VALUES ('extraccion', :cid, :imp, :rid)"
                    )->execute(['cid' => $cuenta_id, 'imp' => $importe, 'rid' => $registro_id]);

                    // Actualizar saldo
                    $db->prepare("UPDATE cuentas SET saldo_actual = saldo_actual - :imp, fecha_saldo = CURDATE() WHERE id = :id")
                       ->execute(['imp' => $importe, 'id' => $cuenta_id]);

                    $db->commit();
                } catch (Exception $e) {
                    $db->rollBack();
                    throw $e;
                }

                sendResponse(true, null, 'Extracción registrada correctamente');
            }

            else {
                sendResponse(false, null, 'Tipo de movimiento no válido. Use: transferencia, extraccion', 400);
            }
            break;

        default:
            sendResponse(false, null, 'Método no permitido', 405);
    }

} catch (Exception $e) {
    sendResponse(false, null, 'Error: ' . $e->getMessage(), 500);
}

<?php
/**
 * API Vista Anual — totales de gastos por categoría × mes
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
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

try {
    $db   = Database::getInstance()->getConnection();
    $anio = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');

    $stmt = $db->prepare("
        SELECT
            COALESCE(con.categoria_id, 0)       AS categoria_id,
            COALESCE(cat.nombre, 'Sin categoría') AS categoria_nombre,
            COALESCE(cat.color, '#94a3b8')        AS categoria_color,
            COALESCE(cat.orden, 999)              AS categoria_orden,
            rm.mes,
            SUM(rm.importe)                       AS total
        FROM registros_mensuales rm
        JOIN  conceptos  con ON rm.concepto_id = con.id
        LEFT JOIN categorias cat ON con.categoria_id = cat.id
        WHERE rm.anio = :anio AND con.tipo = 'gasto'
        GROUP BY con.categoria_id, cat.nombre, cat.color, cat.orden, rm.mes
        ORDER BY COALESCE(cat.orden, 999) ASC, rm.mes ASC
    ");
    $stmt->execute(['anio' => $anio]);
    $rows = $stmt->fetchAll();

    // Estructura: categoria_id → {id, nombre, color, orden, meses[12], total}
    $catMap = [];
    foreach ($rows as $row) {
        $k = (int)$row['categoria_id'];
        if (!isset($catMap[$k])) {
            $catMap[$k] = [
                'id'     => $k,
                'nombre' => $row['categoria_nombre'],
                'color'  => $row['categoria_color'],
                'orden'  => (int)$row['categoria_orden'],
                'meses'  => array_fill(0, 12, 0),
                'total'  => 0.0,
            ];
        }
        $mes = (int)$row['mes'] - 1; // convertir a 0-indexed
        $catMap[$k]['meses'][$mes] = (float)$row['total'];
        $catMap[$k]['total'] += (float)$row['total'];
    }

    usort($catMap, fn($a, $b) => $a['orden'] <=> $b['orden']);

    // Totales por mes y total anual
    $totalesMes = array_fill(0, 12, 0.0);
    foreach ($catMap as $cat) {
        foreach ($cat['meses'] as $i => $v) {
            $totalesMes[$i] += $v;
        }
    }

    sendResponse(true, [
        'anio'        => $anio,
        'categorias'  => array_values($catMap),
        'totales_mes' => $totalesMes,
        'total_anual' => array_sum($totalesMes),
    ]);

} catch (Exception $e) {
    sendResponse(false, null, 'Error: ' . $e->getMessage(), 500);
}

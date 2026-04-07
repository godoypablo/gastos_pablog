<?php
require_once __DIR__ . '/auth.php';

function cifra_start_session() {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function cifra_validate_remember_cookie() {
    if (empty($_COOKIE['cifra_remember'])) return false;
    $parts = explode('|', $_COOKIE['cifra_remember']);
    if (count($parts) !== 3) return false;
    [$user, $expiry, $mac] = $parts;
    if ((int)$expiry < time()) return false;
    $expected = hash_hmac('sha256', $user . '|' . $expiry, AUTH_SECRET);
    if (!hash_equals($expected, $mac)) return false;
    return $user === AUTH_USER;
}

function cifra_set_remember_cookie() {
    $user   = AUTH_USER;
    $expiry = time() + REMEMBER_DAYS * 86400;
    $mac    = hash_hmac('sha256', $user . '|' . $expiry, AUTH_SECRET);
    setcookie('cifra_remember', $user . '|' . $expiry . '|' . $mac, [
        'expires'  => $expiry,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function cifra_clear_remember_cookie() {
    setcookie('cifra_remember', '', ['expires' => time() - 3600, 'path' => '/']);
}

// Para páginas PHP: redirige a login si no está autenticado
function require_auth_or_redirect() {
    cifra_start_session();
    if (!empty($_SESSION['logged_in'])) return;
    if (cifra_validate_remember_cookie()) {
        $_SESSION['logged_in'] = true;
        return;
    }
    header('Location: /login.php');
    exit;
}

// Para APIs: devuelve 401 JSON si no está autenticado
function require_auth_or_401() {
    cifra_start_session();
    if (!empty($_SESSION['logged_in'])) return;
    if (cifra_validate_remember_cookie()) {
        $_SESSION['logged_in'] = true;
        return;
    }
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

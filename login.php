<?php
require_once 'config/auth_check.php';
cifra_start_session();

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim($_POST['usuario'] ?? '');
    $pass = $_POST['password'] ?? '';
    $remember = !empty($_POST['recordarme']);

    if ($user === AUTH_USER && password_verify($pass, AUTH_PASS_HASH)) {
        $_SESSION['logged_in'] = true;
        if ($remember) cifra_set_remember_cookie();
        header('Location: index.php');
        exit;
    } else {
        $error = 'Usuario o contraseña incorrectos.';
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cifra — Iniciar sesión</title>
    <script>
        const t = localStorage.getItem('cifra-theme');
        if (t) document.documentElement.setAttribute('data-bs-theme', t);
    </script>
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#1F2A37">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Montserrat:wght@600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.2/font/bootstrap-icons.css">
    <link rel="stylesheet" href="assets/css/styles.css">
    <style>
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .login-card { width: 100%; max-width: 380px; }
    </style>
</head>
<body class="bg-body-secondary">
    <div class="login-card px-3">
        <div class="text-center mb-4">
            <h1 class="h3 cifra-logo text-primary">
                <i class="bi bi-bar-chart-fill me-2"></i>Cifra
            </h1>
            <p class="text-muted small">Control financiero personal</p>
        </div>
        <div class="card shadow-sm">
            <div class="card-body p-4">
                <h2 class="h5 mb-4">Iniciar sesión</h2>
                <?php if ($error): ?>
                    <div class="alert alert-danger py-2 small"><?= htmlspecialchars($error) ?></div>
                <?php endif; ?>
                <form method="POST" autocomplete="on">
                    <div class="mb-3">
                        <label for="usuario" class="form-label">Usuario</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-person"></i></span>
                            <input type="text" id="usuario" name="usuario" class="form-control"
                                   value="<?= htmlspecialchars($_POST['usuario'] ?? '') ?>"
                                   autocomplete="username" required autofocus>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="password" class="form-label">Contraseña</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-lock"></i></span>
                            <input type="password" id="password" name="password" class="form-control"
                                   autocomplete="current-password" required>
                        </div>
                    </div>
                    <div class="mb-4 form-check">
                        <input type="checkbox" class="form-check-input" id="recordarme" name="recordarme"
                               <?= !empty($_POST['recordarme']) ? 'checked' : '' ?>>
                        <label class="form-check-label" for="recordarme">Recordarme por <?= REMEMBER_DAYS ?> días</label>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="bi bi-box-arrow-in-right me-2"></i>Entrar
                    </button>
                </form>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>

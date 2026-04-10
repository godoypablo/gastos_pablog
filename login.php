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
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: radial-gradient(ellipse at 60% 20%, rgba(99,102,241,0.08) 0%, transparent 60%),
                        radial-gradient(ellipse at 10% 80%, rgba(16,185,129,0.06) 0%, transparent 50%);
        }
        [data-bs-theme="dark"] body {
            background: radial-gradient(ellipse at 60% 20%, rgba(99,102,241,0.12) 0%, transparent 60%),
                        radial-gradient(ellipse at 10% 80%, rgba(16,185,129,0.08) 0%, transparent 50%);
        }
        .login-wrap {
            width: 100%;
            max-width: 400px;
            padding: 1rem;
        }
        .login-logo {
            font-family: 'Montserrat', sans-serif;
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .login-logo .logo-dot {
            color: #6366f1;
        }
        .login-card {
            border: none;
            border-radius: 1rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 1.5px 4px rgba(0,0,0,0.06);
        }
        [data-bs-theme="dark"] .login-card {
            box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 1.5px 4px rgba(0,0,0,0.2);
        }
        .login-card .card-body {
            padding: 2rem 2rem 1.75rem;
        }
        .login-divider {
            height: 3px;
            border-radius: 2px;
            background: linear-gradient(90deg, #6366f1 0%, #10b981 100%);
            margin-bottom: 1.75rem;
        }
        .form-control, .input-group-text {
            border-radius: 0.5rem !important;
        }
        .input-group .input-group-text {
            border-right: none;
            background: transparent;
            color: var(--bs-secondary-color);
        }
        .input-group .form-control {
            border-left: none;
        }
        .input-group .form-control:focus {
            border-color: #6366f1;
            box-shadow: 0 0 0 0.2rem rgba(99,102,241,0.15);
        }
        .input-group:focus-within .input-group-text {
            border-color: #6366f1;
            color: #6366f1;
        }
        .btn-toggle-pass {
            border-left: none;
            background: transparent;
            color: var(--bs-secondary-color);
            border-color: var(--bs-border-color);
            border-radius: 0 0.5rem 0.5rem 0 !important;
        }
        .btn-toggle-pass:hover { color: #6366f1; background: transparent; }
        .input-group:focus-within .btn-toggle-pass { border-color: #6366f1; }
        .btn-ingresar {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            border: none;
            border-radius: 0.6rem;
            font-weight: 600;
            letter-spacing: 0.3px;
            padding: 0.6rem;
            transition: opacity 0.15s, transform 0.1s;
        }
        .btn-ingresar:hover { opacity: 0.92; transform: translateY(-1px); }
        .btn-ingresar:active { transform: translateY(0); }
        .login-footer {
            font-size: 0.75rem;
            color: var(--bs-secondary-color);
            text-align: center;
            margin-top: 1.5rem;
        }
    </style>
</head>
<body class="bg-body-secondary">
    <div class="login-wrap">

        <!-- Logo -->
        <div class="text-center mb-4">
            <div class="login-logo mb-1">
                <i class="bi bi-bar-chart-fill" style="color:#6366f1;font-size:1.8rem;vertical-align:middle;margin-right:0.3rem"></i>Cifra<span class="logo-dot">.</span>
            </div>
            <p class="text-muted small mb-0">Control financiero personal</p>
        </div>

        <!-- Card -->
        <div class="card login-card">
            <div class="card-body">
                <div class="login-divider"></div>

                <?php if ($error): ?>
                    <div class="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-3">
                        <i class="bi bi-exclamation-circle-fill flex-shrink-0"></i>
                        <?= htmlspecialchars($error) ?>
                    </div>
                <?php endif; ?>

                <form method="POST" autocomplete="on">
                    <!-- Usuario -->
                    <div class="mb-3">
                        <label for="usuario" class="form-label small fw-medium">Usuario</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-person"></i></span>
                            <input type="text" id="usuario" name="usuario" class="form-control"
                                   placeholder="Tu usuario"
                                   value="<?= htmlspecialchars($_POST['usuario'] ?? '') ?>"
                                   autocomplete="username" required autofocus>
                        </div>
                    </div>

                    <!-- Contraseña -->
                    <div class="mb-3">
                        <label for="password" class="form-label small fw-medium">Contraseña</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-lock"></i></span>
                            <input type="password" id="password" name="password" class="form-control"
                                   placeholder="••••••••"
                                   autocomplete="current-password" required>
                            <button type="button" class="btn btn-outline-secondary btn-toggle-pass"
                                    id="btnTogglePass" tabindex="-1" aria-label="Mostrar contraseña">
                                <i class="bi bi-eye" id="iconTogglePass"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Recordarme -->
                    <div class="mb-4 form-check">
                        <input type="checkbox" class="form-check-input" id="recordarme" name="recordarme"
                               <?= !empty($_POST['recordarme']) ? 'checked' : '' ?>>
                        <label class="form-check-label small" for="recordarme">
                            Recordarme por <?= REMEMBER_DAYS ?> días
                        </label>
                    </div>

                    <button type="submit" class="btn btn-primary btn-ingresar w-100">
                        <i class="bi bi-box-arrow-in-right me-2"></i>Ingresar
                    </button>
                </form>
            </div>
        </div>

        <div class="login-footer">Cifra &mdash; finanzas personales</div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        const btnToggle = document.getElementById('btnTogglePass');
        const inputPass = document.getElementById('password');
        const iconToggle = document.getElementById('iconTogglePass');

        btnToggle.addEventListener('click', () => {
            const visible = inputPass.type === 'text';
            inputPass.type = visible ? 'password' : 'text';
            iconToggle.className = visible ? 'bi bi-eye' : 'bi bi-eye-slash';
        });
    </script>
</body>
</html>

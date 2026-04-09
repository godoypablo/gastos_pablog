-- Migración: Módulo de Cuentas Bancarias
-- Ejecutar una sola vez sobre la base de datos gastos_personales

USE gastos_personales;

-- ── Tabla cuentas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    banco       VARCHAR(100),
    tipo        ENUM('cuenta_corriente','caja_ahorro','billetera') NOT NULL DEFAULT 'caja_ahorro',
    color       VARCHAR(7)   NOT NULL DEFAULT '#6c757d',
    saldo_actual DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    fecha_saldo  DATE,
    activo      TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Cuentas iniciales ─────────────────────────────────────────
INSERT INTO cuentas (nombre, banco, tipo, color) VALUES
('Entre Ríos',   'Banco de Entre Ríos', 'cuenta_corriente', '#1a6eb5'),
('Santander',    'Banco Santander',      'caja_ahorro',      '#ec0000'),
('Personal Pay', 'Personal Pay',         'billetera',        '#7b2d8b');

-- ── Columna cuenta_id en registros_mensuales ──────────────────
ALTER TABLE registros_mensuales
    ADD COLUMN cuenta_id INT NULL AFTER fecha_vencimiento,
    ADD CONSTRAINT fk_rm_cuenta
        FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL;

-- Migración: Movimientos de Cuentas
-- Ejecutar una sola vez sobre la base de datos gastos_personales

USE gastos_personales;

-- ── Tabla movimientos_cuenta ───────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_cuenta (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    fecha             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo              ENUM('ingreso','transferencia','pago_gasto','extraccion') NOT NULL,
    cuenta_origen_id  INT NULL,
    cuenta_destino_id INT NULL,
    importe           DECIMAL(12,2) NOT NULL,
    descripcion       VARCHAR(255),
    registro_id       INT NULL,
    CONSTRAINT fk_mov_origen  FOREIGN KEY (cuenta_origen_id)  REFERENCES cuentas(id) ON DELETE SET NULL,
    CONSTRAINT fk_mov_destino FOREIGN KEY (cuenta_destino_id) REFERENCES cuentas(id) ON DELETE SET NULL,
    CONSTRAINT fk_mov_reg     FOREIGN KEY (registro_id)       REFERENCES registros_mensuales(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Cuenta por defecto en conceptos ───────────────────────────
ALTER TABLE conceptos
    ADD COLUMN cuenta_id_default INT NULL AFTER categoria_id,
    ADD CONSTRAINT fk_conceptos_cuenta_default
        FOREIGN KEY (cuenta_id_default) REFERENCES cuentas(id) ON DELETE SET NULL;

-- ── Asignar cuentas por defecto a sueldos ─────────────────────
UPDATE conceptos
SET cuenta_id_default = (SELECT id FROM cuentas WHERE banco = 'Banco Santander' LIMIT 1)
WHERE nombre = 'Sueldo HSC S.A.';

UPDATE conceptos
SET cuenta_id_default = (SELECT id FROM cuentas WHERE banco = 'Banco de Entre Ríos' LIMIT 1)
WHERE nombre = 'Sueldo TCER';

-- ── Concepto Extracción ATM (gasto, permite_multiples=1) ───────
INSERT INTO conceptos (nombre, tipo, orden, activo, permite_multiples)
SELECT 'Extracción ATM', 'gasto', 999, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM conceptos WHERE nombre = 'Extracción ATM');

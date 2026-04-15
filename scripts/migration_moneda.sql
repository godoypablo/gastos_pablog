-- Migración: Soporte de dos monedas (ARS / USD)
-- Ejecutar una sola vez sobre la base de datos gastos_personales

USE gastos_personales;

-- Columna moneda en conceptos y cuentas
ALTER TABLE conceptos ADD COLUMN moneda ENUM('ARS','USD') NOT NULL DEFAULT 'ARS' AFTER tipo;
ALTER TABLE cuentas   ADD COLUMN moneda ENUM('ARS','USD') NOT NULL DEFAULT 'ARS' AFTER tipo;

-- Conceptos en dólares
UPDATE conceptos SET moneda = 'USD' WHERE nombre IN ('Claude', 'YouTube');

-- Nueva cuenta Santander USD (la actual Santander queda como ARS)
INSERT INTO cuentas (nombre, banco, tipo, color, moneda, saldo_actual, fecha_saldo)
VALUES ('Santander USD', 'Banco Santander', 'caja_ahorro', '#ec0000', 'USD', 0.00, CURDATE());

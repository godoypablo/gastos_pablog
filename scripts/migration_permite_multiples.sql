-- Migración: soporte para registros múltiples por concepto/mes
-- Ejecutar: mysql -u root -p gastos_personales < scripts/migration_permite_multiples.sql

USE gastos_personales;

-- 1. Agregar campo permite_multiples a conceptos
ALTER TABLE conceptos
    ADD COLUMN permite_multiples BOOLEAN NOT NULL DEFAULT FALSE
    AFTER activo;

-- 2. Agregar campo fecha a registros_mensuales
ALTER TABLE registros_mensuales
    ADD COLUMN fecha DATE NULL
    AFTER anio;

-- 3. Quitar constraint única para permitir múltiples registros por concepto/mes
--    Primero crear índice regular en concepto_id (necesario para la foreign key)
ALTER TABLE registros_mensuales ADD INDEX idx_concepto_id (concepto_id);
ALTER TABLE registros_mensuales DROP INDEX uk_concepto_mes_anio;

-- 4. Marcar Supermercado como permite_multiples
UPDATE conceptos SET permite_multiples = 1 WHERE nombre = 'Supermercado';

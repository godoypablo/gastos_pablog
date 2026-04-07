-- Agrega columna pagado a registros_mensuales
-- Indica si el gasto del mes fue abonado

ALTER TABLE registros_mensuales
    ADD COLUMN pagado TINYINT(1) NOT NULL DEFAULT 0 AFTER observaciones;

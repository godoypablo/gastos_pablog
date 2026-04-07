-- Agrega columna fecha_vencimiento a registros_mensuales
-- Si la fecha de vencimiento es anterior a hoy y el registro no está pagado,
-- la fila se muestra en rojo en el frontend.

ALTER TABLE registros_mensuales
    ADD COLUMN fecha_vencimiento DATE NULL DEFAULT NULL AFTER fecha;

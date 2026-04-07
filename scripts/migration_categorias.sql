-- Migración: agregar categoria_id a conceptos
-- Ejecutar UNA sola vez. Si ya existe la columna, omitir el ALTER.

ALTER TABLE conceptos
    ADD COLUMN categoria_id INT NULL AFTER tipo;

ALTER TABLE conceptos
    ADD CONSTRAINT fk_concepto_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX idx_conceptos_categoria ON conceptos(categoria_id);

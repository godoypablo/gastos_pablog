-- Base de datos para Sistema de Gastos Personales
-- Creado: Diciembre 2025

CREATE DATABASE IF NOT EXISTS gastos_personales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gastos_personales;

-- Tabla de conceptos (ingresos y gastos)
CREATE TABLE IF NOT EXISTS conceptos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo ENUM('ingreso', 'gasto') NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tipo (tipo),
    INDEX idx_orden (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de registros mensuales
CREATE TABLE IF NOT EXISTS registros_mensuales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    concepto_id INT NOT NULL,
    mes INT NOT NULL COMMENT 'Mes (1-12)',
    anio INT NOT NULL COMMENT 'Año (ej: 2025)',
    importe DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (concepto_id) REFERENCES conceptos(id) ON DELETE CASCADE,
    UNIQUE KEY uk_concepto_mes_anio (concepto_id, mes, anio),
    INDEX idx_mes_anio (mes, anio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar conceptos predefinidos (INGRESOS)
INSERT INTO conceptos (nombre, tipo, orden) VALUES
('Sueldo HSC', 'ingreso', 1),
('Sueldo TCER', 'ingreso', 2),
('IPEM', 'ingreso', 3),
('Ahorro', 'ingreso', 4);

-- Insertar conceptos predefinidos (GASTOS)
INSERT INTO conceptos (nombre, tipo, orden) VALUES
('Cuota Alimentaria', 'gasto', 1),
('Rowing', 'gasto', 2),
('Mastercard', 'gasto', 3),
('Alquiler Departamento', 'gasto', 4),
('Supermercado', 'gasto', 5),
('YouTube', 'gasto', 6),
('Spotify', 'gasto', 7),
('Elena', 'gasto', 8),
('ATER Etios', 'gasto', 9),
('ATER Tornado', 'gasto', 10),
('Enersa', 'gasto', 11),
('Rivadavia Etios', 'gasto', 12),
('Rivadavia Tornado', 'gasto', 13),
('Redengas', 'gasto', 14),
('Personal Flow (Int.&C)', 'gasto', 15),
('Monotributo Afip', 'gasto', 16),
('Roy Udrizar', 'gasto', 17),
('Coprocier', 'gasto', 18),
('Nafta', 'gasto', 19),
('Aire Acondicionado', 'gasto', 20),
('Remedios', 'gasto', 21),
('Cochera', 'gasto', 22),
('Gimnasio', 'gasto', 23),
('Gastos', 'gasto', 24);

-- Vista para obtener resumen mensual
CREATE OR REPLACE VIEW vista_resumen_mensual AS
SELECT
    rm.mes,
    rm.anio,
    SUM(CASE WHEN c.tipo = 'ingreso' THEN rm.importe ELSE 0 END) as total_ingresos,
    SUM(CASE WHEN c.tipo = 'gasto' THEN rm.importe ELSE 0 END) as total_gastos,
    SUM(CASE WHEN c.tipo = 'ingreso' THEN rm.importe ELSE 0 END) -
    SUM(CASE WHEN c.tipo = 'gasto' THEN rm.importe ELSE 0 END) as saldo
FROM registros_mensuales rm
INNER JOIN conceptos c ON rm.concepto_id = c.id
GROUP BY rm.mes, rm.anio;

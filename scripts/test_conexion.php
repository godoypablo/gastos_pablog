<?php
/**
 * Script de prueba de conexión a la base de datos
 * Ejecutar desde línea de comandos: php test_conexion.php
 */

echo "=== TEST DE CONEXIÓN A BASE DE DATOS ===\n\n";

// Configuración
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');

// Test 1: Conectar al servidor MySQL
echo "1. Probando conexión al servidor MySQL...\n";
try {
    $conn = new PDO("mysql:host=" . DB_HOST, DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "   ✓ Conexión al servidor MySQL exitosa\n\n";
} catch (PDOException $e) {
    echo "   ✗ Error al conectar al servidor MySQL: " . $e->getMessage() . "\n";
    echo "   SOLUCIÓN: Verifica que MySQL esté ejecutándose y las credenciales sean correctas.\n";
    exit(1);
}

// Test 2: Verificar si existe la base de datos
echo "2. Verificando existencia de la base de datos 'gastos_personales'...\n";
try {
    $stmt = $conn->query("SHOW DATABASES LIKE 'gastos_personales'");
    $exists = $stmt->fetch();

    if ($exists) {
        echo "   ✓ Base de datos 'gastos_personales' existe\n\n";
    } else {
        echo "   ✗ Base de datos 'gastos_personales' NO existe\n";
        echo "   SOLUCIÓN: Ejecuta el script schema.sql para crear la base de datos:\n";
        echo "   mysql -u root -p < schema.sql\n\n";

        echo "¿Deseas crear la base de datos ahora? (s/n): ";
        $handle = fopen("php://stdin", "r");
        $line = fgets($handle);
        if (trim($line) == 's' || trim($line) == 'S') {
            echo "\nCreando base de datos...\n";
            $sql = file_get_contents(__DIR__ . '/schema.sql');
            if ($sql) {
                try {
                    $conn->exec($sql);
                    echo "   ✓ Base de datos creada exitosamente\n\n";
                } catch (PDOException $e) {
                    echo "   ✗ Error al crear la base de datos: " . $e->getMessage() . "\n";
                    exit(1);
                }
            } else {
                echo "   ✗ No se pudo leer el archivo schema.sql\n";
                exit(1);
            }
        } else {
            exit(1);
        }
    }
} catch (PDOException $e) {
    echo "   ✗ Error al verificar la base de datos: " . $e->getMessage() . "\n";
    exit(1);
}

// Test 3: Conectar a la base de datos específica
echo "3. Probando conexión a la base de datos 'gastos_personales'...\n";
try {
    $conn = new PDO("mysql:host=" . DB_HOST . ";dbname=gastos_personales;charset=utf8mb4", DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "   ✓ Conexión a la base de datos exitosa\n\n";
} catch (PDOException $e) {
    echo "   ✗ Error al conectar a la base de datos: " . $e->getMessage() . "\n";
    exit(1);
}

// Test 4: Verificar tablas
echo "4. Verificando existencia de tablas...\n";
$tablas_requeridas = ['conceptos', 'registros_mensuales'];
$tablas_encontradas = true;

foreach ($tablas_requeridas as $tabla) {
    try {
        $stmt = $conn->query("SHOW TABLES LIKE '$tabla'");
        $exists = $stmt->fetch();

        if ($exists) {
            echo "   ✓ Tabla '$tabla' existe\n";
        } else {
            echo "   ✗ Tabla '$tabla' NO existe\n";
            $tablas_encontradas = false;
        }
    } catch (PDOException $e) {
        echo "   ✗ Error al verificar tabla '$tabla': " . $e->getMessage() . "\n";
        $tablas_encontradas = false;
    }
}

if (!$tablas_encontradas) {
    echo "\n   SOLUCIÓN: Ejecuta el script schema.sql:\n";
    echo "   mysql -u root -p < schema.sql\n";
    exit(1);
}

echo "\n";

// Test 5: Verificar datos de prueba
echo "5. Verificando datos en tabla 'conceptos'...\n";
try {
    $stmt = $conn->query("SELECT COUNT(*) as total FROM conceptos");
    $result = $stmt->fetch();
    $total = $result['total'];

    if ($total > 0) {
        echo "   ✓ Encontrados $total conceptos en la base de datos\n";

        // Mostrar algunos conceptos
        $stmt = $conn->query("SELECT id, nombre, tipo FROM conceptos LIMIT 5");
        echo "\n   Ejemplos:\n";
        while ($row = $stmt->fetch()) {
            echo "     - [{$row['tipo']}] {$row['nombre']}\n";
        }
    } else {
        echo "   ⚠ No hay conceptos en la base de datos\n";
        echo "   NOTA: Esto es normal en una instalación nueva. Los conceptos se crearon con el schema.sql\n";
    }
} catch (PDOException $e) {
    echo "   ✗ Error al consultar conceptos: " . $e->getMessage() . "\n";
}

echo "\n=== TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE ===\n";
echo "\nPuedes iniciar el servidor web ahora:\n";
echo "php -S localhost:8000\n\n";

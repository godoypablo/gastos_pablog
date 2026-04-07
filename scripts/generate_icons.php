<?php
/**
 * Generador de íconos PWA — Cifra
 * Compatible con PHP 7.x y 8.x
 *
 * Ejecutar una sola vez:
 *   php scripts/generate_icons.php       (CLI)
 *   https://tu-sitio/scripts/generate_icons.php  (browser)
 */

// Diagnóstico previo
$errores = [];

if (!function_exists('imagecreatetruecolor')) {
    $errores[] = "La extensión GD no está habilitada en este servidor PHP.";
}

$outputDir = realpath(__DIR__ . '/../assets/icons');
if (!$outputDir) {
    // Intentar crear el directorio
    @mkdir(__DIR__ . '/../assets/icons', 0755, true);
    $outputDir = realpath(__DIR__ . '/../assets/icons');
}
if (!$outputDir) {
    $errores[] = "No se pudo encontrar/crear el directorio assets/icons/.";
} elseif (!is_writable($outputDir)) {
    $errores[] = "El directorio assets/icons/ no tiene permisos de escritura.";
}

if (!empty($errores)) {
    header('Content-Type: text/plain');
    echo "ERROR — no se pudieron generar los íconos:\n\n";
    foreach ($errores as $e) echo "  • $e\n";
    echo "\nPHP version: " . PHP_VERSION . "\n";
    echo "GD info: " . (function_exists('gd_info') ? json_encode(gd_info()) : 'no disponible') . "\n";
    exit(1);
}

/**
 * Crea la imagen del ícono Cifra.
 * Devuelve resource (PHP 7) o GdImage (PHP 8) — sin tipo declarado para compatibilidad.
 */
function crearIconoCifra(int $size, bool $maskable = false)
{
    $img = imagecreatetruecolor($size, $size);
    imagealphablending($img, true);
    imagesavealpha($img, true);

    // Paleta Cifra
    $bg    = imagecolorallocate($img, 31,  42,  55);   // #1F2A37
    $azul  = imagecolorallocate($img, 37,  99,  235);  // #2563EB
    $azul2 = imagecolorallocate($img, 59,  130, 246);  // #3B82F6
    $verde = imagecolorallocate($img, 22,  163, 74);   // #16A34A

    // Fondo completo
    imagefilledrectangle($img, 0, 0, $size - 1, $size - 1, $bg);

    // Esquinas redondeadas solo para ícono normal (maskable necesita fondo completo)
    if (!$maskable) {
        $r = (int)($size * 0.19);
        // Rellenar las 4 esquinas con el color de fondo — luego se recortan con círculos
        imagefilledellipse($img, $r,          $r,          $r * 2, $r * 2, $bg);
        imagefilledellipse($img, $size - $r,  $r,          $r * 2, $r * 2, $bg);
        imagefilledellipse($img, $r,          $size - $r,  $r * 2, $r * 2, $bg);
        imagefilledellipse($img, $size - $r,  $size - $r,  $r * 2, $r * 2, $bg);
        imagefilledrectangle($img, $r,   0,         $size - $r, $size - 1, $bg);
        imagefilledrectangle($img, 0,    $r,        $size - 1,  $size - $r, $bg);
    }

    // Área útil con padding
    $pad  = (int)($size * ($maskable ? 0.20 : 0.13));
    $w    = $size - $pad * 2;
    $h    = $size - $pad * 2;
    $base = $pad + $h;

    // Tres barras del gráfico
    $bw  = (int)($w * 0.22);
    $gap = (int)($w * 0.07);

    $x1 = $pad;
    $h1 = (int)($h * 0.52);
    imagefilledrectangle($img, $x1, $base - $h1, $x1 + $bw, $base, $azul);

    $x2 = $x1 + $bw + $gap;
    $h2 = (int)($h * 0.72);
    imagefilledrectangle($img, $x2, $base - $h2, $x2 + $bw, $base, $azul2);

    $x3 = $x2 + $bw + $gap;
    $h3 = (int)($h * 0.90);
    imagefilledrectangle($img, $x3, $base - $h3, $x3 + $bw, $base, $azul);

    // Línea de tendencia
    $lw = max(3, (int)($size * 0.025));
    imagesetthickness($img, $lw);

    $off = (int)($size * 0.07);
    $p1x = $x1 + (int)($bw / 2);  $p1y = $base - $h1 - $off;
    $p3x = $x3 + (int)($bw / 2);  $p3y = $base - $h3 - $off;
    imageline($img, $p1x, $p1y, $p3x, $p3y, $verde);

    // Punto al final de la línea
    $pr = max(6, (int)($size * 0.055));
    imagefilledellipse($img, $p3x, $p3y, $pr * 2, $pr * 2, $verde);

    return $img;
}

$iconos = [
    ['file' => 'icon-192.png',         'size' => 192, 'maskable' => false],
    ['file' => 'icon-512.png',          'size' => 512, 'maskable' => false],
    ['file' => 'icon-512-maskable.png', 'size' => 512, 'maskable' => true],
    ['file' => 'apple-touch-icon.png',  'size' => 180, 'maskable' => false],
];

$generados = [];
$fallos    = [];

foreach ($iconos as $def) {
    $path = $outputDir . '/' . $def['file'];
    $img  = crearIconoCifra($def['size'], $def['maskable']);
    $ok   = imagepng($img, $path, 6);
    imagedestroy($img);
    if ($ok) {
        $generados[] = $def['file'] . ' (' . $def['size'] . 'px)';
    } else {
        $fallos[] = $def['file'];
    }
}

// Respuesta
if (PHP_SAPI === 'cli') {
    if ($generados) {
        echo "Íconos generados en assets/icons/:\n";
        foreach ($generados as $f) echo "  ✓ $f\n";
    }
    if ($fallos) {
        echo "Fallos:\n";
        foreach ($fallos as $f) echo "  ✗ $f\n";
    }
} else {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Cifra — Íconos PWA</title>
    <style>
        body { font-family: monospace; padding: 2rem; background: #1F2A37; color: #F1F5F9; }
        .ok  { color: #22C55E; }
        .err { color: #F87171; }
    </style></head><body>';
    echo '<h2>Íconos PWA — Cifra</h2>';
    if ($generados) {
        echo '<p class="ok">✅ Generados correctamente:</p><ul>';
        foreach ($generados as $f) echo "<li class='ok'>$f</li>";
        echo '</ul>';
    }
    if ($fallos) {
        echo '<p class="err">❌ Fallos al escribir:</p><ul>';
        foreach ($fallos as $f) echo "<li class='err'>$f</li>";
        echo '</ul>';
    }
    echo '<p style="margin-top:1.5rem;opacity:.6">PHP ' . PHP_VERSION . ' — Podés cerrar esta página.</p>';
    echo '</body></html>';
}

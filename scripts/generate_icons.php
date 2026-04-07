<?php
/**
 * Generador de íconos PWA — Cifra
 *
 * Ejecutar UNA sola vez para crear los archivos PNG en assets/icons/:
 *   php scripts/generate_icons.php
 * O desde el browser: https://tu-sitio/scripts/generate_icons.php
 *
 * Requiere la extensión GD de PHP (habilitada por defecto en la mayoría de hostings).
 */

if (!function_exists('imagecreatetruecolor')) {
    $msg = "Error: la extensión GD no está disponible en este servidor.\n";
    header('Content-Type: text/plain');
    die($msg);
}

function crearIconoCifra(int $size, bool $maskable = false): GdImage
{
    $img = imagecreatetruecolor($size, $size);
    imagesavealpha($img, true);

    // Paleta Cifra
    $bg    = imagecolorallocate($img, 31,  42,  55);   // #1F2A37
    $azul  = imagecolorallocate($img, 37,  99,  235);  // #2563EB
    $azul2 = imagecolorallocate($img, 59,  130, 246);  // #3B82F6
    $verde = imagecolorallocate($img, 22,  163, 74);   // #16A34A

    // Fondo completo
    imagefill($img, 0, 0, $bg);

    // Esquinas redondeadas (no aplica para maskable que necesita fondo completo)
    if (!$maskable) {
        $r = (int)($size * 0.19);
        // GD no soporta roundrect nativo; se simula pintando las esquinas
        // con el color del canvas exterior (blanco → se usará transparencia al exportar PNG)
        $trans = imagecolorallocatealpha($img, 255, 255, 255, 127);

        // Esquina superior izquierda
        imagefilledrectangle($img, 0, 0, $r - 1, $r - 1, $trans);
        imagefilledellipse($img, $r, $r, $r * 2, $r * 2, $bg);

        // Esquina superior derecha
        imagefilledrectangle($img, $size - $r, 0, $size - 1, $r - 1, $trans);
        imagefilledellipse($img, $size - $r, $r, $r * 2, $r * 2, $bg);

        // Esquina inferior izquierda
        imagefilledrectangle($img, 0, $size - $r, $r - 1, $size - 1, $trans);
        imagefilledellipse($img, $r, $size - $r, $r * 2, $r * 2, $bg);

        // Esquina inferior derecha
        imagefilledrectangle($img, $size - $r, $size - $r, $size - 1, $size - 1, $trans);
        imagefilledellipse($img, $size - $r, $size - $r, $r * 2, $r * 2, $bg);

        // Rellenos del cuerpo (cubren las áreas mal pintadas)
        imagefilledrectangle($img, $r, 0, $size - $r, $size, $bg);
        imagefilledrectangle($img, 0, $r, $size, $size - $r, $bg);
    }

    // Área útil con padding (maskable usa 20% safe zone, normal 13%)
    $pad = (int)($size * ($maskable ? 0.20 : 0.13));
    $w   = $size - $pad * 2;
    $h   = $size - $pad * 2;
    $base = $pad + $h;   // y de la línea base

    // Tres barras del gráfico (proporcionales al tamaño)
    $bw  = (int)($w * 0.22);
    $gap = (int)($w * 0.07);

    // Barra izquierda (52% de altura)
    $x1 = $pad;
    $h1 = (int)($h * 0.52);
    imagefilledrectangle($img, $x1, $base - $h1, $x1 + $bw, $base, $azul);

    // Barra central (72%)
    $x2 = $x1 + $bw + $gap;
    $h2 = (int)($h * 0.72);
    imagefilledrectangle($img, $x2, $base - $h2, $x2 + $bw, $base, $azul2);

    // Barra derecha (90%)
    $x3 = $x2 + $bw + $gap;
    $h3 = (int)($h * 0.90);
    imagefilledrectangle($img, $x3, $base - $h3, $x3 + $bw, $base, $azul);

    // Línea de tendencia ascendente
    $lw = max(3, (int)($size * 0.025));
    imagesetthickness($img, $lw);

    $offset = (int)($size * 0.07);
    $p1x = $x1 + (int)($bw / 2);  $p1y = $base - $h1 - $offset;
    $p3x = $x3 + (int)($bw / 2);  $p3y = $base - $h3 - $offset;
    imageline($img, $p1x, $p1y, $p3x, $p3y, $verde);

    // Punto en el extremo derecho de la línea
    $pr = max(6, (int)($size * 0.055));
    imagefilledellipse($img, $p3x, $p3y, $pr * 2, $pr * 2, $verde);

    return $img;
}

// Destino
$outputDir = __DIR__ . '/../assets/icons';
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

$iconos = [
    ['file' => 'icon-192.png',         'size' => 192, 'maskable' => false],
    ['file' => 'icon-512.png',          'size' => 512, 'maskable' => false],
    ['file' => 'icon-512-maskable.png', 'size' => 512, 'maskable' => true],
    ['file' => 'apple-touch-icon.png',  'size' => 180, 'maskable' => false],
];

$generados = [];
foreach ($iconos as $def) {
    $img  = crearIconoCifra($def['size'], $def['maskable']);
    $path = $outputDir . '/' . $def['file'];
    imagepng($img, $path, 6);
    imagedestroy($img);
    $generados[] = $def['file'] . ' (' . $def['size'] . 'x' . $def['size'] . ')';
}

if (PHP_SAPI === 'cli') {
    echo "Íconos PWA generados en assets/icons/:\n";
    foreach ($generados as $f) {
        echo "  ✓ $f\n";
    }
    echo "\n";
} else {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Cifra — Íconos PWA</title>';
    echo '<style>body{font-family:monospace;padding:2rem;background:#1F2A37;color:#F1F5F9}</style></head><body>';
    echo '<h2>✅ Íconos PWA generados</h2><ul>';
    foreach ($generados as $f) {
        echo "<li>$f</li>";
    }
    echo '</ul><p>Podés cerrar esta página.</p></body></html>';
}

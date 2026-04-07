<?php
$socket = ini_get('pdo_mysql.default_socket');
echo "Socket PDO: " . $socket . "<br>";

$candidates = [
    '/var/lib/mysql/mysql.sock',
    '/var/run/mysqld/mysqld.sock',
    '/tmp/mysql.sock',
    '/var/lib/mysqld/mysql.sock',
];
foreach ($candidates as $s) {
    echo $s . ': ' . (file_exists($s) ? 'EXISTE' : 'no existe') . '<br>';
}

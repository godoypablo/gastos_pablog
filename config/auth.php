<?php
// ── Credenciales de acceso ───────────────────────────────────────
// Para cambiar la contraseña, generá un nuevo hash con:
//   php -r "echo password_hash('tu_nueva_password', PASSWORD_BCRYPT);"
// y reemplazá AUTH_PASS_HASH.

define('AUTH_USER',      'pablo');
define('AUTH_PASS_HASH', '$2y$10$.ldTXukl2CZ/p9apwG6wZeBfobLAXI9.jdxKJkm6hcABM2NGDRK0i'); // cifra1234
define('AUTH_SECRET',    '4106126f20319f6b20cfcdb57e3f66215dde1617ddf84a8edcc842d5ec4569b1');
define('REMEMBER_DAYS',  30);

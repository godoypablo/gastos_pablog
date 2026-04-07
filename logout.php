<?php
require_once 'config/auth_check.php';
cifra_start_session();
$_SESSION = [];
session_destroy();
cifra_clear_remember_cookie();
header('Location: login.php');
exit;

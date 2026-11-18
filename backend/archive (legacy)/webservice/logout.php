<?php

declare(strict_types=1);

require_once __DIR__ . "/http.php";
configureWebserviceCors();
startWebserviceSession();

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method tidak diizinkan."]);
    exit;
}

$_SESSION = [];
$cookie = session_get_cookie_params();
setcookie(session_name(), "", [
    "expires" => time() - 42000,
    "path" => $cookie["path"],
    "domain" => $cookie["domain"],
    "secure" => $cookie["secure"],
    "httponly" => $cookie["httponly"],
    "samesite" => $cookie["samesite"] ?? "Lax",
]);
session_destroy();

echo json_encode(["success" => true]);

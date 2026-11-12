<?php

declare(strict_types=1);

function configureWebserviceCors(): void
{
    header("Content-Type: application/json; charset=UTF-8");

    $origin = $_SERVER["HTTP_ORIGIN"] ?? "";
    $allowedOrigins = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ];
    $configuredOrigins = getenv("FRONTEND_ORIGINS");
    if ($configuredOrigins !== false) {
        $allowedOrigins = array_merge(
            $allowedOrigins,
            array_filter(array_map("trim", explode(",", $configuredOrigins)))
        );
    }

    if ($origin !== "" && !in_array($origin, $allowedOrigins, true)) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Origin tidak diizinkan."]);
        exit;
    }

    if ($origin !== "") {
        header("Access-Control-Allow-Origin: " . $origin);
        header("Access-Control-Allow-Credentials: true");
        header("Vary: Origin");
    }
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Accept");

    if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
        http_response_code(204);
        exit;
    }
}

function startWebserviceSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set("session.use_only_cookies", "1");
    ini_set("session.use_strict_mode", "1");
    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off",
        "httponly" => true,
        "samesite" => "Lax",
    ]);
    session_start();
}

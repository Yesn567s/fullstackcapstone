<?php

declare(strict_types=1);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Accept");
header("Access-Control-Allow-Methods: POST, OPTIONS");
ob_start();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method tidak diizinkan."]);
    exit;
}

$payload = file_get_contents("php://input");
$scheme = (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off") ? "https" : "http";
$host = $_SERVER["HTTP_HOST"] ?? "localhost";
$scriptDirectory = rtrim(str_replace("\\", "/", dirname($_SERVER["SCRIPT_NAME"])), "/");
$projectDirectory = preg_replace("#/backend/php$#", "", $scriptDirectory);
$serviceUrl = getenv("REGISTER_WEBSERVICE_URL")
    ?: $scheme . "://" . $host . $projectDirectory . "/backend/webservice/register.php";

$context = stream_context_create([
    "http" => [
        "method" => "POST",
        "header" => "Content-Type: application/json\r\nAccept: application/json\r\n",
        "content" => $payload,
        "ignore_errors" => true,
        "timeout" => 15,
    ],
]);

ob_clean();

$localServicePath = __DIR__ . "/../webservice/register.php";
$isLocalServer = in_array($host, ["127.0.0.1", "localhost", "localhost:8000", "127.0.0.1:8000"], true);

if ($isLocalServer && is_file($localServicePath)) {
    $registrationPayloadOverride = json_decode($payload, true);
    ob_start();
    include $localServicePath;
    $response = ob_get_clean();
    $status = (int) http_response_code();

    if (empty($response)) {
        $response = json_encode([
            "success" => false,
            "message" => "HTTP Status $status triggered from webservice without payload."
        ]);
    }
} else {
    $response = @file_get_contents($serviceUrl, false, $context);
    $statusLine = $http_response_header[0] ?? "HTTP/1.1 500 Internal Server Error";
    preg_match('/\s(\d{3})\s/', $statusLine, $statusMatch);
    $status = isset($statusMatch[1]) ? (int) $statusMatch[1] : 500;
}

if ($response === false) {
    http_response_code(502);
    echo json_encode(["success" => false, "message" => "Webservice tidak dapat dijangkau."]);
    exit;
}

http_response_code($status);
echo $response;

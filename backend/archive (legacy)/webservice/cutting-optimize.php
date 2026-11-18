<?php

declare(strict_types=1);

require_once __DIR__ . "/http.php";
require_once __DIR__ . "/../php/cutting-optimization.php";
configureWebserviceCors();
startWebserviceSession();

// RBAC: hanya admin yang boleh mengeksekusi engine optimasi pemotongan.
// Role diverifikasi dari DB (bukan session) agar kompatibel dengan sesi lama.
$isAdmin = false;
if (isset($_SESSION["user_id"])) {
    try {
        require_once __DIR__ . "/../db/database.php";
        $roleStatement = databaseConnection()->prepare(
            "SELECT role FROM users WHERE id = :id LIMIT 1"
        );
        $roleStatement->execute(["id" => (int) $_SESSION["user_id"]]);
        $isAdmin = $roleStatement->fetchColumn() === "admin";
    } catch (Throwable $exception) {
        error_log("Cutting optimize auth check error: " . $exception->getMessage());
    }
}
if (!$isAdmin) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Autentikasi admin diperlukan."]);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method tidak diizinkan."]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input) || !isset($input["order_id"])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Payload tidak valid: order_id wajib diisi."]);
    exit;
}

$orderId = filter_var($input["order_id"], FILTER_VALIDATE_INT);
if ($orderId === false || $orderId < 1) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "order_id tidak valid."]);
    exit;
}

try {
    $service = new CuttingOptimizationService();
    $result = $service->optimizeOrder($orderId, (int) $_SESSION["user_id"]);
    echo json_encode(["success" => true, "data" => $result]);
} catch (RuntimeException $exception) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_log("Cutting optimization error: " . $exception->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Optimasi pemotongan tidak dapat diproses saat ini."]);
}

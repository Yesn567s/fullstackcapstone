<?php

declare(strict_types=1);

require_once __DIR__ . "/http.php";
configureWebserviceCors();
startWebserviceSession();

$method = $_SERVER["REQUEST_METHOD"] ?? "";
if (!in_array($method, ["GET", "POST"], true)) {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method tidak diizinkan."]);
    exit;
}

$userId = (int) ($_SESSION["user_id"] ?? 0);
if ($userId < 1) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Silakan login sebagai admin."]);
    exit;
}

try {
    require_once __DIR__ . "/../db/database.php";
    $db = databaseConnection();
    $statement = $db->prepare("SELECT username, role FROM users WHERE id = :id LIMIT 1");
    $statement->execute(["id" => $userId]);
    $admin = $statement->fetch();

    if (!$admin || $admin["role"] !== "admin") {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Hanya admin yang dapat menambahkan pengguna."]);
        exit;
    }

    if ($method === "GET") {
        echo json_encode(["success" => true, "username" => $admin["username"]]);
        exit;
    }

    $input = json_decode(file_get_contents("php://input"), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Payload tidak valid."]);
        exit;
    }

    $requiredFields = ["username", "password", "fullName", "email", "phone", "role"];
    $values = [];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || !is_string($input[$field])) {
            http_response_code(422);
            echo json_encode(["success" => false, "message" => "Semua data pengguna wajib diisi."]);
            exit;
        }
        $values[$field] = $field === "password"
            ? $input[$field]
            : trim($input[$field]);
    }

    $passwordLength = preg_match_all('/./us', $values["password"], $passwordCharacters);
    if (
        $values["username"] === ""
        || strlen($values["username"]) > 50
        || $values["fullName"] === ""
        || strlen($values["fullName"]) > 100
        || !filter_var($values["email"], FILTER_VALIDATE_EMAIL)
        || !preg_match('/@gmail\.com$/iD', $values["email"])
        || strlen($values["email"]) > 100
        || $values["phone"] === ""
        || strlen($values["phone"]) > 30
        || $passwordLength === false
        || $passwordLength < 6
        || !in_array($values["role"], ["admin", "operator"], true)
    ) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Periksa kembali data Gmail, password minimal 6 karakter, dan role admin atau operator.",
        ]);
        exit;
    }

    $statement = $db->prepare(
        "INSERT INTO users (username, password_hash, full_name, email, phone, role)
         VALUES (:username, :password_hash, :full_name, :email, :phone, :role)"
    );
    $statement->execute([
        "username" => $values["username"],
        "password_hash" => password_hash($values["password"], PASSWORD_DEFAULT),
        "full_name" => $values["fullName"],
        "email" => $values["email"],
        "phone" => $values["phone"],
        "role" => $values["role"],
    ]);

    http_response_code(201);
    echo json_encode(["success" => true, "message" => "Pengguna berhasil ditambahkan."]);
} catch (PDOException $exception) {
    $duplicate = $exception->errorInfo[1] ?? null;
    if ($duplicate === 1062) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Username atau email sudah digunakan."]);
        exit;
    }

    error_log("Create user service error: " . $exception->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Pengguna tidak dapat ditambahkan saat ini."]);
}

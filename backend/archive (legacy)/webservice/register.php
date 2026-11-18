<?php

declare(strict_types=1);

// Allow requests from Live Server
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");
header("Content-Type: application/json; charset=UTF-8");

// Handle CORS Preflight OPTIONS request
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require_once __DIR__ . "/../db/database.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method tidak diizinkan."]);
    exit;
}

$input = isset($registrationPayloadOverride) && is_array($registrationPayloadOverride)
    ? $registrationPayloadOverride
    : json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Payload tidak valid."]);
    return;
}

$role = trim((string) ($input["role"] ?? "customer"));
if ($role !== "customer") {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Pendaftaran publik hanya tersedia untuk customer."]);
    return;
}
$input["role"] = $role;

$required = ["fullname", "username", "email", "phone", "role", "password", "address"];
$missing = [];
foreach ($required as $field) {
    if (!isset($input[$field]) || trim((string) $input[$field]) === "") {
        $missing[] = $field;
    }
}

if ($missing) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Data pendaftaran belum lengkap."]);
    return;
}

if (!filter_var($input["email"], FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Format email tidak valid."]);
    return;
}

if (strlen(trim((string) $input["username"])) < 4 || strlen((string) $input["password"]) < 6) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Username atau password tidak memenuhi syarat."]);
    return;
}

$companyName = trim((string) ($input["companyName"] ?? ""));
$contactPerson = trim((string) ($input["contactPerson"] ?? ""));
$address = trim((string) ($input["address"] ?? ""));
if ($role === "customer" && ($companyName === "" || $contactPerson === "")) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Nama perusahaan dan contact person wajib diisi."]);
    return;
}

try {
    $db = databaseConnection();
    $db->beginTransaction();

    $statement = $db->prepare(
        "INSERT INTO users (username, password_hash, full_name, email, phone, role)
         VALUES (:username, :password_hash, :full_name, :email, :phone, :role)"
    );
    $statement->execute([
        "username" => trim((string) $input["username"]),
        "password_hash" => password_hash((string) $input["password"], PASSWORD_DEFAULT),
        "full_name" => trim((string) $input["fullname"]),
        "email" => trim((string) $input["email"]),
        "phone" => trim((string) $input["phone"]),
        "role" => $role,
    ]);

    $userId = (int) $db->lastInsertId();
    if ($role === "customer") {
        $statement = $db->prepare(
            "INSERT INTO customers (user_id, company_name, contact_person, phone, email, address)
             VALUES (:user_id, :company_name, :contact_person, :phone, :email, :address)"
        );
        $statement->execute([
            "user_id" => $userId,
            "company_name" => $companyName,
            "contact_person" => $contactPerson,
            "phone" => trim((string) $input["phone"]),
            "email" => trim((string) $input["email"]),
            "address" => $address,
        ]);
    }

    $db->commit();
    http_response_code(201);
    echo json_encode(["success" => true, "message" => "Pendaftaran berhasil.", "userId" => $userId]);
} catch (PDOException $exception) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    $duplicate = $exception->errorInfo[1] ?? null;
    if ($duplicate === 1062) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Username atau email sudah digunakan."]);
        return;
    }

    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "message" => "PDO Error: " . $exception->getMessage()
    ]);
    return;
} catch (Throwable $exception) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "message" => "Server Throwable Error: " . $exception->getMessage()
    ]);
    return;
}
<?php

declare(strict_types=1);

require_once __DIR__ . "/http.php";
configureWebserviceCors();
startWebserviceSession();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method tidak diizinkan."]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Payload tidak valid."]);
    exit;
}

$username = trim((string) ($input["username"] ?? ""));
$password = (string) ($input["password"] ?? "");
$portal = (string) ($input["portal"] ?? "");
if ($username === "" || $password === "" || !in_array($portal, ["customer", "staff"], true)) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Username, password, atau portal tidak valid."]);
    exit;
}

try {
    require_once __DIR__ . "/../db/database.php";
    $db = databaseConnection();
    $statement = $db->prepare(
        "SELECT id, username, password_hash, role
         FROM users
         WHERE username = :identifier
         LIMIT 1"
    );
    $statement->execute(["identifier" => $username]);
    $user = $statement->fetch();
    if (!$user) {
        $statement = $db->prepare(
            "SELECT id, username, password_hash, role
             FROM users
             WHERE email = :identifier
             LIMIT 1"
        );
        $statement->execute(["identifier" => $username]);
        $user = $statement->fetch();
    }

    $allowedRoles = $portal === "staff" ? ["admin", "operator"] : ["customer"];
    if (
        !$user
        || !password_verify($password, $user["password_hash"])
        || !in_array($user["role"], $allowedRoles, true)
    ) {
        $_SESSION = [];
        session_regenerate_id(true);
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Username/email atau password tidak benar, atau akun tidak memiliki akses ke portal ini.",
        ]);
        exit;
    }

    session_regenerate_id(true);
    $_SESSION["user_id"] = (int) $user["id"];
    unset($user["password_hash"]);
    unset($user["id"]);
    echo json_encode(["success" => true, "user" => $user]);
} catch (Throwable $exception) {
    error_log("Login service error: " . $exception->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Login tidak dapat diproses saat ini."]);
}

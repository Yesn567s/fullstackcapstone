<?php

declare(strict_types=1);

// Self-check CuttingOptimizationService::packSheet (tanpa DB).
// Jalankan: php backend/php/check-cutting.php

$source = file_get_contents(__DIR__ . "/cutting-optimization.php");
// Ekstrak class tanpa require database.php dan tanpa declare(strict_types)
// (strict_types tidak valid di dalam eval).
$source = preg_replace('/^require_once.*$/m', '', $source);
$source = preg_replace('/^declare\(strict_types=1\);.*$/m', '', $source);
eval('?>' . $source);

// Stub koneksi DB: packSheet tidak memakai DB, jadi cukup koneksi kosong.
if (!function_exists('databaseConnection')) {
    function databaseConnection(): PDO
    {
        return new PDO('sqlite::memory:');
    }
}

class_alias('CuttingOptimizationService', 'CuttingOptimizationServiceForTest');
$service = new CuttingOptimizationServiceForTest(null);

$failures = 0;
function check(string $name, bool $condition): void
{
    global $failures;
    echo ($condition ? "PASS" : "FAIL") . " - {$name}" . PHP_EOL;
    if (!$condition) {
        $failures++;
    }
}

// 1. Dua komponen beda ukuran (multi-item nesting) muat dalam 1 lembar.
$pieces = [
    ["component_item_id" => 1, "label" => "back #1", "w" => 600.0, "h" => 400.0, "grain" => "any"],
    ["component_item_id" => 2, "label" => "bottom #1", "w" => 500.0, "h" => 300.0, "grain" => "any"],
];
$packed = $service->packSheet($pieces, 2440.0, 1220.0);
check("Multi-item nesting: 2 piece muat 1 lembar", count($packed["placed"]) === 2 && $packed["remaining"] === []);
check("Kerf diterapkan pada kursor X", abs(((float) $packed["placed"][1]["x"]) - 603.0) < 0.01);

// 2. Grain lengthwise: piece melebihi lebar lembar pada kedua orientasi -> gagal.
$pieces = [["component_item_id" => 1, "label" => "side #1", "w" => 1300.0, "h" => 1300.0, "grain" => "lengthwise"]];
$packed = $service->packSheet($pieces, 2440.0, 1220.0);
check("Grain lengthwise: piece 1300x1300 tidak boleh dirotasi -> gagal", count($packed["remaining"]) === 1);

// 3. Grain any: piece yang sama boleh dirotasi dan muat.
$pieces = [["component_item_id" => 1, "label" => "side #1", "w" => 1300.0, "h" => 200.0, "grain" => "any"]];
$packed = $service->packSheet($pieces, 2440.0, 1220.0);
check("Grain any: rotasi 90 derajat diizinkan", count($packed["placed"]) === 1);

// 4. Shelf baru dibuka dengan kerf saat shelf penuh.
$pieces = [
    ["component_item_id" => 1, "label" => "a", "w" => 1200.0, "h" => 600.0, "grain" => "any"],
    ["component_item_id" => 2, "label" => "b", "w" => 1200.0, "h" => 600.0, "grain" => "any"],
    ["component_item_id" => 3, "label" => "c", "w" => 1200.0, "h" => 600.0, "grain" => "any"],
];
$packed = $service->packSheet($pieces, 2440.0, 1220.0);
check("3 piece 1200x600: 2 di shelf 1, 1 di shelf 2", count($packed["placed"]) === 3);
check("Piece ke-3 turun ke shelf kedua (y = 603)", abs(((float) $packed["placed"][2]["y"]) - 603.0) < 0.01);

// 5. Offcut zone flag: remnant >= 100 mm ditandai offcut_usable.
$pieces = [
    ["component_item_id" => 1, "label" => "a", "w" => 2440.0, "h" => 600.0, "grain" => "any"],
];
$packed = $service->packSheet($pieces, 2440.0, 1220.0);
check("Zona sisa 620 mm ditandai offcut_usable", $packed["placed"][0]["offcut_usable"] === true);

exit($failures === 0 ? 0 : 1);

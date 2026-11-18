<?php

declare(strict_types=1);

require_once __DIR__ . "/database.php";

/**
 * Engine Optimasi Pemotongan 2D (Guillotine Bin Packing) - CV. Sumber Artha.
 *
 * Fitur:
 * - Multi-Item Batch Nesting (gabung beberapa ukuran komponen dalam 1 PO per material)
 * - Kerf 3 mm pada setiap garis potong
 * - Grain constraint (rotasi 90 derajat hanya jika grain_orientation = 'any')
 * - Prioritas pemakaian offcut internal sebelum lembaran utuh
 * - Output koordinat (pos_x, pos_y, width_mm, height_mm, cut_step_order)
 *   siap dirender ke HTML5 Canvas dan disimpan ke cutting_patterns.
 *
 * Algoritma: shelf-based First-Fit Decreasing guillotine. Setiap batas shelf
 * adalah potongan lurus end-to-end, sehingga 100% memenuhi guillotine constraint.
 */
final class CuttingOptimizationService
{
    public const KERF_MM = 3.0;
    public const DOVETAIL_MM = 4.0;

    private PDO $db;

    public function __construct(?PDO $connection = null)
    {
        $this->db = $connection ?? databaseConnection();
    }

    /**
     * Jalankan optimasi untuk 1 order. Mengembalikan ringkasan cutting jobs
     * beserta pola potong JSON-ready untuk Canvas.
     *
     * @return array<int, array<string, mixed>>
     */
    public function optimizeOrder(int $orderId, ?int $operatorId = null): array
    {
        $this->db->beginTransaction();
        try {
            $components = $this->loadOrderComponents($orderId);
            if ($components === []) {
                throw new RuntimeException("Order tidak memiliki component_items untuk dioptimasi.");
            }

            $groups = $this->groupByMaterial($components);

            $results = [];
            foreach ($groups as $group) {
                $results[] = $this->optimizeMaterialGroup($orderId, $group, $operatorId);
            }

            $this->db->commit();
            return $results;
        } catch (Throwable $exception) {
            $this->db->rollBack();
            throw $exception;
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadOrderComponents(int $orderId): array
    {
        $statement = $this->db->prepare(
            "SELECT ci.id, ci.component_type, ci.raw_length_mm, ci.raw_width_mm,
                    ci.grain_orientation, ci.quantity,
                    m.id AS material_id, m.material_name,
                    m.default_length_mm, m.default_width_mm
             FROM component_items ci
             JOIN order_items oi ON oi.id = ci.order_item_id
             JOIN materials m ON m.id = ci.material_id
             WHERE oi.order_id = :order_id"
        );
        $statement->execute(["order_id" => $orderId]);

        return $statement->fetchAll();
    }

    /**
     * @param array<int, array<string, mixed>> $components
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function groupByMaterial(array $components): array
    {
        $groups = [];
        foreach ($components as $component) {
            $groups[(int) $component["material_id"]][] = $component;
        }
        return array_values($groups);
    }

    /**
     * @param array<int, array<string, mixed>> $components
     * @return array<string, mixed>
     */
    private function optimizeMaterialGroup(int $orderId, array $components, ?int $operatorId): array
    {
        $materialId = (int) $components[0]["material_id"];
        $customerId = $this->resolveOrderCustomerId($orderId);

        // Expand quantity menjadi piece individual, urut area terbesar dulu (FFD).
        $pieces = [];
        foreach ($components as $component) {
            $quantity = (int) $component["quantity"];
            for ($i = 0; $i < $quantity; $i++) {
                $pieces[] = [
                    "component_item_id" => (int) $component["id"],
                    "label" => $component["component_type"] . " #" . ($i + 1),
                    "w" => (float) $component["raw_length_mm"],
                    "h" => (float) $component["raw_width_mm"],
                    "grain" => (string) $component["grain_orientation"],
                ];
            }
        }
        usort($pieces, static fn (array $a, array $b): int => ($b["w"] * $b["h"]) <=> ($a["w"] * $a["h"]));

        // FASE 1: offcut internal tersedia (milik customer & material yang sama) dipakai dulu.
        $sheets = [];
        foreach ($this->loadAvailableOffcuts($materialId, $customerId) as $offcut) {
            $packed = $this->packSheet($pieces, (float) $offcut["length_mm"], (float) $offcut["width_mm"]);
            if ($packed["placed"] !== []) {
                $pieces = $packed["remaining"];
                $sheets[] = [
                    "source_type" => "offcut",
                    "length" => (float) $offcut["length_mm"],
                    "width" => (float) $offcut["width_mm"],
                    "offcut_id" => (int) $offcut["id"],
                    "placed" => $packed["placed"],
                ];
            }
            if ($pieces === []) {
                break;
            }
        }

        // FASE 2: sisa piece di-pack ke lembaran utuh 2440 x 1220.
        $sheetLength = (float) $components[0]["default_length_mm"];
        $sheetWidth = (float) $components[0]["default_width_mm"];
        $batch = 0;
        while ($pieces !== [] && $batch < 500) {
            $packed = $this->packSheet($pieces, $sheetLength, $sheetWidth);
            if ($packed["placed"] === []) {
                throw new RuntimeException(
                    sprintf(
                        "Terdapat komponen yang tidak muat pada lembaran %.0f x %.0f mm.",
                        $sheetLength,
                        $sheetWidth
                    )
                );
            }
            $pieces = $packed["remaining"];
            $sheets[] = [
                "source_type" => "full_sheet",
                "length" => $sheetLength,
                "width" => $sheetWidth,
                "offcut_id" => null,
                "placed" => $packed["placed"],
            ];
            $batch++;
        }
        if ($pieces !== []) {
            throw new RuntimeException("Stok material tidak mencukupi untuk order ini.");
        }

        return $this->persistCuttingJobs($orderId, $materialId, $operatorId, $sheets);
    }

    private function resolveOrderCustomerId(int $orderId): ?int
    {
        $statement = $this->db->prepare("SELECT customer_id FROM orders WHERE id = :id LIMIT 1");
        $statement->execute(["id" => $orderId]);
        $customerId = $statement->fetchColumn();

        return $customerId === false ? null : (int) $customerId;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadAvailableOffcuts(int $materialId, ?int $customerId): array
    {
        $sql = "SELECT id, length_mm, width_mm FROM offcuts
                WHERE material_id = :material_id AND status = 'available'";
        $params = ["material_id" => $materialId];
        if ($customerId !== null) {
            $sql .= " AND (customer_id = :customer_id OR customer_id IS NULL)";
            $params["customer_id"] = $customerId;
        }
        $sql .= " ORDER BY length_mm * width_mm DESC";
        $sql .= " FOR UPDATE";

        $statement = $this->db->prepare($sql);
        $statement->execute($params);

        return $statement->fetchAll();
    }

    /**
     * Shelf-based FFD guillotine packing ke satu lembar.
     * Setiap shelf adalah pita horizontal penuh; piece dalam shelf dipisah
     * potongan vertikal penuh -> guillotine-safe.
     *
     * @param array<int, array<string, mixed>> $pieces
     * @return array{placed: array<int, array<string, mixed>>, remaining: array<int, array<string, mixed>>}
     */
    public function packSheet(array $pieces, float $sheetLength, float $sheetWidth): array
    {
        $placed = [];
        $remaining = [];
        $kerf = self::KERF_MM;

        $y = 0.0;      // kursor vertikal shelf saat ini
        $shelfH = 0.0; // tinggi shelf saat ini
        $x = 0.0;      // kursor horizontal dalam shelf
        $sheetStarted = false;

        foreach ($pieces as $piece) {
            $orientations = [["w" => $piece["w"], "h" => $piece["h"]]];
            if ($piece["grain"] === "any" && $piece["w"] !== $piece["h"]) {
                $orientations[] = ["w" => $piece["h"], "h" => $piece["w"]];
            }

            $didPlace = false;
            foreach ($orientations as $orientation) {
                $w = $orientation["w"];
                $h = $orientation["h"];

                // Coba muat di shelf saat ini.
                if ($sheetStarted && $x + $w <= $sheetLength + 1e-9 && $y + $h <= $sheetWidth + 1e-9) {
                    $placed[] = $this->makePlacement($piece, $x, $y, $w, $h);
                    $x += $w + $kerf;
                    $shelfH = max($shelfH, $h);
                    $didPlace = true;
                    break;
                }

                // Buka shelf baru di bawah (satu potongan horizontal end-to-end).
                if ($sheetStarted && $y + $shelfH + $kerf + $h <= $sheetWidth + 1e-9) {
                    $y += $shelfH + $kerf;
                    $shelfH = $h;
                    $x = $w + $kerf;
                    $placed[] = $this->makePlacement($piece, 0.0, $y, $w, $h);
                    $didPlace = true;
                    break;
                }

                // Lembar masih kosong: mulai dari (0,0).
                if (!$sheetStarted && $w <= $sheetLength + 1e-9 && $h <= $sheetWidth + 1e-9) {
                    $sheetStarted = true;
                    $x = $w + $kerf;
                    $shelfH = $h;
                    $placed[] = $this->makePlacement($piece, 0.0, 0.0, $w, $h);
                    $didPlace = true;
                    break;
                }
            }

            if (!$didPlace) {
                $remaining[] = $piece;
            }
        }

        // Tandai zona sisa lembar sebagai kandidat offcut jika cukup besar (>= 100 mm).
        if ($placed !== [] && ($sheetWidth - ($y + $shelfH)) >= 100.0) {
            $placed[0]["offcut_usable"] = true;
        }

        return ["placed" => $placed, "remaining" => $remaining];
    }

    /**
     * @param array<string, mixed> $piece
     * @return array<string, mixed>
     */
    private function makePlacement(array $piece, float $x, float $y, float $w, float $h): array
    {
        return [
            "component_item_id" => $piece["component_item_id"],
            "label" => $piece["label"],
            "x" => $x,
            "y" => $y,
            "w" => $w,
            "h" => $h,
            "offcut_usable" => false,
        ];
    }

    /**
     * Simpan cutting_jobs + cutting_patterns, tandai offcut terpakai,
     * dan catat yield/waste per lembar.
     *
     * @param array<int, array<string, mixed>> $sheets
     * @return array<string, mixed>
     */
    private function persistCuttingJobs(int $orderId, int $materialId, ?int $operatorId, array $sheets): array
    {
        $orderNumber = $this->resolveOrderNumber($orderId);
        $summaries = [];

        foreach ($sheets as $index => $sheet) {
            $jobNumber = sprintf("CJ-%s-%03d", $orderNumber, $index + 1);

            $statement = $this->db->prepare(
                "INSERT INTO cutting_jobs
                    (order_id, job_number, material_id, source_type, source_sheet_length,
                     source_sheet_width, used_offcut_id, kerf_thickness_mm,
                     dovetail_allowance_mm, yield_rate_percent, waste_rate_percent,
                     status, operator_id)
                 VALUES (:order_id, :job_number, :material_id, :source_type, :length,
                         :width, :offcut_id, :kerf, :dovetail, :yield, :waste,
                         'pending', :operator_id)"
            );
            $statement->execute([
                "order_id" => $orderId,
                "job_number" => $jobNumber,
                "material_id" => $materialId,
                "source_type" => $sheet["source_type"],
                "length" => $sheet["length"],
                "width" => $sheet["width"],
                "offcut_id" => $sheet["offcut_id"],
                "kerf" => self::KERF_MM,
                "dovetail" => self::DOVETAIL_MM,
                "yield" => 0,
                "waste" => 0,
                "operator_id" => $operatorId,
            ]);
            $jobId = (int) $this->db->lastInsertId();

            $usedArea = 0.0;
            $canvasPieces = [];

            foreach ($sheet["placed"] as $step => $placement) {
                $patternStatement = $this->db->prepare(
                    "INSERT INTO cutting_patterns
                        (cutting_job_id, component_item_id, label, pos_x, pos_y,
                         width_mm, height_mm, cut_step_order, is_offcut_usable)
                     VALUES (:job_id, :component_item_id, :label, :pos_x, :pos_y,
                             :width_mm, :height_mm, :cut_step_order, :offcut_usable)"
                );
                $patternStatement->execute([
                    "job_id" => $jobId,
                    "component_item_id" => $placement["component_item_id"],
                    "label" => $placement["label"],
                    "pos_x" => round((float) $placement["x"], 2),
                    "pos_y" => round((float) $placement["y"], 2),
                    "width_mm" => round((float) $placement["w"], 2),
                    "height_mm" => round((float) $placement["h"], 2),
                    "cut_step_order" => $step + 1,
                    "offcut_usable" => $placement["offcut_usable"] ? 1 : 0,
                ]);

                $usedArea += (float) $placement["w"] * (float) $placement["h"];
                $canvasPieces[] = [
                    "component_item_id" => $placement["component_item_id"],
                    "label" => $placement["label"],
                    "pos_x" => (int) round((float) $placement["x"]),
                    "pos_y" => (int) round((float) $placement["y"]),
                    "width_mm" => (int) round((float) $placement["w"]),
                    "height_mm" => (int) round((float) $placement["h"]),
                    "cut_step_order" => $step + 1,
                ];
            }

            $totalArea = (float) $sheet["length"] * (float) $sheet["width"];
            $yieldRate = round(($usedArea / $totalArea) * 100, 2);
            $wasteRate = round(100 - $yieldRate, 2);

            $updateStatement = $this->db->prepare(
                "UPDATE cutting_jobs
                 SET yield_rate_percent = :yield, waste_rate_percent = :waste
                 WHERE id = :id"
            );
            $updateStatement->execute(["yield" => $yieldRate, "waste" => $wasteRate, "id" => $jobId]);

            if ($sheet["offcut_id"] !== null) {
                $offcutStatement = $this->db->prepare(
                    "UPDATE offcuts SET status = 'used' WHERE id = :id"
                );
                $offcutStatement->execute(["id" => $sheet["offcut_id"]]);
            }

            $summaries[] = [
                "job_number" => $jobNumber,
                "source_type" => $sheet["source_type"],
                "sheet" => ["length" => $sheet["length"], "width" => $sheet["width"]],
                "yield_rate_percent" => $yieldRate,
                "waste_rate_percent" => $wasteRate,
                "pieces" => $canvasPieces,
            ];
        }

        return [
            "order_id" => $orderId,
            "total_sheets" => count($sheets),
            "jobs" => $summaries,
        ];
    }

    private function resolveOrderNumber(int $orderId): string
    {
        $statement = $this->db->prepare("SELECT order_number FROM orders WHERE id = :id LIMIT 1");
        $statement->execute(["id" => $orderId]);
        $orderNumber = $statement->fetchColumn();

        return $orderNumber === false ? (string) $orderId : (string) $orderNumber;
    }
}

-- Development-only seed data for db_sumber_artha_v3.
-- Apply db_sumberartha.sql and migrations/20261119_add_phone_verified.sql first.
-- Re-running this file reuses the records identified by the demo names/numbers.
--
-- Test accounts:
--   Operator: seed_operator_01 / SeedOperator2026!
--   Customer: seed_customer_01 / SeedCustomer2026!
--   Added operator: seed_operator_02 / SeedOperator2027!
--   Added customers: seed_customer_02 / SeedCustomer2027!, seed_customer_03 / SeedCustomer2028!
-- Change these passwords before using the database outside local development.
-- PowerShell (from backend): Get-Content .\seed_dummy_data.sql | mysql -u YOUR_DB_USER -p

USE db_sumber_artha_v3;

START TRANSACTION;

INSERT INTO users (
    username, password_hash, full_name, email, phone, role,
    email_verified, phone_verified
) VALUES (
    'seed_operator_01',
    '$2b$12$F4JlPklL1AnGhoayHx2IkeY6F1pyYxs6947t1Z7Aix73najic22RS',
    'Demo Operator',
    'seed.operator@example.test',
    '+620000000001',
    'operator',
    TRUE,
    TRUE
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_operator_id := (
    SELECT id FROM users
    WHERE username = 'seed_operator_01'
      AND email = 'seed.operator@example.test'
      AND role = 'operator'
    LIMIT 1
);

INSERT INTO users (
    username, password_hash, full_name, email, phone, role,
    email_verified, phone_verified
) VALUES (
    'seed_customer_01',
    '$2b$12$4GtGOQPfqvgSmrfnECu1dehRK4FgvqbySdofOmiBa8g1Sryk/I0Cm',
    'Demo Customer',
    'seed.customer@example.test',
    '+620000000002',
    'customer',
    TRUE,
    TRUE
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_customer_user_id := (
    SELECT id FROM users
    WHERE username = 'seed_customer_01'
      AND email = 'seed.customer@example.test'
      AND role = 'customer'
    LIMIT 1
);

INSERT INTO loyalty_tiers (
    tier_name, min_repeat_orders, discount_percentage, priority_level
)
SELECT 'Demo Seed Tier', 1, 5.00, 2
WHERE NOT EXISTS (
    SELECT 1 FROM loyalty_tiers WHERE tier_name = 'Demo Seed Tier'
);

SET @seed_tier_id := (
    SELECT id FROM loyalty_tiers
    WHERE tier_name = 'Demo Seed Tier'
    ORDER BY id
    LIMIT 1
);

INSERT INTO customers (
    user_id, company_name, contact_person, phone, email, address, loyalty_tier_id
)
SELECT
    @seed_customer_user_id,
    'Demo Seed Furniture',
    'Demo Customer',
    '+620000000002',
    'seed.customer@example.test',
    '1 Example Street, Bandung',
    @seed_tier_id
WHERE @seed_customer_user_id IS NOT NULL
  AND @seed_tier_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customers WHERE user_id = @seed_customer_user_id
  );

SET @seed_customer_id := (
    SELECT id FROM customers
    WHERE user_id = @seed_customer_user_id
    ORDER BY id
    LIMIT 1
);

INSERT INTO customer_credit_scores (
    customer_id, credit_score, recommended_credit_limit,
    allow_top_90, required_dp_percent
)
SELECT @seed_customer_id, 720, 25000000.00, TRUE, 30.00
WHERE @seed_customer_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customer_credit_scores
      WHERE customer_id = @seed_customer_id
  );

INSERT INTO materials (
    customer_id, material_code, material_name, thickness_mm,
    default_length_mm, default_width_mm, stock_sheets, has_grain_constraint
) VALUES (
    @seed_customer_id, 'SEED-PLY-12', 'Demo Plywood 12mm', 12.00,
    2440.00, 1220.00, 49, TRUE
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_material_id := (
    SELECT id FROM materials WHERE material_code = 'SEED-PLY-12' LIMIT 1
);

INSERT INTO consignment_receipts (
    customer_id, receipt_number, material_id, received_quantity,
    remaining_quantity, length_mm, width_mm, received_date, notes
) VALUES (
    @seed_customer_id, 'RCV-DEMO-SEED-001', @seed_material_id, 50,
    49, 2440.00, 1220.00, DATE_SUB(CURDATE(), INTERVAL 30 DAY),
    'Dummy consignment receipt for local development.'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_receipt_id := (
    SELECT id FROM consignment_receipts
    WHERE receipt_number = 'RCV-DEMO-SEED-001'
    LIMIT 1
);

INSERT INTO legal_contracts (
    contract_title, terms_and_conditions, version, is_active
)
SELECT
    'Demo Seed Purchase Contract',
    'Dummy terms for local development only.',
    'SEED-1',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM legal_contracts
    WHERE contract_title = 'Demo Seed Purchase Contract'
      AND version = 'SEED-1'
);

SET @seed_contract_id := (
    SELECT id FROM legal_contracts
    WHERE contract_title = 'Demo Seed Purchase Contract'
      AND version = 'SEED-1'
    ORDER BY id
    LIMIT 1
);

INSERT INTO orders (
    order_number, customer_id, po_number, order_date, top_days,
    total_order_value, status
) VALUES (
    'PO-DEMO-SEED-001', @seed_customer_id, 'CUSTOMER-DEMO-001',
    DATE_SUB(CURDATE(), INTERVAL 30 DAY), 90, 1250000.00, 'completed'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_order_id := (
    SELECT id FROM orders
    WHERE order_number = 'PO-DEMO-SEED-001'
      AND customer_id = @seed_customer_id
    LIMIT 1
);

INSERT INTO contract_approvals (
    order_id, legal_contract_id, customer_id, ip_address,
    digital_signature_hash, approved_at
)
VALUES (
    @seed_order_id, @seed_contract_id, @seed_customer_id,
    '192.0.2.10', SHA2('demo-seed-contract-signature', 256),
    DATE_SUB(NOW(), INTERVAL 29 DAY)
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

INSERT INTO dp_payments (
    order_id, required_dp_percent, required_dp_amount, paid_amount,
    payment_date, payment_proof_url, verification_status, verified_by
)
SELECT
    @seed_order_id, 30.00, 375000.00, 375000.00,
    DATE_SUB(NOW(), INTERVAL 28 DAY),
    'https://example.test/demo/dp-proof.png',
    'verified', @seed_operator_id
WHERE @seed_order_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dp_payments
      WHERE order_id = @seed_order_id
        AND required_dp_amount = 375000.00
  );

INSERT INTO order_items (
    order_id, drawer_type_code, finished_length_mm, finished_width_mm,
    finished_height_mm, quantity, unit_price
)
SELECT @seed_order_id, 'DEMO-DRAWER-001', 500.00, 400.00, 150.00, 1, 1250000.00
WHERE @seed_order_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM order_items
      WHERE order_id = @seed_order_id
        AND drawer_type_code = 'DEMO-DRAWER-001'
  );

SET @seed_order_item_id := (
    SELECT id FROM order_items
    WHERE order_id = @seed_order_id
      AND drawer_type_code = 'DEMO-DRAWER-001'
    ORDER BY id
    LIMIT 1
);

INSERT INTO component_items (
    order_item_id, component_type, material_id, raw_length_mm,
    raw_width_mm, grain_orientation, quantity
)
SELECT @seed_order_item_id, 'front', @seed_material_id, 404.00, 150.00, 'lengthwise', 1
WHERE @seed_order_item_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM component_items
      WHERE order_item_id = @seed_order_item_id
        AND component_type = 'front'
        AND material_id = @seed_material_id
  );

INSERT INTO component_items (
    order_item_id, component_type, material_id, raw_length_mm,
    raw_width_mm, grain_orientation, quantity
)
SELECT @seed_order_item_id, 'back', @seed_material_id, 404.00, 150.00, 'lengthwise', 1
WHERE @seed_order_item_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM component_items
      WHERE order_item_id = @seed_order_item_id
        AND component_type = 'back'
        AND material_id = @seed_material_id
  );

INSERT INTO component_items (
    order_item_id, component_type, material_id, raw_length_mm,
    raw_width_mm, grain_orientation, quantity
)
SELECT @seed_order_item_id, 'side_left', @seed_material_id, 500.00, 150.00, 'lengthwise', 1
WHERE @seed_order_item_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM component_items
      WHERE order_item_id = @seed_order_item_id
        AND component_type = 'side_left'
        AND material_id = @seed_material_id
  );

INSERT INTO component_items (
    order_item_id, component_type, material_id, raw_length_mm,
    raw_width_mm, grain_orientation, quantity
)
SELECT @seed_order_item_id, 'side_right', @seed_material_id, 500.00, 150.00, 'lengthwise', 1
WHERE @seed_order_item_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM component_items
      WHERE order_item_id = @seed_order_item_id
        AND component_type = 'side_right'
        AND material_id = @seed_material_id
  );

INSERT INTO component_items (
    order_item_id, component_type, material_id, raw_length_mm,
    raw_width_mm, grain_orientation, quantity
)
SELECT @seed_order_item_id, 'bottom', @seed_material_id, 500.00, 396.00, 'lengthwise', 1
WHERE @seed_order_item_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM component_items
      WHERE order_item_id = @seed_order_item_id
        AND component_type = 'bottom'
        AND material_id = @seed_material_id
  );

SET @seed_front_component_id := (
    SELECT id FROM component_items
    WHERE order_item_id = @seed_order_item_id
      AND component_type = 'front'
      AND material_id = @seed_material_id
    ORDER BY id
    LIMIT 1
);
SET @seed_back_component_id := (
    SELECT id FROM component_items
    WHERE order_item_id = @seed_order_item_id
      AND component_type = 'back'
      AND material_id = @seed_material_id
    ORDER BY id
    LIMIT 1
);
SET @seed_left_component_id := (
    SELECT id FROM component_items
    WHERE order_item_id = @seed_order_item_id
      AND component_type = 'side_left'
      AND material_id = @seed_material_id
    ORDER BY id
    LIMIT 1
);
SET @seed_right_component_id := (
    SELECT id FROM component_items
    WHERE order_item_id = @seed_order_item_id
      AND component_type = 'side_right'
      AND material_id = @seed_material_id
    ORDER BY id
    LIMIT 1
);
SET @seed_bottom_component_id := (
    SELECT id FROM component_items
    WHERE order_item_id = @seed_order_item_id
      AND component_type = 'bottom'
      AND material_id = @seed_material_id
    ORDER BY id
    LIMIT 1
);

INSERT INTO offcuts (
    material_id, customer_id, length_mm, width_mm,
    grain_orientation, status, location_tag
)
SELECT @seed_material_id, @seed_customer_id, 600.00, 300.00,
       'lengthwise', 'available', 'DEMO-SEED-OFFCUT-001'
WHERE @seed_material_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM offcuts
      WHERE material_id = @seed_material_id
        AND location_tag = 'DEMO-SEED-OFFCUT-001'
  );

SET @seed_offcut_id := (
    SELECT id FROM offcuts
    WHERE material_id = @seed_material_id
      AND location_tag = 'DEMO-SEED-OFFCUT-001'
    ORDER BY id
    LIMIT 1
);

INSERT INTO consignment_usage (
    consignment_receipt_id, order_id, used_quantity, used_at
)
SELECT @seed_receipt_id, @seed_order_id, 1, DATE_SUB(NOW(), INTERVAL 27 DAY)
WHERE @seed_receipt_id IS NOT NULL
  AND @seed_order_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM consignment_usage
      WHERE consignment_receipt_id = @seed_receipt_id
        AND order_id = @seed_order_id
  );

INSERT INTO cutting_jobs (
    order_id, job_number, material_id, source_type,
    source_sheet_length, source_sheet_width, used_offcut_id,
    kerf_thickness_mm, dovetail_allowance_mm,
    yield_rate_percent, waste_rate_percent, status, operator_id, finished_at
)
VALUES (
    @seed_order_id, 'CJ-DEMO-SEED-001', @seed_material_id, 'full_sheet',
    2440.00, 1220.00, NULL, 3.00, 4.00,
    15.76, 84.24, 'completed', @seed_operator_id,
    DATE_SUB(NOW(), INTERVAL 20 DAY)
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_cutting_job_id := (
    SELECT id FROM cutting_jobs
    WHERE job_number = 'CJ-DEMO-SEED-001'
    LIMIT 1
);

INSERT INTO cutting_patterns (
    cutting_job_id, component_item_id, label, pos_x, pos_y,
    width_mm, height_mm, cut_step_order, is_offcut_usable
)
SELECT @seed_cutting_job_id, @seed_front_component_id, 'front', 0, 0,
       404, 150, 1, FALSE
WHERE @seed_cutting_job_id IS NOT NULL
  AND @seed_front_component_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM cutting_patterns
      WHERE cutting_job_id = @seed_cutting_job_id AND cut_step_order = 1
  );

INSERT INTO cutting_patterns (
    cutting_job_id, component_item_id, label, pos_x, pos_y,
    width_mm, height_mm, cut_step_order, is_offcut_usable
)
SELECT @seed_cutting_job_id, @seed_back_component_id, 'back', 407, 0,
       404, 150, 2, FALSE
WHERE @seed_cutting_job_id IS NOT NULL
  AND @seed_back_component_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM cutting_patterns
      WHERE cutting_job_id = @seed_cutting_job_id AND cut_step_order = 2
  );

INSERT INTO cutting_patterns (
    cutting_job_id, component_item_id, label, pos_x, pos_y,
    width_mm, height_mm, cut_step_order, is_offcut_usable
)
SELECT @seed_cutting_job_id, @seed_left_component_id, 'side_left', 814, 0,
       500, 150, 3, FALSE
WHERE @seed_cutting_job_id IS NOT NULL
  AND @seed_left_component_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM cutting_patterns
      WHERE cutting_job_id = @seed_cutting_job_id AND cut_step_order = 3
  );

INSERT INTO cutting_patterns (
    cutting_job_id, component_item_id, label, pos_x, pos_y,
    width_mm, height_mm, cut_step_order, is_offcut_usable
)
SELECT @seed_cutting_job_id, @seed_right_component_id, 'side_right', 1317, 0,
       500, 150, 4, FALSE
WHERE @seed_cutting_job_id IS NOT NULL
  AND @seed_right_component_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM cutting_patterns
      WHERE cutting_job_id = @seed_cutting_job_id AND cut_step_order = 4
  );

INSERT INTO cutting_patterns (
    cutting_job_id, component_item_id, label, pos_x, pos_y,
    width_mm, height_mm, cut_step_order, is_offcut_usable
)
SELECT @seed_cutting_job_id, @seed_bottom_component_id, 'bottom', 1820, 0,
       500, 396, 5, TRUE
WHERE @seed_cutting_job_id IS NOT NULL
  AND @seed_bottom_component_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM cutting_patterns
      WHERE cutting_job_id = @seed_cutting_job_id AND cut_step_order = 5
  );

INSERT INTO qc_inspections (
    order_id, inspection_number, inspector_id, quantity_inspected,
    inspection_date, squareness_passed, dimension_passed, overall_status, notes
)
VALUES (
    @seed_order_id, 'QC-DEMO-SEED-001', @seed_operator_id, 1,
    DATE_SUB(NOW(), INTERVAL 15 DAY), TRUE, TRUE, 'passed',
    'Dummy quality inspection for local development.'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_qc_id := (
    SELECT id FROM qc_inspections
    WHERE inspection_number = 'QC-DEMO-SEED-001'
    LIMIT 1
);

INSERT INTO deliveries (
    order_id, qc_inspection_id, delivery_note_number, delivery_date,
    truck_plate_number, driver_name, quantity_shipped,
    received_status, received_date
)
VALUES (
    @seed_order_id, @seed_qc_id, 'SJ-DEMO-SEED-001',
    DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'D 1234 DEMO',
    'Demo Driver', 1, TRUE, DATE_SUB(CURDATE(), INTERVAL 9 DAY)
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_delivery_id := (
    SELECT id FROM deliveries
    WHERE delivery_note_number = 'SJ-DEMO-SEED-001'
    LIMIT 1
);

INSERT INTO delivery_items (delivery_id, order_item_id, quantity_shipped)
SELECT @seed_delivery_id, @seed_order_item_id, 1
WHERE @seed_delivery_id IS NOT NULL
  AND @seed_order_item_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM delivery_items
      WHERE delivery_id = @seed_delivery_id
        AND order_item_id = @seed_order_item_id
  );

INSERT INTO invoices (
    invoice_number, order_id, invoice_date, due_date,
    total_amount, paid_amount, status
)
VALUES (
    'INV-DEMO-SEED-001', @seed_order_id,
    DATE_SUB(CURDATE(), INTERVAL 20 DAY),
    DATE_ADD(CURDATE(), INTERVAL 70 DAY),
    1250000.00, 250000.00, 'partially_paid'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_invoice_id := (
    SELECT id FROM invoices
    WHERE order_id = @seed_order_id
    LIMIT 1
);

INSERT INTO invoice_payments (
    invoice_id, payment_number, payment_date, amount_paid,
    payment_method, payment_proof_url, verified_by, notes
)
VALUES (
    @seed_invoice_id, 'PAY-DEMO-SEED-001',
    DATE_SUB(CURDATE(), INTERVAL 5 DAY), 250000.00,
    'bank_transfer', 'https://example.test/demo/invoice-proof.png',
    @seed_operator_id, 'Dummy partial payment for local development.'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

INSERT INTO rma_requests (
    rma_number, order_id, delivery_id, customer_id, request_date,
    proof_media_url, claim_reason, verification_status, action_type,
    credit_note_amount
)
VALUES (
    'RMA-DEMO-SEED-001', @seed_order_id, @seed_delivery_id,
    @seed_customer_id, DATE_SUB(NOW(), INTERVAL 3 DAY),
    'https://example.test/demo/rma-proof.png',
    'Dummy claim for local development.', 'pending', NULL, 0.00
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

INSERT INTO po_tracking_logs (
    order_id, stage, affected_quantity, status_description, updated_by
)
SELECT @seed_order_id, seed_stages.stage, 1,
       CONCAT('Demo seed status: ', seed_stages.stage), @seed_operator_id
FROM (
    SELECT 'PO_Created' AS stage
    UNION ALL SELECT 'Contract_Signed'
    UNION ALL SELECT 'DP_Verified'
    UNION ALL SELECT 'Cutting'
    UNION ALL SELECT 'QC_Inspection'
    UNION ALL SELECT 'Shipping'
    UNION ALL SELECT 'Completed'
) AS seed_stages
WHERE @seed_order_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM po_tracking_logs
      WHERE order_id = @seed_order_id
        AND stage = seed_stages.stage
  );

INSERT INTO activity_logs (
    user_id, order_id, action_type, module_name, reference_id,
    description, ip_address
)
SELECT
    @seed_operator_id, @seed_order_id, 'FINISH_CUTTING',
    'cutting_jobs', @seed_cutting_job_id,
    'Completed the demo seed cutting job.',
    '192.0.2.20'
WHERE @seed_operator_id IS NOT NULL
  AND @seed_order_id IS NOT NULL
  AND @seed_cutting_job_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM activity_logs
      WHERE user_id = @seed_operator_id
        AND order_id = @seed_order_id
        AND action_type = 'FINISH_CUTTING'
        AND module_name = 'cutting_jobs'
        AND reference_id = @seed_cutting_job_id
  );

INSERT INTO email_verification_tokens (user_id, token, expires_at)
SELECT @seed_customer_user_id, REPEAT('0', 64), DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE @seed_customer_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM email_verification_tokens
      WHERE user_id = @seed_customer_user_id
        AND token = REPEAT('0', 64)
  );

INSERT INTO users (
    username, password_hash, full_name, email, phone, role,
    email_verified, phone_verified
) VALUES (
    'seed_operator_02',
    '$2b$12$nbujnvmU9U.SO7IM4VhcLOS90.KHXKHCjqTdDRR/..yCMYu3nVCHm',
    'Demo Operator Two',
    'seed.operator02@example.test',
    '+620000000003',
    'operator',
    TRUE,
    TRUE
), (
    'seed_customer_02',
    '$2b$12$8zUQIXrWJ79FZAQ9MmBCSuyJUe7i0ZemgVnbsFwHU7i6Er8l1naIK',
    'Demo Customer Two',
    'seed.customer02@example.test',
    '+620000000004',
    'customer',
    TRUE,
    TRUE
), (
    'seed_customer_03',
    '$2b$12$Pq6zjJEqomr3hMIJhMLT5OJwbctx.svPD/7wa/4azpdDvf38vgvbu',
    'Demo Customer Three',
    'seed.customer03@example.test',
    '+620000000005',
    'customer',
    TRUE,
    TRUE
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_operator_02_id := (
    SELECT id FROM users
    WHERE username = 'seed_operator_02'
      AND email = 'seed.operator02@example.test'
      AND role = 'operator'
    LIMIT 1
);
SET @seed_customer_02_user_id := (
    SELECT id FROM users
    WHERE username = 'seed_customer_02'
      AND email = 'seed.customer02@example.test'
      AND role = 'customer'
    LIMIT 1
);
SET @seed_customer_03_user_id := (
    SELECT id FROM users
    WHERE username = 'seed_customer_03'
      AND email = 'seed.customer03@example.test'
      AND role = 'customer'
    LIMIT 1
);

INSERT INTO loyalty_tiers (
    tier_name, min_repeat_orders, discount_percentage, priority_level
)
SELECT 'Demo Seed Tier 02', 2, 7.50, 2
WHERE NOT EXISTS (
    SELECT 1 FROM loyalty_tiers WHERE tier_name = 'Demo Seed Tier 02'
)
UNION ALL
SELECT 'Demo Seed Tier 03', 3, 10.00, 3
WHERE NOT EXISTS (
    SELECT 1 FROM loyalty_tiers WHERE tier_name = 'Demo Seed Tier 03'
)
UNION ALL
SELECT 'Demo Seed Tier 04', 5, 12.50, 4
WHERE NOT EXISTS (
    SELECT 1 FROM loyalty_tiers WHERE tier_name = 'Demo Seed Tier 04'
);

SET @seed_tier_02_id := (
    SELECT id FROM loyalty_tiers WHERE tier_name = 'Demo Seed Tier 02' ORDER BY id LIMIT 1
);
SET @seed_tier_03_id := (
    SELECT id FROM loyalty_tiers WHERE tier_name = 'Demo Seed Tier 03' ORDER BY id LIMIT 1
);
SET @seed_tier_04_id := (
    SELECT id FROM loyalty_tiers WHERE tier_name = 'Demo Seed Tier 04' ORDER BY id LIMIT 1
);

INSERT INTO customers (
    user_id, company_name, contact_person, phone, email, address, loyalty_tier_id
)
SELECT
    @seed_customer_02_user_id,
    'Demo Seed Cabinets',
    'Demo Customer Two',
    '+620000000004',
    'seed.customer02@example.test',
    '2 Example Street, Bandung',
    @seed_tier_02_id
FROM DUAL
WHERE @seed_customer_02_user_id IS NOT NULL
  AND @seed_tier_02_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customers WHERE user_id = @seed_customer_02_user_id
  )
UNION ALL
SELECT
    @seed_customer_03_user_id,
    'Demo Seed Studio',
    'Demo Customer Three',
    '+620000000005',
    'seed.customer03@example.test',
    '3 Example Street, Bandung',
    @seed_tier_03_id
FROM DUAL
WHERE @seed_customer_03_user_id IS NOT NULL
  AND @seed_tier_03_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customers WHERE user_id = @seed_customer_03_user_id
  )
UNION ALL
SELECT
    NULL,
    'Demo Seed Retail',
    'Demo Retail Contact',
    '+620000000006',
    'retail.contact@example.test',
    '4 Example Street, Bandung',
    @seed_tier_04_id
FROM DUAL
WHERE @seed_tier_04_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customers
      WHERE user_id IS NULL AND company_name = 'Demo Seed Retail'
  );

SET @seed_customer_02_id := (
    SELECT id FROM customers
    WHERE user_id = @seed_customer_02_user_id
    ORDER BY id
    LIMIT 1
);
SET @seed_customer_03_id := (
    SELECT id FROM customers
    WHERE user_id = @seed_customer_03_user_id
    ORDER BY id
    LIMIT 1
);
SET @seed_customer_04_id := (
    SELECT id FROM customers
    WHERE user_id IS NULL AND company_name = 'Demo Seed Retail'
    ORDER BY id
    LIMIT 1
);

INSERT INTO customer_credit_scores (
    customer_id, credit_score, recommended_credit_limit,
    allow_top_90, required_dp_percent
)
SELECT @seed_customer_02_id, 685, 18000000.00, TRUE, 30.00
FROM DUAL
WHERE @seed_customer_02_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customer_credit_scores WHERE customer_id = @seed_customer_02_id
  )
UNION ALL
SELECT @seed_customer_03_id, 755, 32000000.00, TRUE, 25.00
FROM DUAL
WHERE @seed_customer_03_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customer_credit_scores WHERE customer_id = @seed_customer_03_id
  )
UNION ALL
SELECT @seed_customer_04_id, 610, 10000000.00, FALSE, 40.00
FROM DUAL
WHERE @seed_customer_04_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customer_credit_scores WHERE customer_id = @seed_customer_04_id
  );

INSERT INTO materials (
    customer_id, material_code, material_name, thickness_mm,
    default_length_mm, default_width_mm, stock_sheets, has_grain_constraint
) VALUES
    (@seed_customer_02_id, 'SEED-MDF-18', 'Demo MDF 18mm', 18.00, 2440.00, 1220.00, 39, TRUE),
    (@seed_customer_03_id, 'SEED-ASH-15', 'Demo Ash 15mm', 15.00, 2440.00, 1220.00, 29, TRUE),
    (@seed_customer_04_id, 'SEED-PLY-09', 'Demo Plywood 9mm', 9.00, 2440.00, 1220.00, 19, FALSE)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_material_02_id := (
    SELECT id FROM materials WHERE material_code = 'SEED-MDF-18' LIMIT 1
);
SET @seed_material_03_id := (
    SELECT id FROM materials WHERE material_code = 'SEED-ASH-15' LIMIT 1
);
SET @seed_material_04_id := (
    SELECT id FROM materials WHERE material_code = 'SEED-PLY-09' LIMIT 1
);

INSERT INTO consignment_receipts (
    customer_id, receipt_number, material_id, received_quantity,
    remaining_quantity, length_mm, width_mm, received_date, notes
) VALUES
    (@seed_customer_02_id, 'RCV-DEMO-SEED-002', @seed_material_02_id, 40, 39, 2440.00, 1220.00, DATE_SUB(CURDATE(), INTERVAL 24 DAY), 'Demo MDF consignment.'),
    (@seed_customer_03_id, 'RCV-DEMO-SEED-003', @seed_material_03_id, 30, 29, 2440.00, 1220.00, DATE_SUB(CURDATE(), INTERVAL 18 DAY), 'Demo ash consignment.'),
    (@seed_customer_04_id, 'RCV-DEMO-SEED-004', @seed_material_04_id, 20, 19, 2440.00, 1220.00, DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'Demo plywood consignment.')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_receipt_02_id := (
    SELECT id FROM consignment_receipts WHERE receipt_number = 'RCV-DEMO-SEED-002' LIMIT 1
);
SET @seed_receipt_03_id := (
    SELECT id FROM consignment_receipts WHERE receipt_number = 'RCV-DEMO-SEED-003' LIMIT 1
);
SET @seed_receipt_04_id := (
    SELECT id FROM consignment_receipts WHERE receipt_number = 'RCV-DEMO-SEED-004' LIMIT 1
);

INSERT INTO legal_contracts (
    contract_title, terms_and_conditions, version, is_active
)
SELECT 'Demo Seed Purchase Contract 02', 'Dummy terms for local development only.', 'SEED-1', TRUE
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM legal_contracts
    WHERE contract_title = 'Demo Seed Purchase Contract 02' AND version = 'SEED-1'
)
UNION ALL
SELECT 'Demo Seed Purchase Contract 03', 'Dummy terms for local development only.', 'SEED-1', TRUE
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM legal_contracts
    WHERE contract_title = 'Demo Seed Purchase Contract 03' AND version = 'SEED-1'
)
UNION ALL
SELECT 'Demo Seed Purchase Contract 04', 'Dummy terms for local development only.', 'SEED-1', TRUE
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM legal_contracts
    WHERE contract_title = 'Demo Seed Purchase Contract 04' AND version = 'SEED-1'
);

SET @seed_contract_02_id := (
    SELECT id FROM legal_contracts WHERE contract_title = 'Demo Seed Purchase Contract 02' AND version = 'SEED-1' ORDER BY id LIMIT 1
);
SET @seed_contract_03_id := (
    SELECT id FROM legal_contracts WHERE contract_title = 'Demo Seed Purchase Contract 03' AND version = 'SEED-1' ORDER BY id LIMIT 1
);
SET @seed_contract_04_id := (
    SELECT id FROM legal_contracts WHERE contract_title = 'Demo Seed Purchase Contract 04' AND version = 'SEED-1' ORDER BY id LIMIT 1
);

INSERT INTO orders (
    order_number, customer_id, po_number, order_date, top_days,
    total_order_value, status
) VALUES
    ('PO-DEMO-SEED-002', @seed_customer_02_id, 'CUSTOMER-DEMO-002', DATE_SUB(CURDATE(), INTERVAL 24 DAY), 90, 1600000.00, 'completed'),
    ('PO-DEMO-SEED-003', @seed_customer_03_id, 'CUSTOMER-DEMO-003', DATE_SUB(CURDATE(), INTERVAL 18 DAY), 90, 2100000.00, 'completed'),
    ('PO-DEMO-SEED-004', @seed_customer_04_id, 'CUSTOMER-DEMO-004', DATE_SUB(CURDATE(), INTERVAL 12 DAY), 90, 900000.00, 'completed')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_order_02_id := (
    SELECT id FROM orders WHERE order_number = 'PO-DEMO-SEED-002' AND customer_id = @seed_customer_02_id LIMIT 1
);
SET @seed_order_03_id := (
    SELECT id FROM orders WHERE order_number = 'PO-DEMO-SEED-003' AND customer_id = @seed_customer_03_id LIMIT 1
);
SET @seed_order_04_id := (
    SELECT id FROM orders WHERE order_number = 'PO-DEMO-SEED-004' AND customer_id = @seed_customer_04_id LIMIT 1
);

INSERT INTO contract_approvals (
    order_id, legal_contract_id, customer_id, ip_address,
    digital_signature_hash, approved_at
) VALUES
    (@seed_order_02_id, @seed_contract_02_id, @seed_customer_02_id, '192.0.2.12', SHA2('demo-seed-contract-signature-02', 256), DATE_SUB(NOW(), INTERVAL 23 DAY)),
    (@seed_order_03_id, @seed_contract_03_id, @seed_customer_03_id, '192.0.2.13', SHA2('demo-seed-contract-signature-03', 256), DATE_SUB(NOW(), INTERVAL 17 DAY)),
    (@seed_order_04_id, @seed_contract_04_id, @seed_customer_04_id, '192.0.2.14', SHA2('demo-seed-contract-signature-04', 256), DATE_SUB(NOW(), INTERVAL 11 DAY))
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

INSERT INTO dp_payments (
    order_id, required_dp_percent, required_dp_amount, paid_amount,
    payment_date, payment_proof_url, verification_status, verified_by
)
SELECT @seed_order_02_id, 30.00, 480000.00, 480000.00, DATE_SUB(NOW(), INTERVAL 22 DAY), 'https://example.test/demo/dp-proof-02.png', 'verified', @seed_operator_02_id
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dp_payments WHERE order_id = @seed_order_02_id AND required_dp_amount = 480000.00)
UNION ALL
SELECT @seed_order_03_id, 25.00, 525000.00, 525000.00, DATE_SUB(NOW(), INTERVAL 16 DAY), 'https://example.test/demo/dp-proof-03.png', 'verified', @seed_operator_02_id
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dp_payments WHERE order_id = @seed_order_03_id AND required_dp_amount = 525000.00)
UNION ALL
SELECT @seed_order_04_id, 40.00, 360000.00, 360000.00, DATE_SUB(NOW(), INTERVAL 10 DAY), 'https://example.test/demo/dp-proof-04.png', 'verified', @seed_operator_02_id
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dp_payments WHERE order_id = @seed_order_04_id AND required_dp_amount = 360000.00);

INSERT INTO order_items (
    order_id, drawer_type_code, finished_length_mm, finished_width_mm,
    finished_height_mm, quantity, unit_price
)
SELECT @seed_order_02_id, 'DEMO-DRAWER-002', 450.00, 360.00, 130.00, 1, 1600000.00
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = @seed_order_02_id AND drawer_type_code = 'DEMO-DRAWER-002')
UNION ALL
SELECT @seed_order_03_id, 'DEMO-DRAWER-003', 600.00, 450.00, 180.00, 1, 2100000.00
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = @seed_order_03_id AND drawer_type_code = 'DEMO-DRAWER-003')
UNION ALL
SELECT @seed_order_04_id, 'DEMO-DRAWER-004', 400.00, 320.00, 100.00, 1, 900000.00
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = @seed_order_04_id AND drawer_type_code = 'DEMO-DRAWER-004');

SET @seed_order_item_02_id := (
    SELECT id FROM order_items WHERE order_id = @seed_order_02_id AND drawer_type_code = 'DEMO-DRAWER-002' ORDER BY id LIMIT 1
);
SET @seed_order_item_03_id := (
    SELECT id FROM order_items WHERE order_id = @seed_order_03_id AND drawer_type_code = 'DEMO-DRAWER-003' ORDER BY id LIMIT 1
);
SET @seed_order_item_04_id := (
    SELECT id FROM order_items WHERE order_id = @seed_order_04_id AND drawer_type_code = 'DEMO-DRAWER-004' ORDER BY id LIMIT 1
);

INSERT INTO component_items (
    order_item_id, component_type, material_id, raw_length_mm,
    raw_width_mm, grain_orientation, quantity
)
SELECT @seed_order_item_02_id, 'front', @seed_material_02_id, 364.00, 130.00, 'lengthwise', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM component_items WHERE order_item_id = @seed_order_item_02_id AND component_type = 'front' AND material_id = @seed_material_02_id)
UNION ALL
SELECT @seed_order_item_03_id, 'front', @seed_material_03_id, 454.00, 180.00, 'lengthwise', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM component_items WHERE order_item_id = @seed_order_item_03_id AND component_type = 'front' AND material_id = @seed_material_03_id)
UNION ALL
SELECT @seed_order_item_04_id, 'front', @seed_material_04_id, 324.00, 100.00, 'lengthwise', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM component_items WHERE order_item_id = @seed_order_item_04_id AND component_type = 'front' AND material_id = @seed_material_04_id);

SET @seed_component_02_id := (
    SELECT id FROM component_items WHERE order_item_id = @seed_order_item_02_id AND component_type = 'front' AND material_id = @seed_material_02_id ORDER BY id LIMIT 1
);
SET @seed_component_03_id := (
    SELECT id FROM component_items WHERE order_item_id = @seed_order_item_03_id AND component_type = 'front' AND material_id = @seed_material_03_id ORDER BY id LIMIT 1
);
SET @seed_component_04_id := (
    SELECT id FROM component_items WHERE order_item_id = @seed_order_item_04_id AND component_type = 'front' AND material_id = @seed_material_04_id ORDER BY id LIMIT 1
);

INSERT INTO offcuts (
    material_id, customer_id, length_mm, width_mm,
    grain_orientation, status, location_tag
)
SELECT @seed_material_02_id, @seed_customer_02_id, 800.00, 400.00, 'lengthwise', 'available', 'DEMO-SEED-OFFCUT-002'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM offcuts WHERE material_id = @seed_material_02_id AND location_tag = 'DEMO-SEED-OFFCUT-002')
UNION ALL
SELECT @seed_material_03_id, @seed_customer_03_id, 700.00, 350.00, 'any', 'available', 'DEMO-SEED-OFFCUT-003'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM offcuts WHERE material_id = @seed_material_03_id AND location_tag = 'DEMO-SEED-OFFCUT-003')
UNION ALL
SELECT @seed_material_04_id, @seed_customer_04_id, 650.00, 320.00, 'widthwise', 'available', 'DEMO-SEED-OFFCUT-004'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM offcuts WHERE material_id = @seed_material_04_id AND location_tag = 'DEMO-SEED-OFFCUT-004');

SET @seed_offcut_02_id := (
    SELECT id FROM offcuts WHERE material_id = @seed_material_02_id AND location_tag = 'DEMO-SEED-OFFCUT-002' ORDER BY id LIMIT 1
);
SET @seed_offcut_03_id := (
    SELECT id FROM offcuts WHERE material_id = @seed_material_03_id AND location_tag = 'DEMO-SEED-OFFCUT-003' ORDER BY id LIMIT 1
);
SET @seed_offcut_04_id := (
    SELECT id FROM offcuts WHERE material_id = @seed_material_04_id AND location_tag = 'DEMO-SEED-OFFCUT-004' ORDER BY id LIMIT 1
);

INSERT INTO consignment_usage (
    consignment_receipt_id, order_id, used_quantity, used_at
)
SELECT @seed_receipt_02_id, @seed_order_02_id, 1, DATE_SUB(NOW(), INTERVAL 21 DAY)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM consignment_usage WHERE consignment_receipt_id = @seed_receipt_02_id AND order_id = @seed_order_02_id)
UNION ALL
SELECT @seed_receipt_03_id, @seed_order_03_id, 1, DATE_SUB(NOW(), INTERVAL 15 DAY)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM consignment_usage WHERE consignment_receipt_id = @seed_receipt_03_id AND order_id = @seed_order_03_id)
UNION ALL
SELECT @seed_receipt_04_id, @seed_order_04_id, 1, DATE_SUB(NOW(), INTERVAL 9 DAY)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM consignment_usage WHERE consignment_receipt_id = @seed_receipt_04_id AND order_id = @seed_order_04_id);

INSERT INTO cutting_jobs (
    order_id, job_number, material_id, source_type,
    source_sheet_length, source_sheet_width, used_offcut_id,
    kerf_thickness_mm, dovetail_allowance_mm,
    yield_rate_percent, waste_rate_percent, status, operator_id, finished_at
) VALUES
    (@seed_order_02_id, 'CJ-DEMO-SEED-002', @seed_material_02_id, 'full_sheet', 2440.00, 1220.00, NULL, 3.00, 4.00, 1.59, 98.41, 'completed', @seed_operator_02_id, DATE_SUB(NOW(), INTERVAL 16 DAY)),
    (@seed_order_03_id, 'CJ-DEMO-SEED-003', @seed_material_03_id, 'full_sheet', 2440.00, 1220.00, NULL, 3.00, 4.00, 2.75, 97.25, 'completed', @seed_operator_02_id, DATE_SUB(NOW(), INTERVAL 10 DAY)),
    (@seed_order_04_id, 'CJ-DEMO-SEED-004', @seed_material_04_id, 'full_sheet', 2440.00, 1220.00, NULL, 3.00, 4.00, 1.09, 98.91, 'completed', @seed_operator_02_id, DATE_SUB(NOW(), INTERVAL 4 DAY))
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_cutting_job_02_id := (
    SELECT id FROM cutting_jobs WHERE job_number = 'CJ-DEMO-SEED-002' LIMIT 1
);
SET @seed_cutting_job_03_id := (
    SELECT id FROM cutting_jobs WHERE job_number = 'CJ-DEMO-SEED-003' LIMIT 1
);
SET @seed_cutting_job_04_id := (
    SELECT id FROM cutting_jobs WHERE job_number = 'CJ-DEMO-SEED-004' LIMIT 1
);

INSERT INTO cutting_patterns (
    cutting_job_id, component_item_id, label, pos_x, pos_y,
    width_mm, height_mm, cut_step_order, is_offcut_usable
)
SELECT @seed_cutting_job_02_id, @seed_component_02_id, 'front', 0, 0, 364, 130, 1, FALSE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cutting_patterns WHERE cutting_job_id = @seed_cutting_job_02_id AND cut_step_order = 1)
UNION ALL
SELECT @seed_cutting_job_03_id, @seed_component_03_id, 'front', 0, 0, 454, 180, 1, FALSE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cutting_patterns WHERE cutting_job_id = @seed_cutting_job_03_id AND cut_step_order = 1)
UNION ALL
SELECT @seed_cutting_job_04_id, @seed_component_04_id, 'front', 0, 0, 324, 100, 1, FALSE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cutting_patterns WHERE cutting_job_id = @seed_cutting_job_04_id AND cut_step_order = 1);

INSERT INTO qc_inspections (
    order_id, inspection_number, inspector_id, quantity_inspected,
    inspection_date, squareness_passed, dimension_passed, overall_status, notes
) VALUES
    (@seed_order_02_id, 'QC-DEMO-SEED-002', @seed_operator_02_id, 1, DATE_SUB(NOW(), INTERVAL 8 DAY), TRUE, TRUE, 'passed', 'Demo QC inspection 02.'),
    (@seed_order_03_id, 'QC-DEMO-SEED-003', @seed_operator_02_id, 1, DATE_SUB(NOW(), INTERVAL 6 DAY), TRUE, TRUE, 'passed', 'Demo QC inspection 03.'),
    (@seed_order_04_id, 'QC-DEMO-SEED-004', @seed_operator_02_id, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), TRUE, TRUE, 'passed', 'Demo QC inspection 04.')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_qc_02_id := (
    SELECT id FROM qc_inspections WHERE inspection_number = 'QC-DEMO-SEED-002' LIMIT 1
);
SET @seed_qc_03_id := (
    SELECT id FROM qc_inspections WHERE inspection_number = 'QC-DEMO-SEED-003' LIMIT 1
);
SET @seed_qc_04_id := (
    SELECT id FROM qc_inspections WHERE inspection_number = 'QC-DEMO-SEED-004' LIMIT 1
);

INSERT INTO deliveries (
    order_id, qc_inspection_id, delivery_note_number, delivery_date,
    truck_plate_number, driver_name, quantity_shipped,
    received_status, received_date
) VALUES
    (@seed_order_02_id, @seed_qc_02_id, 'SJ-DEMO-SEED-002', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'D 2345 DEMO', 'Demo Driver Two', 1, TRUE, DATE_SUB(CURDATE(), INTERVAL 4 DAY)),
    (@seed_order_03_id, @seed_qc_03_id, 'SJ-DEMO-SEED-003', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'D 3456 DEMO', 'Demo Driver Three', 1, TRUE, DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
    (@seed_order_04_id, @seed_qc_04_id, 'SJ-DEMO-SEED-004', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'D 4567 DEMO', 'Demo Driver Four', 1, TRUE, CURDATE())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_delivery_02_id := (
    SELECT id FROM deliveries WHERE delivery_note_number = 'SJ-DEMO-SEED-002' LIMIT 1
);
SET @seed_delivery_03_id := (
    SELECT id FROM deliveries WHERE delivery_note_number = 'SJ-DEMO-SEED-003' LIMIT 1
);
SET @seed_delivery_04_id := (
    SELECT id FROM deliveries WHERE delivery_note_number = 'SJ-DEMO-SEED-004' LIMIT 1
);

INSERT INTO delivery_items (delivery_id, order_item_id, quantity_shipped)
SELECT @seed_delivery_02_id, @seed_order_item_02_id, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM delivery_items WHERE delivery_id = @seed_delivery_02_id AND order_item_id = @seed_order_item_02_id)
UNION ALL
SELECT @seed_delivery_03_id, @seed_order_item_03_id, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM delivery_items WHERE delivery_id = @seed_delivery_03_id AND order_item_id = @seed_order_item_03_id)
UNION ALL
SELECT @seed_delivery_04_id, @seed_order_item_04_id, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM delivery_items WHERE delivery_id = @seed_delivery_04_id AND order_item_id = @seed_order_item_04_id);

INSERT INTO invoices (
    invoice_number, order_id, invoice_date, due_date,
    total_amount, paid_amount, status
) VALUES
    ('INV-DEMO-SEED-002', @seed_order_02_id, DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_ADD(CURDATE(), INTERVAL 72 DAY), 1600000.00, 200000.00, 'partially_paid'),
    ('INV-DEMO-SEED-003', @seed_order_03_id, DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_ADD(CURDATE(), INTERVAL 78 DAY), 2100000.00, 300000.00, 'partially_paid'),
    ('INV-DEMO-SEED-004', @seed_order_04_id, DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_ADD(CURDATE(), INTERVAL 84 DAY), 900000.00, 100000.00, 'partially_paid')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @seed_invoice_02_id := (
    SELECT id FROM invoices WHERE order_id = @seed_order_02_id LIMIT 1
);
SET @seed_invoice_03_id := (
    SELECT id FROM invoices WHERE order_id = @seed_order_03_id LIMIT 1
);
SET @seed_invoice_04_id := (
    SELECT id FROM invoices WHERE order_id = @seed_order_04_id LIMIT 1
);

INSERT INTO invoice_payments (
    invoice_id, payment_number, payment_date, amount_paid,
    payment_method, payment_proof_url, verified_by, notes
) VALUES
    (@seed_invoice_02_id, 'PAY-DEMO-SEED-002', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 200000.00, 'bank_transfer', 'https://example.test/demo/invoice-proof-02.png', @seed_operator_02_id, 'Demo payment 02.'),
    (@seed_invoice_03_id, 'PAY-DEMO-SEED-003', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 300000.00, 'giro', 'https://example.test/demo/invoice-proof-03.png', @seed_operator_02_id, 'Demo payment 03.'),
    (@seed_invoice_04_id, 'PAY-DEMO-SEED-004', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 100000.00, 'cash', NULL, @seed_operator_02_id, 'Demo payment 04.')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

INSERT INTO rma_requests (
    rma_number, order_id, delivery_id, customer_id, request_date,
    proof_media_url, claim_reason, verification_status, action_type,
    credit_note_amount
) VALUES
    ('RMA-DEMO-SEED-002', @seed_order_02_id, @seed_delivery_02_id, @seed_customer_02_id, DATE_SUB(NOW(), INTERVAL 2 DAY), 'https://example.test/demo/rma-proof-02.png', 'Demo replacement claim.', 'pending', NULL, 0.00),
    ('RMA-DEMO-SEED-003', @seed_order_03_id, @seed_delivery_03_id, @seed_customer_03_id, DATE_SUB(NOW(), INTERVAL 1 DAY), 'https://example.test/demo/rma-proof-03.png', 'Demo credit note claim.', 'verified', 'credit_note', 100000.00),
    ('RMA-DEMO-SEED-004', @seed_order_04_id, @seed_delivery_04_id, @seed_customer_04_id, NOW(), 'https://example.test/demo/rma-proof-04.png', 'Demo rejected claim.', 'rejected', NULL, 0.00)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

INSERT INTO po_tracking_logs (
    order_id, stage, affected_quantity, status_description, updated_by
)
SELECT @seed_order_02_id, 'Completed', 1, 'Demo seed order 02 completed.', @seed_operator_02_id
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM po_tracking_logs WHERE order_id = @seed_order_02_id AND stage = 'Completed')
UNION ALL
SELECT @seed_order_03_id, 'Completed', 1, 'Demo seed order 03 completed.', @seed_operator_02_id
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM po_tracking_logs WHERE order_id = @seed_order_03_id AND stage = 'Completed')
UNION ALL
SELECT @seed_order_04_id, 'Completed', 1, 'Demo seed order 04 completed.', @seed_operator_02_id
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM po_tracking_logs WHERE order_id = @seed_order_04_id AND stage = 'Completed');

INSERT INTO activity_logs (
    user_id, order_id, action_type, module_name, reference_id,
    description, ip_address
)
SELECT @seed_operator_02_id, @seed_order_02_id, 'FINISH_CUTTING', 'cutting_jobs', @seed_cutting_job_02_id, 'Completed demo cutting job 02.', '192.0.2.22'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM activity_logs WHERE user_id = @seed_operator_02_id AND order_id = @seed_order_02_id AND action_type = 'FINISH_CUTTING' AND module_name = 'cutting_jobs' AND reference_id = @seed_cutting_job_02_id)
UNION ALL
SELECT @seed_operator_02_id, @seed_order_03_id, 'SUBMIT_QC', 'qc_inspections', @seed_qc_03_id, 'Submitted demo QC inspection 03.', '192.0.2.23'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM activity_logs WHERE user_id = @seed_operator_02_id AND order_id = @seed_order_03_id AND action_type = 'SUBMIT_QC' AND module_name = 'qc_inspections' AND reference_id = @seed_qc_03_id)
UNION ALL
SELECT @seed_operator_02_id, @seed_order_04_id, 'FINISH_CUTTING', 'cutting_jobs', @seed_cutting_job_04_id, 'Completed demo cutting job 04.', '192.0.2.24'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM activity_logs WHERE user_id = @seed_operator_02_id AND order_id = @seed_order_04_id AND action_type = 'FINISH_CUTTING' AND module_name = 'cutting_jobs' AND reference_id = @seed_cutting_job_04_id);

INSERT INTO email_verification_tokens (user_id, token, expires_at)
SELECT @seed_operator_02_id, REPEAT('2', 64), DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM email_verification_tokens WHERE user_id = @seed_operator_02_id AND token = REPEAT('2', 64))
UNION ALL
SELECT @seed_customer_02_user_id, REPEAT('3', 64), DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM email_verification_tokens WHERE user_id = @seed_customer_02_user_id AND token = REPEAT('3', 64))
UNION ALL
SELECT @seed_customer_03_user_id, REPEAT('4', 64), DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM email_verification_tokens WHERE user_id = @seed_customer_03_user_id AND token = REPEAT('4', 64));

COMMIT;

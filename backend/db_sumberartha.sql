CREATE DATABASE IF NOT EXISTS db_sumber_artha_v3;
USE db_sumber_artha_v3;

-- ============================================================================
-- KELOMPOK 1: PENGGUNA, LOYALTY & KELAYAKAN KREDIT CUSTOMER
-- ============================================================================

-- 1. Tabel Pengguna (Admin, Operator, Customer)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(30),
    role ENUM('admin', 'operator', 'customer') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Master Loyalty Tiers
CREATE TABLE loyalty_tiers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL, -- Bronze, Silver, Gold, Platinum
    min_repeat_orders INT DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    priority_level INT DEFAULT 1
);

-- 3. Data Pelanggan / Buyer (Sekaligus Pemasok Bahan Baku Utama)
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    company_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(100),
    address TEXT,
    loyalty_tier_id INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (loyalty_tier_id) REFERENCES loyalty_tiers(id)
);

-- 4. Credit Scoring & Dynamic Credit Limit Customer
CREATE TABLE customer_credit_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL UNIQUE,
    credit_score INT NOT NULL DEFAULT 500, -- Range 300 - 850
    recommended_credit_limit DECIMAL(15,2) DEFAULT 0.00,
    allow_top_90 BOOLEAN DEFAULT TRUE,
    required_dp_percent DECIMAL(5,2) DEFAULT 30.00,
    last_evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================================================
-- KELOMPOK 2: MATERIAL PASOKAN CUSTOMER, KONTRAK DIGITAL, PO & DP
-- ============================================================================

-- 5. Master Data Material & Informasi Kepemilikan Bahan dari Customer
CREATE TABLE materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NULL, -- Menunjukkan material ini titipan/pasokan dari customer siapa
    material_code VARCHAR(30) NOT NULL UNIQUE,
    material_name VARCHAR(100) NOT NULL, -- Contoh: 'LVB Poplar', 'LVB Sengon', 'Plywood'
    thickness_mm DECIMAL(5,2) DEFAULT 12.00,
    default_length_mm DECIMAL(8,2) DEFAULT 2440.00,
    default_width_mm DECIMAL(8,2) DEFAULT 1220.00,
    stock_sheets INT DEFAULT 0, -- Saldo lembar tersedia dari customer tersebut
    has_grain_constraint BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 6. Riwayat Penerimaan Bahan Baku dari Customer (Konsinyasi Masuk)
CREATE TABLE consignment_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    material_id INT NOT NULL,
    received_quantity INT NOT NULL,
    remaining_quantity INT NOT NULL, -- Saldo sisa lembar dari batch penerimaan ini
    length_mm DECIMAL(8,2) NOT NULL DEFAULT 2440.00,
    width_mm DECIMAL(8,2) NOT NULL DEFAULT 1220.00,
    received_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (material_id) REFERENCES materials(id)
);

-- 7. Master Kontrak Digital & Legal Lock-in
CREATE TABLE legal_contracts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contract_title VARCHAR(150) NOT NULL,
    terms_and_conditions TEXT NOT NULL,
    version VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Pesanan Make-to-Order (MTO)
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    po_number VARCHAR(50) NOT NULL,
    order_date DATE NOT NULL,
    top_days INT DEFAULT 90,
    total_order_value DECIMAL(15,2) DEFAULT 0.00,
    status ENUM('draft', 'contract_signed', 'dp_pending', 'ready_for_production', 'in_production', 'partially_shipped', 'completed', 'cancelled') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 9. Persetujuan Kontrak Digital Customer
CREATE TABLE contract_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL UNIQUE,
    legal_contract_id INT NOT NULL,
    customer_id INT NOT NULL,
    ip_address VARCHAR(45),
    digital_signature_hash VARCHAR(255) NOT NULL,
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (legal_contract_id) REFERENCES legal_contracts(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 10. Manajemen Pembayaran Down Payment (DP)
CREATE TABLE dp_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    required_dp_percent DECIMAL(5,2) NOT NULL,
    required_dp_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0.00,
    payment_date TIMESTAMP NULL,
    payment_proof_url VARCHAR(255),
    verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    verified_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id)
);

-- ============================================================================
-- KELOMPOK 3: ITEM ORDER, PRODUKSI, OPTIMASI 2D & OFFCUT INTERNAL
-- ============================================================================

-- 11. Detail Item Laci per Pesanan
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    drawer_type_code VARCHAR(50) NOT NULL,
    finished_length_mm DECIMAL(8,2) NOT NULL,
    finished_width_mm DECIMAL(8,2) NOT NULL,
    finished_height_mm DECIMAL(8,2) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(15,2) DEFAULT 0.00,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 12. Komponen Rinci Laci (Panel Breakdown)
CREATE TABLE component_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_item_id INT NOT NULL,
    component_type ENUM('front', 'back', 'side_left', 'side_right', 'bottom') NOT NULL,
    material_id INT NOT NULL,
    raw_length_mm DECIMAL(8,2) NOT NULL,
    raw_width_mm DECIMAL(8,2) NOT NULL,
    grain_orientation ENUM('lengthwise', 'widthwise', 'any') DEFAULT 'lengthwise',
    quantity INT NOT NULL,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
);

-- 13. Inventaris Sisa Potongan Internal (Offcut Tracking - Tanpa Marketplace)
CREATE TABLE offcuts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    customer_id INT NULL, -- Penanda milik bahan customer mana
    length_mm DECIMAL(8,2) NOT NULL,
    width_mm DECIMAL(8,2) NOT NULL,
    grain_orientation ENUM('lengthwise', 'widthwise', 'any') DEFAULT 'lengthwise',
    status ENUM('available', 'reserved', 'used', 'scrapped') DEFAULT 'available',
    location_tag VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 14. Pemakaian Material Pasokan Customer per PO
CREATE TABLE consignment_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    consignment_receipt_id INT NOT NULL,
    order_id INT NOT NULL,
    used_quantity INT NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consignment_receipt_id) REFERENCES consignment_receipts(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- 15. Instruksi Kerja Pemotongan (Cutting Job)
CREATE TABLE cutting_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    job_number VARCHAR(50) NOT NULL UNIQUE,
    material_id INT NOT NULL,
    source_type ENUM('full_sheet', 'offcut', 'consignment') DEFAULT 'consignment',
    source_sheet_length DECIMAL(8,2) DEFAULT 2440.00,
    source_sheet_width DECIMAL(8,2) DEFAULT 1220.00,
    used_offcut_id INT NULL,
    kerf_thickness_mm DECIMAL(4,2) DEFAULT 3.00,
    dovetail_allowance_mm DECIMAL(4,2) DEFAULT 4.00,
    yield_rate_percent DECIMAL(5,2),
    waste_rate_percent DECIMAL(5,2),
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    operator_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (material_id) REFERENCES materials(id),
    FOREIGN KEY (used_offcut_id) REFERENCES offcuts(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- 16. Detail Pola Potong 2D (Cutting Patterns)
CREATE TABLE cutting_patterns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cutting_job_id INT NOT NULL,
    component_item_id INT NULL,
    label VARCHAR(50),
    pos_x DECIMAL(8,2) NOT NULL,
    pos_y DECIMAL(8,2) NOT NULL,
    width_mm DECIMAL(8,2) NOT NULL,
    height_mm DECIMAL(8,2) NOT NULL,
    cut_step_order INT NOT NULL,
    is_offcut_usable BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (cutting_job_id) REFERENCES cutting_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (component_item_id) REFERENCES component_items(id)
);

-- ============================================================================
-- KELOMPOK 4: QC, PENGIRIMAN, INVOICING, PELUNASAN, RMA & AUDIT LOG
-- ============================================================================

-- 17. Inspeksi QC & Sertifikasi Kelayakan Kirim
CREATE TABLE qc_inspections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    inspection_number VARCHAR(50) NOT NULL UNIQUE,
    inspector_id INT NOT NULL,
    quantity_inspected INT NOT NULL,
    inspection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    squareness_passed BOOLEAN NOT NULL DEFAULT FALSE,
    dimension_passed BOOLEAN NOT NULL DEFAULT FALSE,
    overall_status ENUM('passed', 'rejected') NOT NULL,
    certificate_pdf_url VARCHAR(255),
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (inspector_id) REFERENCES users(id)
);

-- 18. Pengiriman Bertahap (Surat Jalan)
CREATE TABLE deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    qc_inspection_id INT NOT NULL,
    delivery_note_number VARCHAR(50) NOT NULL UNIQUE,
    delivery_date DATE NOT NULL,
    truck_plate_number VARCHAR(20) NOT NULL,
    driver_name VARCHAR(100),
    quantity_shipped INT NOT NULL,
    received_status BOOLEAN DEFAULT FALSE,
    received_date DATE NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (qc_inspection_id) REFERENCES qc_inspections(id)
);

-- 19. Detail Item per Surat Jalan (Untuk Perhitungan Tagihan Parsial Akurat)
CREATE TABLE delivery_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_id INT NOT NULL,
    order_item_id INT NOT NULL,
    quantity_shipped INT NOT NULL,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id)
);

-- 20. Invoicing TOP 90 Hari (Relasi 1-to-1 dengan Orders sesuai Desain Bab III)
CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    order_id INT NOT NULL UNIQUE, -- Relasi 1-to-1 dengan orders
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL, -- Otomatis +90 hari
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0.00,
    status ENUM('unpaid', 'partially_paid', 'paid', 'overdue') DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- 21. Pencatatan Pelunasan Tagihan / Invoice Payments (Baru)
CREATE TABLE invoice_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    payment_date DATE NOT NULL,
    amount_paid DECIMAL(15,2) NOT NULL,
    payment_method ENUM('bank_transfer', 'giro', 'cash', 'credit_note') DEFAULT 'bank_transfer',
    payment_proof_url VARCHAR(255),
    verified_by INT NULL, -- Admin yang memverifikasi pelunasan
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id)
);

-- 22. Manajemen Retur & Klaim Cacat Produksi (RMA Engine)
CREATE TABLE rma_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rma_number VARCHAR(50) NOT NULL UNIQUE,
    order_id INT NOT NULL,
    delivery_id INT NOT NULL,
    customer_id INT NOT NULL,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    proof_media_url VARCHAR(255) NOT NULL,
    claim_reason TEXT NOT NULL,
    verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    action_type ENUM('replacement', 'credit_note') NULL,
    credit_note_amount DECIMAL(15,2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 23. Portal Live PO Tracking Logs
CREATE TABLE po_tracking_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    stage ENUM('PO_Created', 'Contract_Signed', 'DP_Verified', 'Cutting', 'Assembly', 'QC_Inspection', 'Shipping', 'Completed') NOT NULL,
    affected_quantity INT NULL,
    status_description TEXT,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notification_sent_wa BOOLEAN DEFAULT FALSE,
    notification_sent_email BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- 24. History Log Aktivitas (Admin Memantau Aktivitas Operator) (Baru)
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- ID Operator yang melakukan aksi
    order_id INT NULL, -- Opsional: terkait PO nomor berapa
    action_type VARCHAR(50) NOT NULL, -- Contoh: 'START_CUTTING', 'FINISH_CUTTING', 'INPUT_OFFCUT', 'SUBMIT_QC', 'UPDATE_PRODUCTION_STATUS'
    module_name VARCHAR(50) NOT NULL, -- Contoh: 'cutting_jobs', 'offcuts', 'qc_inspections'
    reference_id INT NULL, -- ID record pada tabel modul terkait
    description TEXT NOT NULL, -- Detail aktivitas untuk dibaca Admin
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- ============================================================================
-- DATA MASTER DEFAULT
-- ============================================================================
INSERT INTO loyalty_tiers (id, tier_name, min_repeat_orders, discount_percentage, priority_level) 
VALUES (1, 'Bronze', 0, 0.00, 1)
ON DUPLICATE KEY UPDATE tier_name=VALUES(tier_name);
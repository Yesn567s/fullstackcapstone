// src/routes/operator.js
// Routes read-only dashboard Operator (RBAC: admin + operator).
const express = require('express');
const Joi = require('joi');

const ctrl = require('../controllers/operatorController');
const { authMiddleware } = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const validateBody = require('../middleware/validateBody');

const router = express.Router();

router.use(authMiddleware, requireStaff);

const jobStatusSchema = Joi.object({
  status: Joi.string().valid('in_progress', 'completed').required(),
}).unknown(false);

const stageSchema = Joi.object({
  stage: Joi.string().valid('Cutting', 'Assembly', 'QC_Inspection').required(),
  description: Joi.string().trim().max(255).allow('', null),
}).unknown(false);

const offcutSchema = Joi.object({
  material_id: Joi.number().integer().positive().required(),
  customer_id: Joi.number().integer().positive().allow(null),
  length_mm: Joi.number().positive().max(9999).precision(2).required(),
  width_mm: Joi.number().positive().max(9999).precision(2).required(),
  grain_orientation: Joi.string().valid('lengthwise', 'widthwise', 'any').default('lengthwise'),
  location_tag: Joi.string().trim().max(50).allow('', null),
  quantity: Joi.number().integer().positive().max(500).default(1),
}).unknown(false);

const qcSchema = Joi.object({
  order_id: Joi.number().integer().positive().required(),
  quantity_inspected: Joi.number().integer().positive().required(),
  squareness_passed: Joi.boolean().required(),
  dimension_passed: Joi.boolean().required(),
  notes: Joi.string().trim().max(1000).allow('', null),
}).unknown(false);

// GET /api/operator/summary -> kartu ringkasan dashboard
router.get('/summary', ctrl.getSummary);

// GET /api/operator/jobs?status=pending|in_progress|completed
router.get('/jobs', ctrl.getJobs);

// GET /api/operator/deliveries
router.get('/deliveries', ctrl.getDeliveries);

// GET /api/operator/offcuts -> inventory and counts from offcuts table
router.get('/offcuts/materials', ctrl.listOffcutMaterials);
router.get('/offcuts', ctrl.listOffcuts);

// PATCH /api/operator/jobs/:id/status  body: { status: in_progress|completed }
router.patch(
  '/jobs/:id/status',
  validateBody(jobStatusSchema, 'Status pekerjaan tidak valid.'),
  ctrl.updateJobStatus,
);

// GET /api/operator/jobs/:id/patterns -> pola potong 2D urut cut_step_order
router.get('/jobs/:id/patterns', ctrl.getJobPatterns);

// PATCH /api/operator/orders/:id/stage  body: { stage: Cutting|Assembly|QC_Inspection, description? }
router.patch(
  '/orders/:id/stage',
  validateBody(stageSchema, 'Tahapan produksi tidak valid.'),
  ctrl.updateOrderStage,
);

// POST /api/operator/offcuts  body: { material_id, customer_id?, length_mm, width_mm, grain_orientation?, location_tag? }
router.post(
  '/offcuts',
  validateBody(offcutSchema, 'Data offcut tidak valid.'),
  ctrl.createOffcut,
);

// POST /api/operator/qc  body: { order_id, quantity_inspected, squareness_passed, dimension_passed, notes? }
router.post(
  '/qc',
  validateBody(qcSchema, 'Data QC tidak valid.'),
  ctrl.submitQC,
);

module.exports = router;

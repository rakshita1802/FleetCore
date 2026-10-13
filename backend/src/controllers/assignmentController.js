const { assignmentSchema } = require('../validators/fleetValidators');
const assignmentService = require('../services/assignmentService');

const getAssignments = async (req, res, next) => {
  try {
    const result = await assignmentService.getAssignments(req.user.companyId, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await assignmentService.getAssignmentById(req.user.companyId, req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.status(200).json({ success: true, data: assignment });
  } catch (err) { next(err); }
};

const createAssignment = async (req, res, next) => {
  try {
    const validatedData = assignmentSchema.parse(req.body);
    const assignment = await assignmentService.createAssignment(req.user.companyId, validatedData);
    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: err.errors });
    if (err.code === 409) return res.status(409).json({ success: false, message: err.message });
    if (err.message.includes('not found') || err.message.includes('cross-tenant')) return res.status(404).json({ success: false, message: err.message });
    if (err.message.includes('retired') || err.message.includes('active')) return res.status(422).json({ success: false, message: err.message });
    next(err);
  }
};

const unassign = async (req, res, next) => {
  try {
    const result = await assignmentService.unassign(req.user.companyId, req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Assignment not found') return res.status(404).json({ success: false, message: err.message });
    if (err.message.includes('already inactive')) return res.status(422).json({ success: false, message: err.message });
    next(err);
  }
};

module.exports = { getAssignments, getAssignmentById, createAssignment, unassign };

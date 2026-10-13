const { z } = require('zod');

const dateRangeSchema = z.object({
  startDate: z.string().datetime({ message: "Invalid startDate format, must be ISO 8601" }).optional(),
  endDate: z.string().datetime({ message: "Invalid endDate format, must be ISO 8601" }).optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: "startDate must be before or equal to endDate",
  path: ["startDate"]
});

const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20")
});

const validateDateRange = (req, res, next) => {
  try {
    const validated = dateRangeSchema.parse(req.query);
    req.query.startDate = validated.startDate;
    req.query.endDate = validated.endDate;
    next();
  } catch (error) {
    return res.status(400).json({ success: false, errors: error.errors || [{ message: error.message }] });
  }
};

const validatePagination = (req, res, next) => {
  try {
    const validated = paginationSchema.parse(req.query);
    req.query.page = validated.page;
    req.query.limit = Math.min(validated.limit, 100); // max 100
    next();
  } catch (error) {
    return res.status(400).json({ success: false, errors: error.errors || [{ message: error.message }] });
  }
};

const sortAllowlist = [
  'distanceKm', 'tripCount', 'idleMinutes', 'utilizationRate', 'registrationNumber', 'createdAt'
];

const validateSorting = (req, res, next) => {
  let { sortBy, sortDir } = req.query;
  
  if (sortBy && !sortAllowlist.includes(sortBy)) {
    return res.status(400).json({ success: false, message: `Invalid sortBy field. Allowed: ${sortAllowlist.join(', ')}` });
  }
  
  if (sortDir && !['asc', 'desc'].includes(sortDir.toLowerCase())) {
    return res.status(400).json({ success: false, message: "sortDir must be 'asc' or 'desc'" });
  }
  
  req.query.sortBy = sortBy || 'createdAt';
  req.query.sortDir = (sortDir || 'desc').toLowerCase();
  
  next();
};

module.exports = {
  validateDateRange,
  validatePagination,
  validateSorting
};

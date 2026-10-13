const adminService = require('../services/adminService');
const {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
  setStatusSchema
} = require('../validators/adminValidators');

const getReqMeta = (req) => ({
  ip: req.ip || req.connection?.remoteAddress,
  userAgent: req.headers['user-agent']
});

exports.getOverview = async (req, res, next) => {
  try {
    const overview = await adminService.getCompanyAdminOverview(req.user.companyId);
    res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
};

exports.getSystemHealth = async (req, res, next) => {
  try {
    const health = await adminService.getSystemHealthOverview();
    res.status(200).json({
      success: true,
      data: health
    });
  } catch (error) {
    next(error);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const validatedQuery = listUsersQuerySchema.parse(req.query);
    const result = await adminService.listUsers(req.user.companyId, validatedQuery);
    res.status(200).json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.issues || error.errors
      });
    }
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.user.companyId, req.params.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
    const user = await adminService.createUser(
      req.user.companyId,
      validatedData,
      req.user,
      getReqMeta(req)
    );
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.issues || error.errors
      });
    }
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const validatedData = updateUserSchema.parse(req.body);
    const user = await adminService.updateUser(
      req.user.companyId,
      req.params.id,
      validatedData,
      req.user,
      getReqMeta(req)
    );
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.issues || error.errors
      });
    }
    next(error);
  }
};

exports.changeRole = async (req, res, next) => {
  try {
    const { role } = changeRoleSchema.parse(req.body);
    const user = await adminService.changeUserRole(
      req.user.companyId,
      req.params.id,
      role,
      req.user,
      getReqMeta(req)
    );
    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: user
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.issues || error.errors
      });
    }
    next(error);
  }
};

exports.activateUser = async (req, res, next) => {
  try {
    const user = await adminService.setUserStatus(
      req.user.companyId,
      req.params.id,
      'ACTIVE',
      req.user,
      getReqMeta(req)
    );
    res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.deactivateUser = async (req, res, next) => {
  try {
    const user = await adminService.setUserStatus(
      req.user.companyId,
      req.params.id,
      'INACTIVE',
      req.user,
      getReqMeta(req)
    );
    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

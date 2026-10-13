const authService = require('../services/authService');
const { registerSchema, loginSchema } = require('../validators/authValidators');

const setRefreshCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

const register = async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const { user, accessToken, refreshToken } = await authService.registerUser(validatedData, reqMeta);
    
    setRefreshCookie(res, refreshToken);
    
    res.status(201).json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      }
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, message: "Validation error", errors: err.issues || err.errors });
    }
    if (err.message === 'Email already registered') {
      return res.status(409).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const { user, accessToken, refreshToken } = await authService.loginUser(validatedData.email, validatedData.password, reqMeta);
    
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      }
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, message: "Validation error", errors: err.issues || err.errors });
    }
    if (err.message === 'Invalid email or password' || err.message === 'Account is inactive') {
      return res.status(401).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: "No refresh token provided" });

    const { user, accessToken, refreshToken } = await authService.refreshSession(token);
    
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken }
    });
  } catch (err) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', { 
      path: '/api/auth/refresh',
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
    });
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    await authService.logoutSession(token);
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', { 
      path: '/api/auth/refresh',
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
    });
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        company: req.user.company
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me
};

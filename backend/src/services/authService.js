const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('./auditService');
const crypto = require('crypto');

const registerUser = async (data, reqMeta = {}) => {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Pre-calculate hash outside of the interactive transaction to avoid transaction timeout
  const hashedPassword = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: data.companyName }
    });
    
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hashedPassword,
        companyId: company.id,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });

    const refreshToken = generateRefreshToken(user);
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await tx.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: hashedRefreshToken,
        expiresAt
      }
    });

    const accessToken = generateAccessToken(user);

    return { user, company, accessToken, refreshToken };
  }, {
    maxWait: 10000,
    timeout: 20000
  });

  // Audit log after transaction commits successfully
  await logAudit({
    companyId: result.company.id,
    userId: result.user.id,
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: result.user.id,
    metadata: { role: result.user.role, companyName: result.company.name },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });

  return { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
};

const loginUser = async (email, password, reqMeta = {}) => {
  const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.status === 'INACTIVE') {
    throw new Error("Account is inactive");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      metadata: { reason: 'invalid_credentials' },
      ipAddress: reqMeta.ip,
      userAgent: reqMeta.userAgent
    });
    throw new Error("Invalid email or password");
  }

  const refreshToken = generateRefreshToken(user);
  const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hashedRefreshToken,
      expiresAt
    }
  });

  const accessToken = generateAccessToken(user);

  await logAudit({
    companyId: user.companyId,
    userId: user.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: user.id,
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });

  return { user, accessToken, refreshToken };
};

const refreshSession = async (token) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashedToken },
    include: { user: true }
  });

  if (!session || session.revokedAt || new Date() > session.expiresAt) {
    if (session && !session.revokedAt) {
      await prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() }
      });
    }
    throw new Error("Invalid refresh token");
  }

  // Revoke old session
  await prisma.refreshSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() }
  });

  // Issue new
  const newRefreshToken = generateRefreshToken(session.user);
  const newHashedToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshSession.create({
    data: {
      userId: session.user.id,
      tokenHash: newHashedToken,
      expiresAt
    }
  });

  const accessToken = generateAccessToken(session.user);
  return { user: session.user, accessToken, refreshToken: newRefreshToken };
};

const logoutSession = async (token) => {
  if (!token) return;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashedToken, revokedAt: null },
    data: { revokedAt: new Date() }
  });
};

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutSession
};

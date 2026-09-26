import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById } from '../store';

const JWT_SECRET = process.env.AUTH_SECRET || 'bookstore-jwt-secure-secret-key-2026-prod';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    _id?: string;
    name: string;
    email: string;
    role: 'USER' | 'ADMIN';
    status: 'ACTIVE' | 'DISABLED';
  };
}

/**
 * Middleware: Verify JWT and attach authenticated user
 * Reject with 401 Unauthorized if missing/invalid
 * Reject with 403 Forbidden if user account is DISABLED
 */
export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access this resource.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token format.',
      });
      return;
    }

    // Verify token signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: 'USER' | 'ADMIN';
    };

    // Lookup user in database
    const user = await findUserById(decoded.id);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User account associated with this session no longer exists.',
      });
      return;
    }

    // Check account status (Requirement 14 & 21)
    if (user.status === 'DISABLED') {
      res.status(403).json({
        success: false,
        message: 'Your account has been disabled by the administrator. Access denied.',
      });
      return;
    }

    req.user = {
      id: user.id || user._id.toString(),
      _id: user._id ? user._id.toString() : user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: 'Invalid or forged authentication token.',
    });
  }
}

/**
 * Middleware: Strictly require ADMIN role (Requirement 10 & 11)
 * Must be preceded by authenticateUser
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required prior to administrative authorization.',
    });
    return;
  }

  // Reject normal users with 403 Forbidden
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      message: 'Access forbidden: Administrator privileges required for this route.',
    });
    return;
  }

  next();
}

/**
 * Helper to generate JWT token for user session
 */
export function generateToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );
}

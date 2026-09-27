import { Router, Request, Response } from 'express';
import { 
  createUser, 
  findUserByEmail, 
  updateUserProfileName, 
  changeUserPassword, 
  getUserProfileStats 
} from '../store';
import { authenticateUser, generateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 * Requirement 2 & 3:
 * - Full Name, Email, Password, Confirm Password
 * - Strict validation
 * - Default role: USER (Never allow user to register as ADMIN)
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // 1. Check required fields
    if (!name || !email || !password || !confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Please provide all required fields: Name, Email, Password, and Confirm Password.',
      });
      return;
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
      return;
    }

    // 3. Validate password length
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    // 4. Validate password confirmation
    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Password and Confirm Password do not match.',
      });
      return;
    }

    // 5. Create user in MongoDB / store (enforcing role = 'USER')
    const newUser = await createUser({
      name,
      email,
      password,
    });

    // 6. Generate JWT token for immediate login
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully as Student / User.',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
    });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in instead.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error occurred during user registration.',
    });
  }
});

/**
 * POST /api/auth/login
 * Requirement 4 & 5:
 * - Email, Password
 * - Compares password hash
 * - Never returns password hash
 * - Redirect logic indicated by role
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials. No user found with this email.',
      });
      return;
    }

    // Check account status
    if (user.status === 'DISABLED') {
      res.status(403).json({
        success: false,
        message: 'This user account has been disabled by an administrator. Please contact support.',
      });
      return;
    }

    // Verify password securely using bcrypt
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.',
      });
      return;
    }

    const token = generateToken({
      id: user.id || user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id || user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login authentication.',
    });
  }
});

/**
 * GET /api/auth/me
 * Requirement 6: Verify current authenticated session
 */
router.get('/me', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Requirement 18: Terminate session
 */
router.post('/logout', (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'User logged out successfully.',
  });
});

export default router;

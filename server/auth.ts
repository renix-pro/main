/**
 * RENIX vNext — Server Auth Module
 * 
 * Canon v1.4 Compliant — Phase 12 Auth Addendum
 * 
 * User authentication with database storage.
 * When AUTH_ENABLED is true, this provides actual authentication.
 * 
 * Password hashing: bcrypt (cost 12) with transparent SHA-256 upgrade path.
 * Legacy SHA-256 hashes are detected on login and silently re-hashed to bcrypt.
 */

import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { storage } from './storage';

const BCRYPT_COST = 12;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Detect whether a stored hash is a bcrypt hash or a legacy SHA-256 hex string.
 * bcrypt hashes always start with $2a$ or $2b$.
 */
function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}

/**
 * Legacy SHA-256 hash (kept only for transparent upgrade path on login).
 */
function legacySHA256Hash(password: string, salt: string): string {
  return createHash('sha256')
    .update(password + salt)
    .digest('hex');
}

/**
 * Generate a random salt (kept for legacy compatibility — bcrypt generates its own salt internally).
 */
function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashPassword(password: string): { passwordHash: string; salt: string } {
  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);
  const salt = generateSalt();
  return { passwordHash, salt };
}

/**
 * Create a new user
 */
export async function createUser(email: string, password: string, name?: string): Promise<{ user: { id: string; email: string; name: string } | null; error?: string }> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { user: null, error: 'Invalid email format' };
  }

  const existingUser = await storage.getUserByEmail(email);
  if (existingUser) {
    return { user: null, error: 'Email already registered' };
  }

  if (password.length < 8) {
    return { user: null, error: 'Password must be at least 8 characters' };
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);
  const salt = generateSalt(); // retained for schema compatibility (not used by bcrypt)

  const displayName = name?.trim() || email.split('@')[0];

  const user = await storage.createUser({
    email: email.toLowerCase(),
    name: displayName,
    passwordHash,
    salt,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    }
  };
}

/**
 * Verify user credentials.
 * Transparently upgrades legacy SHA-256 hashes to bcrypt on successful login.
 */
export async function verifyCredentials(email: string, password: string): Promise<{ user: { id: string; email: string; name: string } | null; error?: string }> {
  const user = await storage.getUserByEmail(email);

  if (!user) {
    // Constant-time placeholder to prevent user enumeration via timing
    bcrypt.compareSync(password, '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    return { user: null, error: 'Invalid credentials' };
  }

  if (!user.passwordHash) {
    return { user: null, error: 'This account uses Google Sign-In. Please log in with Google.' };
  }

  let isValid = false;

  if (isBcryptHash(user.passwordHash)) {
    isValid = bcrypt.compareSync(password, user.passwordHash);
  } else {
    const legacyHash = legacySHA256Hash(password, user.salt || '');
    isValid = legacyHash === user.passwordHash;

    if (isValid) {
      // Transparently upgrade to bcrypt on successful login
      const newHash = bcrypt.hashSync(password, BCRYPT_COST);
      await storage.updateUser(user.id, { passwordHash: newHash });
    }
  }

  if (!isValid) {
    return { user: null, error: 'Invalid credentials' };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    }
  };
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<{ id: string; email: string; name: string } | null> {
  const user = await storage.getUser(id);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

/**
 * Update user display name
 */
export async function updateUserName(id: string, name: string): Promise<{ user: { id: string; email: string; name: string } | null; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    return { user: null, error: 'Name must be between 1 and 100 characters' };
  }

  const updated = await storage.updateUser(id, { name: trimmed });
  if (!updated) {
    return { user: null, error: 'User not found' };
  }

  return {
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
    }
  };
}

/**
 * Change user password.
 * Accepts either a bcrypt or legacy SHA-256 current password during the transition period.
 */
export async function changePassword(id: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const user = await storage.getUser(id);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (!user.passwordHash) {
    if (currentPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }
  } else {
    let isCurrentValid = false;
    if (isBcryptHash(user.passwordHash)) {
      isCurrentValid = bcrypt.compareSync(currentPassword, user.passwordHash);
    } else {
      const legacyHash = legacySHA256Hash(currentPassword, user.salt || '');
      isCurrentValid = legacyHash === user.passwordHash;
    }

    if (!isCurrentValid) {
      return { success: false, error: 'Current password is incorrect' };
    }
  }

  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters' };
  }

  const newHash = bcrypt.hashSync(newPassword, BCRYPT_COST);
  const newSalt = generateSalt(); // retained for schema compatibility

  await storage.updateUser(id, { passwordHash: newHash, salt: newSalt });
  return { success: true };
}

/**
 * Verify a Google ID token and return or create a user.
 */
export async function verifyGoogleToken(credential: string): Promise<{ user: { id: string; email: string; name: string } | null; error?: string }> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return { user: null, error: 'Invalid Google token' };
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];
    const googleId = payload.sub;

    const existingUser = await storage.getUserByEmail(email);

    if (existingUser) {
      if (!existingUser.googleId) {
        await storage.updateUser(existingUser.id, { googleId });
      }
      return {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        }
      };
    }

    const newUser = await storage.createUser({
      email,
      name,
      passwordHash: null,
      salt: null,
      googleId,
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      }
    };
  } catch (err: any) {
    console.error('Google token verification failed:', err.message);
    return { user: null, error: 'Google authentication failed' };
  }
}

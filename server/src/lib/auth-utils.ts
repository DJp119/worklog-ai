import bcrypt from 'bcrypt'
import crypto from 'crypto'

const SALT_ROUNDS = 12

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Compare a password with its hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

/**
 * Generate a random token (for email verification, password reset)
 */
export function generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

/**
 * Check if email format is valid
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Validate password strength
 * - At least 8 characters
 * - At least 1 letter
 * - At least 1 number
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters')
    }

    if (!/[a-zA-Z]/.test(password)) {
        errors.push('Password must contain at least one letter')
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number')
    }

    return {
        valid: errors.length === 0,
        errors,
    }
}

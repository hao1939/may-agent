# Session Token Manager — Specification

## Purpose
Manages session tokens for a web application. Tokens are used for authentication and carry user permissions.

## Token Format
- Tokens are opaque base64-encoded strings
- Each token maps to a session record: `{ userId, permissions, createdAt, expiresAt, lastAccessedAt }`
- Tokens expire after `SESSION_TIMEOUT_MS` (default: 30 minutes)

## Required Behaviors

### Token Creation (`createSession`)
- Generate a cryptographically random token (32 bytes, base64url-encoded)
- Store session data with creation timestamp and expiry
- Return the token string

### Token Validation (`validateSession`)
- Return the session if token exists and has not expired
- Update `lastAccessedAt` on successful validation (sliding window)
- Extend `expiresAt` by `SESSION_TIMEOUT_MS` from current time on each validation
- Return null for expired or unknown tokens
- **MUST** delete expired tokens from the store (cleanup on access)

### Permission Checking (`hasPermission`)
- Validate the session first (same rules as `validateSession`)
- Check if the session's `permissions` array includes the requested permission
- Permissions are case-sensitive strings
- Return `false` for expired/unknown tokens (do NOT throw)

### Token Revocation (`revokeSession`)
- Delete the token from the store
- Return `true` if the token existed, `false` otherwise

### Bulk Cleanup (`cleanupExpired`)
- Remove all expired sessions from the store
- Return the count of removed sessions

### Session Listing (`getActiveSessions`)
- Return all non-expired sessions for a given userId
- Do NOT return expired sessions even if still in store

## Security Requirements
- Token generation MUST use `crypto.randomBytes`, not `Math.random`
- Expired tokens MUST NOT be treated as valid under any circumstances
- Permission checks MUST validate session expiry before checking permissions

import jwt from 'jsonwebtoken'
import type { JwtPayload, AuthTokens } from '@secureops/types'
import { UserRole } from '@secureops/types'

export interface TokenConfig {
  jwtSecret: string
  jwtRefreshSecret: string
  accessExpiresIn?: string
  refreshExpiresIn?: string
}

export function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  config: TokenConfig,
): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: (config.accessExpiresIn ?? '15m') as jwt.SignOptions['expiresIn'],
  })
}

export function signRefreshToken(
  userId: string,
  tenantId: string,
  config: TokenConfig,
): string {
  return jwt.sign({ sub: userId, tenantId }, config.jwtRefreshSecret, {
    expiresIn: (config.refreshExpiresIn ?? '7d') as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload
}

export function verifyRefreshToken(
  token: string,
  secret: string,
): { sub: string; tenantId: string } {
  return jwt.verify(token, secret) as { sub: string; tenantId: string }
}

export function createTokenPair(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  config: TokenConfig,
): AuthTokens {
  const accessToken = signAccessToken(payload, config)
  const refreshToken = signRefreshToken(payload.sub, payload.tenantId, config)

  const decoded = jwt.decode(accessToken) as { exp: number }
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)

  return { accessToken, refreshToken, expiresIn }
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN
}

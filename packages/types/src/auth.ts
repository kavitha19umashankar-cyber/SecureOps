import { UserRole } from './enums.js'

export interface JwtPayload {
  sub: string        // user id
  tenantId: string
  role: UserRole
  employeeId?: string
  clientId?: string
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginRequest {
  email?: string
  phone?: string
  password?: string
  otp?: string
}

export interface LoginResponse {
  tokens: AuthTokens
  user: {
    id: string
    name: string
    email?: string
    phone?: string
    role: UserRole
    tenantId: string
    tenantName?: string
    avatar?: string
  }
}

export interface OtpRequest {
  phone: string
  tenantCode?: string
}

export interface OtpVerifyRequest {
  phone: string
  otp: string
}

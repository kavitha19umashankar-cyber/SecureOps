import type { Db } from '@secureops/db'
import { auditLogs } from '@secureops/db'

interface AuditEntry {
  tenantId?: string
  userId?: string
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'VIEW'
  tableName: string
  recordId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function writeAuditLog(db: Db, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: entry.tenantId,
    userId: entry.userId,
    action: entry.action,
    tableName: entry.tableName,
    recordId: entry.recordId,
    oldValues: entry.oldValues,
    newValues: entry.newValues,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
  })
}

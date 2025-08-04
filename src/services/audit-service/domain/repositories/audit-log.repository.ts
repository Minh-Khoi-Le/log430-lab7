import { AuditLog } from '../entities/audit-log';
import { AuditLogQueryParams } from '../value-objects/audit-query-params';

export interface AuditLogRepository {
  save(auditLog: AuditLog): Promise<void>;
  findByAuditId(auditId: string): Promise<AuditLog | null>;
  findByQueryParams(params: AuditLogQueryParams): Promise<{
    auditLogs: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }>;
  findByCorrelationId(correlationId: string): Promise<AuditLog[]>;
}

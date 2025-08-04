import { AuditLog, AuditTrail } from './audit.models';

export interface AuditLogFilter {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  serviceName?: string;
  correlationId?: string;
  fromDate?: Date;
  toDate?: Date;
  ipAddress?: string;
}

export interface AuditTrailFilter {
  entityType?: string;
  entityId?: string;
  processName?: string;
  correlationId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IAuditLogRepository {
  create(auditLog: AuditLog): Promise<void>;
  findById(auditId: string): Promise<AuditLog | null>;
  findByCorrelationId(correlationId: string): Promise<AuditLog[]>;
  search(filter: AuditLogFilter, pagination: PaginationOptions): Promise<PaginatedResult<AuditLog>>;
  findByEntityId(entityType: string, entityId: string): Promise<AuditLog[]>;
  findByUserId(userId: string, pagination: PaginationOptions): Promise<PaginatedResult<AuditLog>>;
  findByService(serviceName: string, pagination: PaginationOptions): Promise<PaginatedResult<AuditLog>>;
  countByEventType(eventType: string, fromDate?: Date, toDate?: Date): Promise<number>;
  getAuditStatistics(fromDate?: Date, toDate?: Date): Promise<AuditStatistics>;
}

export interface IAuditTrailRepository {
  create(auditTrail: AuditTrail): Promise<void>;
  update(auditTrail: AuditTrail): Promise<void>;
  findById(trailId: string): Promise<AuditTrail | null>;
  findByCorrelationId(correlationId: string): Promise<AuditTrail | null>;
  search(filter: AuditTrailFilter, pagination: PaginationOptions): Promise<PaginatedResult<AuditTrail>>;
  findByEntityId(entityType: string, entityId: string): Promise<AuditTrail[]>;
  findActiveTrails(): Promise<AuditTrail[]>;
  findByProcessName(processName: string, pagination: PaginationOptions): Promise<PaginatedResult<AuditTrail>>;
}

export interface AuditStatistics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByService: Record<string, number>;
  eventsByAction: Record<string, number>;
  uniqueUsers: number;
  activeTrails: number;
  completedTrails: number;
  failedTrails: number;
}

/**
 * Domain models for the Audit Service
 * 
 * This module defines the core domain entities for audit logging and trail management.
 * It provides value objects and entities that represent audit events and processes.
 */

export interface AuditLogData {
  auditId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  action: string;
  userId?: string;
  serviceName: string;
  correlationId: string;
  causationId?: string;
  metadata: Record<string, any>;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuditTrailData {
  trailId: string;
  entityType: string;
  entityId: string;
  processName: string;
  correlationId: string;
  startTime: Date;
  endTime?: Date;
  status: AuditTrailStatus;
  totalEvents: number;
  metadata: Record<string, any>;
}

export enum AuditTrailStatus {
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  READ = 'READ',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  AUTHENTICATE = 'AUTHENTICATE',
  AUTHORIZE = 'AUTHORIZE',
  PUBLISH_EVENT = 'PUBLISH_EVENT',
  CONSUME_EVENT = 'CONSUME_EVENT',
  PROCESS_COMMAND = 'PROCESS_COMMAND',
  EXECUTE_QUERY = 'EXECUTE_QUERY',
  SAGA_START = 'SAGA_START',
  SAGA_STEP = 'SAGA_STEP',
  SAGA_COMPLETE = 'SAGA_COMPLETE',
  SAGA_COMPENSATE = 'SAGA_COMPENSATE'
}

export enum AuditEventType {
  BUSINESS_EVENT = 'BUSINESS_EVENT',
  SECURITY_EVENT = 'SECURITY_EVENT',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
  INTEGRATION_EVENT = 'INTEGRATION_EVENT',
  ERROR_EVENT = 'ERROR_EVENT',
  PERFORMANCE_EVENT = 'PERFORMANCE_EVENT'
}

export class AuditLog {
  constructor(
    public readonly auditId: string,
    public readonly eventType: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly action: string,
    public readonly serviceName: string,
    public readonly correlationId: string,
    public readonly metadata: Record<string, any>,
    public readonly details: Record<string, any>,
    public readonly timestamp: Date,
    public readonly userId?: string,
    public readonly causationId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string
  ) {}

  static create(data: AuditLogData): AuditLog {
    return new AuditLog(
      data.auditId,
      data.eventType,
      data.entityType,
      data.entityId,
      data.action,
      data.serviceName,
      data.correlationId,
      data.metadata,
      data.details,
      data.timestamp,
      data.userId,
      data.causationId,
      data.ipAddress,
      data.userAgent
    );
  }

  toData(): AuditLogData {
    return {
      auditId: this.auditId,
      eventType: this.eventType,
      entityType: this.entityType,
      entityId: this.entityId,
      action: this.action,
      userId: this.userId,
      serviceName: this.serviceName,
      correlationId: this.correlationId,
      causationId: this.causationId,
      metadata: this.metadata,
      details: this.details,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      timestamp: this.timestamp
    };
  }
}

export class AuditTrail {
  constructor(
    public readonly trailId: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly processName: string,
    public readonly correlationId: string,
    public readonly startTime: Date,
    public readonly status: AuditTrailStatus,
    public readonly totalEvents: number,
    public readonly metadata: Record<string, any>,
    public readonly endTime?: Date
  ) {}

  static create(data: AuditTrailData): AuditTrail {
    return new AuditTrail(
      data.trailId,
      data.entityType,
      data.entityId,
      data.processName,
      data.correlationId,
      data.startTime,
      data.status,
      data.totalEvents,
      data.metadata,
      data.endTime
    );
  }

  updateStatus(status: AuditTrailStatus, endTime?: Date): AuditTrail {
    return new AuditTrail(
      this.trailId,
      this.entityType,
      this.entityId,
      this.processName,
      this.correlationId,
      this.startTime,
      status,
      this.totalEvents,
      this.metadata,
      endTime || this.endTime
    );
  }

  incrementEventCount(): AuditTrail {
    return new AuditTrail(
      this.trailId,
      this.entityType,
      this.entityId,
      this.processName,
      this.correlationId,
      this.startTime,
      this.status,
      this.totalEvents + 1,
      this.metadata,
      this.endTime
    );
  }

  toData(): AuditTrailData {
    return {
      trailId: this.trailId,
      entityType: this.entityType,
      entityId: this.entityId,
      processName: this.processName,
      correlationId: this.correlationId,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status,
      totalEvents: this.totalEvents,
      metadata: this.metadata
    };
  }
}

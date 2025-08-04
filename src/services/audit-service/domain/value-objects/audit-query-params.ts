export interface AuditLogQueryParams {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  serviceName?: string;
  correlationId?: string;
  fromDate?: Date;
  toDate?: Date;
  page: number;
  limit: number;
}

export class AuditQueryParams {
  public readonly eventType?: string;
  public readonly entityType?: string;
  public readonly entityId?: string;
  public readonly userId?: string;
  public readonly action?: string;
  public readonly serviceName?: string;
  public readonly correlationId?: string;
  public readonly fromDate?: Date;
  public readonly toDate?: Date;
  public readonly page: number;
  public readonly limit: number;

  constructor(params: AuditLogQueryParams) {
    this.eventType = params.eventType;
    this.entityType = params.entityType;
    this.entityId = params.entityId;
    this.userId = params.userId;
    this.action = params.action;
    this.serviceName = params.serviceName;
    this.correlationId = params.correlationId;
    this.fromDate = params.fromDate;
    this.toDate = params.toDate;
    this.page = Math.max(1, params.page || 1);
    this.limit = Math.min(100, Math.max(1, params.limit || 10));
  }

  public static fromRequest(query: any): AuditQueryParams {
    return new AuditQueryParams({
      eventType: query.eventType,
      entityType: query.entityType,
      entityId: query.entityId,
      userId: query.userId,
      action: query.action,
      serviceName: query.serviceName,
      correlationId: query.correlationId,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10
    });
  }
}

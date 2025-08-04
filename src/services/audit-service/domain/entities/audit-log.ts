export interface AuditLogProps {
  auditId: string;
  eventType: string;
  entityId: string;
  entityType: string;
  userId?: string;
  action: string;
  serviceName: string;
  correlationId: string;
  causationId?: string;
  metadata: any;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}

export class AuditLog {
  public readonly auditId: string;
  public readonly eventType: string;
  public readonly entityId: string;
  public readonly entityType: string;
  public readonly userId?: string;
  public readonly action: string;
  public readonly serviceName: string;
  public readonly correlationId: string;
  public readonly causationId?: string;
  public readonly metadata: any;
  public readonly details: any;
  public readonly ipAddress?: string;
  public readonly userAgent?: string;
  public readonly timestamp: Date;

  constructor(props: AuditLogProps) {
    this.auditId = props.auditId;
    this.eventType = props.eventType;
    this.entityId = props.entityId;
    this.entityType = props.entityType;
    this.userId = props.userId;
    this.action = props.action;
    this.serviceName = props.serviceName;
    this.correlationId = props.correlationId;
    this.causationId = props.causationId;
    this.metadata = props.metadata;
    this.details = props.details;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.timestamp = props.timestamp || new Date();
  }

  public static create(props: Omit<AuditLogProps, 'auditId' | 'timestamp'> & { auditId?: string; timestamp?: Date }): AuditLog {
    const auditId = props.auditId || crypto.randomUUID();
    const timestamp = props.timestamp || new Date();
    
    return new AuditLog({
      ...props,
      auditId,
      timestamp
    });
  }

  public toJSON(): AuditLogProps {
    return {
      auditId: this.auditId,
      eventType: this.eventType,
      entityId: this.entityId,
      entityType: this.entityType,
      userId: this.userId,
      action: this.action,
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

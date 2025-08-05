// Base Domain Event interface
export interface DomainEvent {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: any;
  metadata: EventMetadata;
}

export interface EventMetadata {
  occurredOn: Date;
  version: number;
  correlationId: string;
  causationId?: string;
  userId?: string;
  sagaId?: string;
  source: string;
}

// Stock-related events for real-time inventory updates
export interface StockUpdatedEvent extends DomainEvent {
  aggregateType: 'Product';
  eventType: 'STOCK_UPDATED';
  eventData: {
    storeId: number;
    productId: number;
    oldQuantity: number;
    newQuantity: number;
    reason: 'SALE' | 'REFUND' | 'ADJUSTMENT';
  };
}

export interface StockReservedEvent extends DomainEvent {
  aggregateType: 'Product';
  eventType: 'STOCK_RESERVED';
  eventData: {
    storeId: number;
    productId: number;
    quantity: number;
    saleId: number;
  };
}

export interface StockReleasedEvent extends DomainEvent {
  aggregateType: 'Product';
  eventType: 'STOCK_RELEASED';
  eventData: {
    storeId: number;
    productId: number;
    quantity: number;
    reason: 'SALE_CANCELLED' | 'REFUND_PROCESSED';
  };
}

// Sale-related events
export interface SaleCreatedEvent extends DomainEvent {
  aggregateType: 'Sale';
  eventType: 'SALE_CREATED';
  eventData: {
    saleId: number;
    userId: number;
    storeId: number;
    total: number;
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
    }>;
  };
}

export interface SaleCompletedEvent extends DomainEvent {
  aggregateType: 'Sale';
  eventType: 'SALE_COMPLETED';
  eventData: {
    saleId: number;
    userId: number;
    storeId: number;
    total: number;
  };
}

// Refund-related events
export interface RefundCreatedEvent extends DomainEvent {
  aggregateType: 'Refund';
  eventType: 'REFUND_CREATED';
  eventData: {
    refundId: number;
    saleId: number;
    userId: number;
    storeId: number;
    total: number;
    reason?: string;
  };
}

export interface RefundCompletedEvent extends DomainEvent {
  aggregateType: 'Refund';
  eventType: 'REFUND_COMPLETED';
  eventData: {
    refundId: number;
    saleId: number;
    userId: number;
    storeId: number;
    total: number;
  };
}

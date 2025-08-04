import { ComplaintStatus, ComplaintPriority } from '../../../domain/entities/complaint.entity';

// Read model for complaint queries (CQRS query side)
export interface ComplaintView {
  id: string;
  userId: string;
  title: string;
  description: string;
  priority: ComplaintPriority;
  category: string;
  status: ComplaintStatus;
  assignedTo?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  version: number;
}

// Extended view with timeline for detailed queries
export interface ComplaintDetailView extends ComplaintView {
  timeline: ComplaintTimelineEntry[];
}

export interface ComplaintTimelineEntry {
  id: string;
  complaintId: string;
  timestamp: Date;
  action: string;
  actor: string;
  details: string;
  eventType: string;
  eventData: any;
}

// Aggregated view for dashboard/statistics
export interface ComplaintSummaryView {
  totalComplaints: number;
  openComplaints: number;
  assignedComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  closedComplaints: number;
  averageResolutionTime: number; // in hours
  complaintsByPriority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  complaintsByCategory: Record<string, number>;
}

// Search criteria for queries
export interface ComplaintSearchCriteria {
  userId?: string;
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
  category?: string;
  assignedTo?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  searchText?: string; // For full-text search in title/description
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ComplaintQueryResult {
  complaints: ComplaintView[];
  total: number;
  limit: number;
  offset: number;
}
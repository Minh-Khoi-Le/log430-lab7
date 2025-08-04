import {
  ComplaintView,
  ComplaintDetailView,
  ComplaintSummaryView,
  ComplaintSearchCriteria,
  ComplaintQueryResult,
  ComplaintTimelineEntry
} from '../models/complaint-view.model';

// Repository interface for complaint read models (CQRS query side)
export interface ComplaintViewRepository {
  // Basic queries
  findById(id: string): Promise<ComplaintView | null>;
  findDetailById(id: string): Promise<ComplaintDetailView | null>;
  findByUserId(userId: string): Promise<ComplaintView[]>;
  findByCriteria(criteria: ComplaintSearchCriteria): Promise<ComplaintQueryResult>;
  
  // Timeline queries
  getComplaintTimeline(complaintId: string): Promise<ComplaintTimelineEntry[]>;
  addTimelineEntry(entry: ComplaintTimelineEntry): Promise<void>;
  
  // Summary and analytics
  getSummary(userId?: string): Promise<ComplaintSummaryView>;
  getComplaintsByStatus(status?: string): Promise<ComplaintView[]>;
  getComplaintsByPriority(priority?: string): Promise<ComplaintView[]>;
  getComplaintsByCategory(category?: string): Promise<ComplaintView[]>;
  
  // Projection management
  upsertComplaintView(view: ComplaintView): Promise<void>;
  deleteComplaintView(id: string): Promise<void>;
  
  // Full-text search
  searchComplaints(searchText: string, limit?: number): Promise<ComplaintView[]>;
  
  // Statistics
  getResolutionTimeStats(): Promise<{ average: number; median: number; min: number; max: number }>;
  getComplaintTrends(days: number): Promise<Array<{ date: Date; count: number; status: string }>>;
}
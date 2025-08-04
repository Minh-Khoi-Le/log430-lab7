import { Complaint, ComplaintStatus, ComplaintPriority } from '../entities/complaint.entity';

export interface ComplaintSearchCriteria {
  userId?: string;
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
  category?: string;
  assignedTo?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface ComplaintRepository {
  // Command side operations
  save(complaint: Complaint): Promise<void>;
  findById(id: string): Promise<Complaint | null>;
  findByUserId(userId: string): Promise<Complaint[]>;
  findByCriteria(criteria: ComplaintSearchCriteria): Promise<Complaint[]>;
  delete(id: string): Promise<void>;
  
  // Aggregate management
  getNextVersion(id: string): Promise<number>;
  exists(id: string): Promise<boolean>;
}
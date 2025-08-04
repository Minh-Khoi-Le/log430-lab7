import { ComplaintStatus, ComplaintPriority } from '../../domain/entities/complaint.entity';

// Command DTOs
export interface CreateComplaintDto {
  userId: string;
  title: string;
  description: string;
  priority: ComplaintPriority;
  category: string;
}

export interface AssignComplaintDto {
  complaintId: string;
  assignedTo: string;
  assignedBy: string;
}

export interface StartProcessingDto {
  complaintId: string;
  processedBy: string;
}

export interface ResolveComplaintDto {
  complaintId: string;
  resolution: string;
  resolvedBy: string;
}

export interface CloseComplaintDto {
  complaintId: string;
  closedBy: string;
  closureReason: string;
  customerSatisfaction?: number;
}

export interface UpdatePriorityDto {
  complaintId: string;
  newPriority: ComplaintPriority;
  updatedBy: string;
}

// Query DTOs
export interface ComplaintQueryDto {
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

// Response DTOs
export interface ComplaintResponseDto {
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

export interface ComplaintListResponseDto {
  complaints: ComplaintResponseDto[];
  total: number;
  limit: number;
  offset: number;
}

// Timeline entry for complaint history
export interface ComplaintTimelineEntryDto {
  timestamp: Date;
  action: string;
  actor: string;
  details: string;
  eventType: string;
}

export interface ComplaintDetailResponseDto extends ComplaintResponseDto {
  timeline: ComplaintTimelineEntryDto[];
}
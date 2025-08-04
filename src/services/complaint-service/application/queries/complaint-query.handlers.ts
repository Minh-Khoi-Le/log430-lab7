import { ComplaintViewRepository } from './repositories/complaint-view.repository';
import { createLogger } from '@shared/infrastructure/logging';
import {
  ComplaintView,
  ComplaintDetailView,
  ComplaintSummaryView,
  ComplaintSearchCriteria,
  ComplaintQueryResult
} from './models/complaint-view.model';
import {
  ComplaintQueryDto,
  ComplaintResponseDto,
  ComplaintListResponseDto,
  ComplaintDetailResponseDto
} from '../dtos/complaint.dto';

const logger = createLogger('complaint-query-handlers');

export class ComplaintQueryHandlers {
  constructor(
    private readonly complaintViewRepository: ComplaintViewRepository
  ) {}

  async getComplaintById(id: string): Promise<ComplaintResponseDto | null> {
    try {
      logger.info('Querying complaint by ID', { complaintId: id });

      const complaintView = await this.complaintViewRepository.findById(id);
      
      if (!complaintView) {
        logger.info('Complaint not found', { complaintId: id });
        return null;
      }

      return this.mapToResponseDto(complaintView);
    } catch (error) {
      logger.error('Failed to query complaint by ID', error as Error, { complaintId: id });
      throw error;
    }
  }

  async getComplaintDetailById(id: string): Promise<ComplaintDetailResponseDto | null> {
    try {
      logger.info('Querying complaint detail by ID', { complaintId: id });

      const complaintDetail = await this.complaintViewRepository.findDetailById(id);
      
      if (!complaintDetail) {
        logger.info('Complaint detail not found', { complaintId: id });
        return null;
      }

      return {
        ...this.mapToResponseDto(complaintDetail),
        timeline: complaintDetail.timeline.map(entry => ({
          timestamp: entry.timestamp,
          action: entry.action,
          actor: entry.actor,
          details: entry.details,
          eventType: entry.eventType
        }))
      };
    } catch (error) {
      logger.error('Failed to query complaint detail by ID', error as Error, { complaintId: id });
      throw error;
    }
  }

  async getComplaintsByUserId(userId: string): Promise<ComplaintResponseDto[]> {
    try {
      logger.info('Querying complaints by user ID', { userId });

      const complaints = await this.complaintViewRepository.findByUserId(userId);
      
      return complaints.map(complaint => this.mapToResponseDto(complaint));
    } catch (error) {
      logger.error('Failed to query complaints by user ID', error as Error, { userId });
      throw error;
    }
  }

  async searchComplaints(query: ComplaintQueryDto): Promise<ComplaintListResponseDto> {
    try {
      logger.info('Searching complaints', { query });

      const criteria: ComplaintSearchCriteria = {
        userId: query.userId,
        status: query.status,
        priority: query.priority,
        category: query.category,
        assignedTo: query.assignedTo,
        createdAfter: query.createdAfter,
        createdBefore: query.createdBefore,
        limit: query.limit || 20,
        offset: query.offset || 0
      };

      const result = await this.complaintViewRepository.findByCriteria(criteria);
      
      return {
        complaints: result.complaints.map(complaint => this.mapToResponseDto(complaint)),
        total: result.total,
        limit: result.limit,
        offset: result.offset
      };
    } catch (error) {
      logger.error('Failed to search complaints', error as Error, { query });
      throw error;
    }
  }

  async getComplaintsByStatus(status?: string): Promise<ComplaintResponseDto[]> {
    try {
      logger.info('Querying complaints by status', { status });

      const complaints = await this.complaintViewRepository.getComplaintsByStatus(status);
      
      return complaints.map(complaint => this.mapToResponseDto(complaint));
    } catch (error) {
      logger.error('Failed to query complaints by status', error as Error, { status });
      throw error;
    }
  }

  async getComplaintsByPriority(priority?: string): Promise<ComplaintResponseDto[]> {
    try {
      logger.info('Querying complaints by priority', { priority });

      const complaints = await this.complaintViewRepository.getComplaintsByPriority(priority);
      
      return complaints.map(complaint => this.mapToResponseDto(complaint));
    } catch (error) {
      logger.error('Failed to query complaints by priority', error as Error, { priority });
      throw error;
    }
  }

  async getComplaintsByCategory(category?: string): Promise<ComplaintResponseDto[]> {
    try {
      logger.info('Querying complaints by category', { category });

      const complaints = await this.complaintViewRepository.getComplaintsByCategory(category);
      
      return complaints.map(complaint => this.mapToResponseDto(complaint));
    } catch (error) {
      logger.error('Failed to query complaints by category', error as Error, { category });
      throw error;
    }
  }

  async getComplaintSummary(userId?: string): Promise<ComplaintSummaryView> {
    try {
      logger.info('Querying complaint summary', { userId });

      const summary = await this.complaintViewRepository.getSummary(userId);
      
      return summary;
    } catch (error) {
      logger.error('Failed to query complaint summary', error as Error, { userId });
      throw error;
    }
  }

  async searchComplaintsByText(searchText: string, limit?: number): Promise<ComplaintResponseDto[]> {
    try {
      logger.info('Searching complaints by text', { searchText, limit });

      const complaints = await this.complaintViewRepository.searchComplaints(searchText, limit);
      
      return complaints.map(complaint => this.mapToResponseDto(complaint));
    } catch (error) {
      logger.error('Failed to search complaints by text', error as Error, { searchText });
      throw error;
    }
  }

  async getResolutionTimeStats(): Promise<{ average: number; median: number; min: number; max: number }> {
    try {
      logger.info('Querying resolution time statistics');

      const stats = await this.complaintViewRepository.getResolutionTimeStats();
      
      return stats;
    } catch (error) {
      logger.error('Failed to query resolution time statistics', error as Error);
      throw error;
    }
  }

  async getComplaintTrends(days: number): Promise<Array<{ date: Date; count: number; status: string }>> {
    try {
      logger.info('Querying complaint trends', { days });

      const trends = await this.complaintViewRepository.getComplaintTrends(days);
      
      return trends;
    } catch (error) {
      logger.error('Failed to query complaint trends', error as Error, { days });
      throw error;
    }
  }

  private mapToResponseDto(complaint: ComplaintView): ComplaintResponseDto {
    return {
      id: complaint.id,
      userId: complaint.userId,
      title: complaint.title,
      description: complaint.description,
      priority: complaint.priority,
      category: complaint.category,
      status: complaint.status,
      assignedTo: complaint.assignedTo,
      resolution: complaint.resolution,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      closedAt: complaint.closedAt,
      version: complaint.version
    };
  }
}
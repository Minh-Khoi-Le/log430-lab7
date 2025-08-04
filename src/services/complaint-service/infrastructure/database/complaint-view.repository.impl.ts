import { ComplaintViewRepository } from '../../application/queries/repositories/complaint-view.repository';
import {
  ComplaintView,
  ComplaintDetailView,
  ComplaintSummaryView,
  ComplaintSearchCriteria,
  ComplaintQueryResult,
  ComplaintTimelineEntry
} from '../../application/queries/models/complaint-view.model';
import { DatabaseManager } from '@shared/infrastructure/database';
import { createLogger } from '@shared/infrastructure/logging';

const logger = createLogger('complaint-view-repository');

export class ComplaintViewRepositoryImpl implements ComplaintViewRepository {
  constructor(private readonly databaseManager: DatabaseManager) {}

  async findById(id: string): Promise<ComplaintView | null> {
    try {
      const query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaint_views
        WHERE id = $1
      `;

      const result = await this.databaseManager.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToComplaintView(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find complaint view by ID', error as Error, { complaintId: id });
      throw error;
    }
  }

  async findDetailById(id: string): Promise<ComplaintDetailView | null> {
    try {
      const complaintView = await this.findById(id);
      if (!complaintView) {
        return null;
      }

      const timeline = await this.getComplaintTimeline(id);

      return {
        ...complaintView,
        timeline
      };
    } catch (error) {
      logger.error('Failed to find complaint detail by ID', error as Error, { complaintId: id });
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<ComplaintView[]> {
    try {
      const query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaint_views
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.databaseManager.query(query, [userId]);

      return result.rows.map(row => this.mapRowToComplaintView(row));
    } catch (error) {
      logger.error('Failed to find complaint views by user ID', error as Error, { userId });
      throw error;
    }
  }

  async findByCriteria(criteria: ComplaintSearchCriteria): Promise<ComplaintQueryResult> {
    try {
      let countQuery = `SELECT COUNT(*) FROM complaint_views WHERE 1=1`;
      let dataQuery = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaint_views
        WHERE 1=1
      `;

      const values: any[] = [];
      let paramIndex = 1;

      // Build WHERE conditions
      const conditions = this.buildWhereConditions(criteria, values, paramIndex);
      countQuery += conditions.whereClause;
      dataQuery += conditions.whereClause;
      paramIndex = conditions.nextParamIndex;

      // Add search text if provided
      if (criteria.searchText) {
        const searchCondition = ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        countQuery += searchCondition;
        dataQuery += searchCondition;
        values.push(`%${criteria.searchText}%`);
        paramIndex++;
      }

      // Add sorting
      const sortBy = criteria.sortBy || 'createdAt';
      const sortOrder = criteria.sortOrder || 'DESC';
      dataQuery += ` ORDER BY ${this.mapSortField(sortBy)} ${sortOrder}`;

      // Add pagination
      const limit = criteria.limit || 20;
      const offset = criteria.offset || 0;
      dataQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limit, offset);

      // Execute queries
      const [countResult, dataResult] = await Promise.all([
        this.databaseManager.query(countQuery, values.slice(0, paramIndex - 1)),
        this.databaseManager.query(dataQuery, values)
      ]);

      const total = parseInt(countResult.rows[0].count);
      const complaints = dataResult.rows.map(row => this.mapRowToComplaintView(row));

      return {
        complaints,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Failed to find complaint views by criteria', error as Error, { criteria });
      throw error;
    }
  }

  async getComplaintTimeline(complaintId: string): Promise<ComplaintTimelineEntry[]> {
    try {
      const query = `
        SELECT id, complaint_id, timestamp, action, actor, details, event_type, event_data
        FROM complaint_timeline
        WHERE complaint_id = $1
        ORDER BY timestamp ASC
      `;

      const result = await this.databaseManager.query(query, [complaintId]);

      return result.rows.map(row => ({
        id: row.id,
        complaintId: row.complaint_id,
        timestamp: row.timestamp,
        action: row.action,
        actor: row.actor,
        details: row.details,
        eventType: row.event_type,
        eventData: row.event_data
      }));
    } catch (error) {
      logger.error('Failed to get complaint timeline', error as Error, { complaintId });
      throw error;
    }
  }

  async addTimelineEntry(entry: ComplaintTimelineEntry): Promise<void> {
    try {
      const query = `
        INSERT INTO complaint_timeline (
          id, complaint_id, timestamp, action, actor, details, event_type, event_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      const values = [
        entry.id,
        entry.complaintId,
        entry.timestamp,
        entry.action,
        entry.actor,
        entry.details,
        entry.eventType,
        JSON.stringify(entry.eventData)
      ];

      await this.databaseManager.query(query, values);

      logger.debug('Timeline entry added successfully', {
        complaintId: entry.complaintId,
        action: entry.action
      });
    } catch (error) {
      logger.error('Failed to add timeline entry', error as Error, {
        complaintId: entry.complaintId,
        action: entry.action
      });
      throw error;
    }
  }

  async getSummary(userId?: string): Promise<ComplaintSummaryView> {
    try {
      let whereClause = '';
      const values: any[] = [];

      if (userId) {
        whereClause = 'WHERE user_id = $1';
        values.push(userId);
      }

      const queries = [
        `SELECT COUNT(*) as total FROM complaint_views ${whereClause}`,
        `SELECT status, COUNT(*) as count FROM complaint_views ${whereClause} GROUP BY status`,
        `SELECT priority, COUNT(*) as count FROM complaint_views ${whereClause} GROUP BY priority`,
        `SELECT category, COUNT(*) as count FROM complaint_views ${whereClause} GROUP BY category`,
        `SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/3600) as avg_hours 
         FROM complaint_views 
         ${whereClause} ${whereClause ? 'AND' : 'WHERE'} closed_at IS NOT NULL`
      ];

      const results = await Promise.all(
        queries.map(query => this.databaseManager.query(query, values))
      );

      const totalComplaints = parseInt(results[0].rows[0].total);
      
      const statusCounts = results[1].rows.reduce((acc: any, row: any) => {
        acc[row.status.toLowerCase() + 'Complaints'] = parseInt(row.count);
        return acc;
      }, {
        openComplaints: 0,
        assignedComplaints: 0,
        inProgressComplaints: 0,
        resolvedComplaints: 0,
        closedComplaints: 0
      });

      const priorityCounts = results[2].rows.reduce((acc: any, row: any) => {
        acc[row.priority.toLowerCase()] = parseInt(row.count);
        return acc;
      }, { low: 0, medium: 0, high: 0, critical: 0 });

      const categoryCounts = results[3].rows.reduce((acc: any, row: any) => {
        acc[row.category] = parseInt(row.count);
        return acc;
      }, {});

      const averageResolutionTime = results[4].rows[0].avg_hours 
        ? parseFloat(results[4].rows[0].avg_hours) 
        : 0;

      return {
        totalComplaints,
        ...statusCounts,
        averageResolutionTime,
        complaintsByPriority: priorityCounts,
        complaintsByCategory: categoryCounts
      };
    } catch (error) {
      logger.error('Failed to get complaint summary', error as Error, { userId });
      throw error;
    }
  }

  async getComplaintsByStatus(status?: string): Promise<ComplaintView[]> {
    try {
      let query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaint_views
      `;
      
      const values: any[] = [];
      
      if (status) {
        query += ' WHERE status = $1';
        values.push(status);
      }
      
      query += ' ORDER BY created_at DESC';

      const result = await this.databaseManager.query(query, values);

      return result.rows.map(row => this.mapRowToComplaintView(row));
    } catch (error) {
      logger.error('Failed to get complaints by status', error as Error, { status });
      throw error;
    }
  }

  async getComplaintsByPriority(priority?: string): Promise<ComplaintView[]> {
    try {
      let query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaint_views
      `;
      
      const values: any[] = [];
      
      if (priority) {
        query += ' WHERE priority = $1';
        values.push(priority);
      }
      
      query += ' ORDER BY created_at DESC';

      const result = await this.databaseManager.query(query, values);

      return result.rows.map(row => this.mapRowToComplaintView(row));
    } catch (error) {
      logger.error('Failed to get complaints by priority', error as Error, { priority });
      throw error;
    }
  }

  async getComplaintsByCategory(category?: string): Promise<ComplaintView[]> {
    try {
      let query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaint_views
      `;
      
      const values: any[] = [];
      
      if (category) {
        query += ' WHERE category = $1';
        values.push(category);
      }
      
      query += ' ORDER BY created_at DESC';

      const result = await this.databaseManager.query(query, values);

      return result.rows.map(row => this.mapRowToComplaintView(row));
    } catch (error) {
      logger.error('Failed to get complaints by category', error as Error, { category });
      throw error;
    }
  }

  async upsertComplaintView(view: ComplaintView): Promise<void> {
    try {
      const query = `
        INSERT INTO complaint_views (
          id, user_id, title, description, priority, category, status,
          assigned_to, resolution, created_at, updated_at, closed_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          priority = EXCLUDED.priority,
          category = EXCLUDED.category,
          status = EXCLUDED.status,
          assigned_to = EXCLUDED.assigned_to,
          resolution = EXCLUDED.resolution,
          updated_at = EXCLUDED.updated_at,
          closed_at = EXCLUDED.closed_at,
          version = EXCLUDED.version
      `;

      const values = [
        view.id,
        view.userId,
        view.title,
        view.description,
        view.priority,
        view.category,
        view.status,
        view.assignedTo || null,
        view.resolution || null,
        view.createdAt,
        view.updatedAt,
        view.closedAt || null,
        view.version
      ];

      await this.databaseManager.query(query, values);

      logger.debug('Complaint view upserted successfully', {
        complaintId: view.id,
        version: view.version
      });
    } catch (error) {
      logger.error('Failed to upsert complaint view', error as Error, {
        complaintId: view.id
      });
      throw error;
    }
  }

  async deleteComplaintView(id: string): Promise<void> {
    try {
      const query = `DELETE FROM complaint_views WHERE id = $1`;
      await this.databaseManager.query(query, [id]);

      logger.debug('Complaint view deleted successfully', { complaintId: id });
    } catch (error) {
      logger.error('Failed to delete complaint view', error as Error, { complaintId: id });
      throw error;
    }
  }

  async searchComplaints(searchText: string, limit?: number): Promise<ComplaintView[]> {
    try {
      const query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaint_views
        WHERE title ILIKE $1 OR description ILIKE $1
        ORDER BY created_at DESC
        ${limit ? `LIMIT ${limit}` : ''}
      `;

      const result = await this.databaseManager.query(query, [`%${searchText}%`]);

      return result.rows.map(row => this.mapRowToComplaintView(row));
    } catch (error) {
      logger.error('Failed to search complaints', error as Error, { searchText });
      throw error;
    }
  }

  async getResolutionTimeStats(): Promise<{ average: number; median: number; min: number; max: number }> {
    try {
      const query = `
        SELECT 
          AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/3600) as average,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (closed_at - created_at))/3600) as median,
          MIN(EXTRACT(EPOCH FROM (closed_at - created_at))/3600) as min,
          MAX(EXTRACT(EPOCH FROM (closed_at - created_at))/3600) as max
        FROM complaint_views
        WHERE closed_at IS NOT NULL
      `;

      const result = await this.databaseManager.query(query);
      const row = result.rows[0];

      return {
        average: parseFloat(row.average) || 0,
        median: parseFloat(row.median) || 0,
        min: parseFloat(row.min) || 0,
        max: parseFloat(row.max) || 0
      };
    } catch (error) {
      logger.error('Failed to get resolution time stats', error as Error);
      throw error;
    }
  }

  async getComplaintTrends(days: number): Promise<Array<{ date: Date; count: number; status: string }>> {
    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          status,
          COUNT(*) as count
        FROM complaint_views
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at), status
        ORDER BY date DESC, status
      `;

      const result = await this.databaseManager.query(query);

      return result.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count),
        status: row.status
      }));
    } catch (error) {
      logger.error('Failed to get complaint trends', error as Error, { days });
      throw error;
    }
  }

  private buildWhereConditions(criteria: ComplaintSearchCriteria, values: any[], startIndex: number) {
    let whereClause = '';
    let paramIndex = startIndex;

    if (criteria.userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      values.push(criteria.userId);
      paramIndex++;
    }

    if (criteria.status) {
      whereClause += ` AND status = $${paramIndex}`;
      values.push(criteria.status);
      paramIndex++;
    }

    if (criteria.priority) {
      whereClause += ` AND priority = $${paramIndex}`;
      values.push(criteria.priority);
      paramIndex++;
    }

    if (criteria.category) {
      whereClause += ` AND category = $${paramIndex}`;
      values.push(criteria.category);
      paramIndex++;
    }

    if (criteria.assignedTo) {
      whereClause += ` AND assigned_to = $${paramIndex}`;
      values.push(criteria.assignedTo);
      paramIndex++;
    }

    if (criteria.createdAfter) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      values.push(criteria.createdAfter);
      paramIndex++;
    }

    if (criteria.createdBefore) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      values.push(criteria.createdBefore);
      paramIndex++;
    }

    return { whereClause, nextParamIndex: paramIndex };
  }

  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'priority': 'priority',
      'status': 'status'
    };

    return fieldMap[sortBy] || 'created_at';
  }

  private mapRowToComplaintView(row: any): ComplaintView {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      category: row.category,
      status: row.status,
      assignedTo: row.assigned_to,
      resolution: row.resolution,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
      version: row.version
    };
  }
}
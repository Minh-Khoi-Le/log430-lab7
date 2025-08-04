import { ComplaintRepository, ComplaintSearchCriteria } from '../../domain/repositories/complaint.repository';
import { Complaint, ComplaintProps } from '../../domain/entities/complaint.entity';
import { DatabaseManager } from '@shared/infrastructure/database';
import { createLogger } from '@shared/infrastructure/logging';

const logger = createLogger('complaint-repository');

export class ComplaintRepositoryImpl implements ComplaintRepository {
  constructor(private readonly databaseManager: DatabaseManager) {}

  async save(complaint: Complaint): Promise<void> {
    try {
      const complaintData = complaint.toPlainObject();
      
      const query = `
        INSERT INTO complaints (
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
        complaintData.id,
        complaintData.userId,
        complaintData.title,
        complaintData.description,
        complaintData.priority,
        complaintData.category,
        complaintData.status,
        complaintData.assignedTo || null,
        complaintData.resolution || null,
        complaintData.createdAt,
        complaintData.updatedAt,
        complaintData.closedAt || null,
        complaintData.version
      ];

      await this.databaseManager.query(query, values);

      logger.debug('Complaint saved successfully', {
        complaintId: complaint.id,
        version: complaint.version
      });
    } catch (error) {
      logger.error('Failed to save complaint', error as Error, {
        complaintId: complaint.id
      });
      throw error;
    }
  }

  async findById(id: string): Promise<Complaint | null> {
    try {
      const query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaints
        WHERE id = $1
      `;

      const result = await this.databaseManager.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToComplaint(row);
    } catch (error) {
      logger.error('Failed to find complaint by ID', error as Error, { complaintId: id });
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Complaint[]> {
    try {
      const query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaints
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.databaseManager.query(query, [userId]);

      return result.rows.map(row => this.mapRowToComplaint(row));
    } catch (error) {
      logger.error('Failed to find complaints by user ID', error as Error, { userId });
      throw error;
    }
  }

  async findByCriteria(criteria: ComplaintSearchCriteria): Promise<Complaint[]> {
    try {
      let query = `
        SELECT id, user_id, title, description, priority, category, status,
               assigned_to, resolution, created_at, updated_at, closed_at, version
        FROM complaints
        WHERE 1=1
      `;

      const values: any[] = [];
      let paramIndex = 1;

      if (criteria.userId) {
        query += ` AND user_id = $${paramIndex}`;
        values.push(criteria.userId);
        paramIndex++;
      }

      if (criteria.status) {
        query += ` AND status = $${paramIndex}`;
        values.push(criteria.status);
        paramIndex++;
      }

      if (criteria.priority) {
        query += ` AND priority = $${paramIndex}`;
        values.push(criteria.priority);
        paramIndex++;
      }

      if (criteria.category) {
        query += ` AND category = $${paramIndex}`;
        values.push(criteria.category);
        paramIndex++;
      }

      if (criteria.assignedTo) {
        query += ` AND assigned_to = $${paramIndex}`;
        values.push(criteria.assignedTo);
        paramIndex++;
      }

      if (criteria.createdAfter) {
        query += ` AND created_at >= $${paramIndex}`;
        values.push(criteria.createdAfter);
        paramIndex++;
      }

      if (criteria.createdBefore) {
        query += ` AND created_at <= $${paramIndex}`;
        values.push(criteria.createdBefore);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC`;

      if (criteria.limit) {
        query += ` LIMIT $${paramIndex}`;
        values.push(criteria.limit);
        paramIndex++;
      }

      if (criteria.offset) {
        query += ` OFFSET $${paramIndex}`;
        values.push(criteria.offset);
        paramIndex++;
      }

      const result = await this.databaseManager.query(query, values);

      return result.rows.map(row => this.mapRowToComplaint(row));
    } catch (error) {
      logger.error('Failed to find complaints by criteria', error as Error, { criteria });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const query = `DELETE FROM complaints WHERE id = $1`;
      await this.databaseManager.query(query, [id]);

      logger.debug('Complaint deleted successfully', { complaintId: id });
    } catch (error) {
      logger.error('Failed to delete complaint', error as Error, { complaintId: id });
      throw error;
    }
  }

  async getNextVersion(id: string): Promise<number> {
    try {
      const query = `SELECT version FROM complaints WHERE id = $1`;
      const result = await this.databaseManager.query(query, [id]);

      if (result.rows.length === 0) {
        return 1;
      }

      return result.rows[0].version + 1;
    } catch (error) {
      logger.error('Failed to get next version', error as Error, { complaintId: id });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const query = `SELECT 1 FROM complaints WHERE id = $1 LIMIT 1`;
      const result = await this.databaseManager.query(query, [id]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check complaint existence', error as Error, { complaintId: id });
      throw error;
    }
  }

  private mapRowToComplaint(row: any): Complaint {
    const props: ComplaintProps = {
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

    return new Complaint(props);
  }
}
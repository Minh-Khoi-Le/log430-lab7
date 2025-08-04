import { Complaint, ComplaintProps } from '../../domain/entities/complaint.entity';

describe('Complaint Entity', () => {
  const validComplaintProps: Omit<ComplaintProps, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'version'> = {
    userId: 'user-123',
    title: 'Test Complaint',
    description: 'This is a test complaint description',
    priority: 'MEDIUM',
    category: 'Technical Issue'
  };

  describe('Creation', () => {
    it('should create a complaint with valid properties', () => {
      const complaint = Complaint.create(validComplaintProps);

      expect(complaint.id).toBeDefined();
      expect(complaint.userId).toBe(validComplaintProps.userId);
      expect(complaint.title).toBe(validComplaintProps.title);
      expect(complaint.description).toBe(validComplaintProps.description);
      expect(complaint.priority).toBe(validComplaintProps.priority);
      expect(complaint.category).toBe(validComplaintProps.category);
      expect(complaint.status).toBe('OPEN');
      expect(complaint.version).toBe(1);
      expect(complaint.createdAt).toBeInstanceOf(Date);
      expect(complaint.updatedAt).toBeInstanceOf(Date);
    });

    it('should raise COMPLAINT_CREATED domain event on creation', () => {
      const complaint = Complaint.create(validComplaintProps);
      const events = complaint.domainEvents;

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('COMPLAINT_CREATED');
      expect(events[0].aggregateId).toBe(complaint.id);
      expect(events[0].eventData.complaintId).toBe(complaint.id);
      expect(events[0].eventData.userId).toBe(validComplaintProps.userId);
    });

    it('should throw error for invalid properties', () => {
      expect(() => {
        Complaint.create({
          ...validComplaintProps,
          userId: ''
        });
      }).toThrow('User ID is required');

      expect(() => {
        Complaint.create({
          ...validComplaintProps,
          title: ''
        });
      }).toThrow('Title is required');

      expect(() => {
        Complaint.create({
          ...validComplaintProps,
          description: ''
        });
      }).toThrow('Description is required');
    });
  });

  describe('Business Operations', () => {
    let complaint: Complaint;

    beforeEach(() => {
      complaint = Complaint.create(validComplaintProps);
      complaint.clearDomainEvents(); // Clear creation event for clean tests
    });

    describe('Assignment', () => {
      it('should assign complaint to user', () => {
        complaint.assign('agent-123', 'manager-456');

        expect(complaint.status).toBe('ASSIGNED');
        expect(complaint.assignedTo).toBe('agent-123');
        expect(complaint.version).toBe(2);

        const events = complaint.domainEvents;
        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('COMPLAINT_ASSIGNED');
        expect(events[0].eventData.assignedTo).toBe('agent-123');
        expect(events[0].eventData.assignedBy).toBe('manager-456');
      });

      it('should throw error when assigning closed complaint', () => {
        // First resolve and close the complaint
        complaint.assign('agent-123', 'manager-456');
        complaint.startProcessing('agent-123');
        complaint.resolve('Fixed the issue', 'agent-123');
        complaint.close('manager-456', 'Customer satisfied');

        expect(() => {
          complaint.assign('agent-789', 'manager-456');
        }).toThrow('Cannot assign a closed complaint');
      });

      it('should throw error for empty assignedTo', () => {
        expect(() => {
          complaint.assign('', 'manager-456');
        }).toThrow('Assigned user cannot be empty');
      });
    });

    describe('Processing', () => {
      it('should start processing assigned complaint', () => {
        complaint.assign('agent-123', 'manager-456');
        complaint.clearDomainEvents();

        complaint.startProcessing('agent-123');

        expect(complaint.status).toBe('IN_PROGRESS');
        expect(complaint.version).toBe(3);

        const events = complaint.domainEvents;
        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('COMPLAINT_PROCESSING_STARTED');
        expect(events[0].eventData.processedBy).toBe('agent-123');
      });

      it('should throw error when processing unassigned complaint', () => {
        expect(() => {
          complaint.startProcessing('agent-123');
        }).toThrow('Complaint must be assigned before processing');
      });
    });

    describe('Resolution', () => {
      it('should resolve complaint with resolution text', () => {
        complaint.assign('agent-123', 'manager-456');
        complaint.startProcessing('agent-123');
        complaint.clearDomainEvents();

        const resolution = 'Issue has been fixed by updating the configuration';
        complaint.resolve(resolution, 'agent-123');

        expect(complaint.status).toBe('RESOLVED');
        expect(complaint.resolution).toBe(resolution);
        expect(complaint.version).toBe(4);

        const events = complaint.domainEvents;
        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('COMPLAINT_RESOLVED');
        expect(events[0].eventData.resolution).toBe(resolution);
        expect(events[0].eventData.resolvedBy).toBe('agent-123');
      });

      it('should throw error for empty resolution', () => {
        complaint.assign('agent-123', 'manager-456');
        complaint.startProcessing('agent-123');

        expect(() => {
          complaint.resolve('', 'agent-123');
        }).toThrow('Resolution cannot be empty');
      });
    });

    describe('Closure', () => {
      it('should close resolved complaint', () => {
        complaint.assign('agent-123', 'manager-456');
        complaint.startProcessing('agent-123');
        complaint.resolve('Issue fixed', 'agent-123');
        complaint.clearDomainEvents();

        complaint.close('manager-456', 'Customer satisfied', 5);

        expect(complaint.status).toBe('CLOSED');
        expect(complaint.closedAt).toBeInstanceOf(Date);
        expect(complaint.version).toBe(5);

        const events = complaint.domainEvents;
        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('COMPLAINT_CLOSED');
        expect(events[0].eventData.closedBy).toBe('manager-456');
        expect(events[0].eventData.closureReason).toBe('Customer satisfied');
        expect(events[0].eventData.customerSatisfaction).toBe(5);
      });

      it('should throw error when closing unresolved complaint', () => {
        complaint.assign('agent-123', 'manager-456');

        expect(() => {
          complaint.close('manager-456', 'Closing anyway');
        }).toThrow('Complaint must be resolved before closing');
      });

      it('should throw error when closing already closed complaint', () => {
        complaint.assign('agent-123', 'manager-456');
        complaint.startProcessing('agent-123');
        complaint.resolve('Issue fixed', 'agent-123');
        complaint.close('manager-456', 'Customer satisfied');

        expect(() => {
          complaint.close('manager-456', 'Closing again');
        }).toThrow('Complaint is already closed');
      });
    });

    describe('Priority Update', () => {
      it('should update complaint priority', () => {
        complaint.clearDomainEvents();

        complaint.updatePriority('HIGH', 'manager-456');

        expect(complaint.priority).toBe('HIGH');
        expect(complaint.version).toBe(2);

        const events = complaint.domainEvents;
        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('COMPLAINT_PRIORITY_UPDATED');
        expect(events[0].eventData.oldPriority).toBe('MEDIUM');
        expect(events[0].eventData.newPriority).toBe('HIGH');
        expect(events[0].eventData.updatedBy).toBe('manager-456');
      });

      it('should throw error when updating priority of closed complaint', () => {
        complaint.assign('agent-123', 'manager-456');
        complaint.startProcessing('agent-123');
        complaint.resolve('Issue fixed', 'agent-123');
        complaint.close('manager-456', 'Customer satisfied');

        expect(() => {
          complaint.updatePriority('CRITICAL', 'manager-456');
        }).toThrow('Cannot update priority of a closed complaint');
      });
    });
  });

  describe('Domain Events', () => {
    it('should clear domain events', () => {
      const complaint = Complaint.create(validComplaintProps);
      expect(complaint.domainEvents).toHaveLength(1);

      complaint.clearDomainEvents();
      expect(complaint.domainEvents).toHaveLength(0);
    });
  });

  describe('Serialization', () => {
    it('should convert to plain object', () => {
      const complaint = Complaint.create(validComplaintProps);
      const plainObject = complaint.toPlainObject();

      expect(plainObject.id).toBe(complaint.id);
      expect(plainObject.userId).toBe(complaint.userId);
      expect(plainObject.title).toBe(complaint.title);
      expect(plainObject.description).toBe(complaint.description);
      expect(plainObject.priority).toBe(complaint.priority);
      expect(plainObject.category).toBe(complaint.category);
      expect(plainObject.status).toBe(complaint.status);
      expect(plainObject.version).toBe(complaint.version);
    });
  });
});
# ADR-009: Implémentation CQRS avec Event Sourcing

## Statut

**Accepté** - Implémenté en décembre 2024

## Contexte

Le service de gestion des réclamations nécessite une architecture permettant de gérer efficacement les opérations complexes de lecture et d'écriture, tout en maintenant la cohérence des données et en supportant des workflows métier sophistiqués.

### Défis Identifiés

1. **Séparation des préoccupations** : Les modèles d'écriture et de lecture ont des besoins différents
2. **Performance des requêtes** : Optimisation séparée des opérations de lecture et d'écriture  
3. **Évolutivité** : Capacité à faire évoluer indépendamment les côtés command et query
4. **Traçabilité métier** : Suivi complet du cycle de vie des réclamations
5. **Intégration événementielle** : Coordination avec l'architecture événementielle globale

## Décision

Nous implémentons le pattern **CQRS (Command Query Responsibility Segregation)** avec Event Sourcing pour le service de réclamations, incluant :

### 1. Séparation Command/Query

**Command Side (Écriture)** :
- Command Handlers pour les opérations métier
- Agrégats de domaine riches avec logique business
- Publication d'événements après chaque opération
- Modèle d'écriture optimisé pour la cohérence

**Query Side (Lecture)** :
- Query Handlers pour les requêtes optimisées
- Projections dénormalisées pour performance
- Modèles de lecture mis à jour via événements
- Vues spécialisées par cas d'usage

### 2. Event Sourcing Intégré

- Stockage des événements dans l'Event Store
- Reconstruction d'état via replay d'événements
- Historique complet et immuable
- Support pour l'audit et la conformité

### 3. Architecture Technique

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Command       │    │   Domain        │    │   Event         │
│   Handlers      │───▶│   Aggregates    │───▶│   Store         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Query         │◀───│   Projections   │◀───│   Event Bus     │
│   Handlers      │    │   (Read Models) │    │   (RabbitMQ)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Implémentation Détaillée

### Command Side

#### Command Handlers

```typescript
export class ComplaintCommandHandlers {
  constructor(
    private complaintRepository: ComplaintRepository,
    private eventBus: IEventBus
  ) {}

  @CommandHandler(CreateComplaintDto)
  async createComplaint(command: CreateComplaintDto): Promise<void> {
    // 1. Validation des données
    await this.validateCommand(command);
    
    // 2. Création de l'agrégat
    const complaint = Complaint.create(command);
    
    // 3. Sauvegarde
    await this.complaintRepository.save(complaint);
    
    // 4. Publication des événements
    await this.publishDomainEvents(complaint);
  }

  @CommandHandler(AssignComplaintDto)
  async assignComplaint(command: AssignComplaintDto): Promise<void> {
    const complaint = await this.complaintRepository.findById(command.complaintId);
    complaint.assign(command.assignedTo);
    await this.complaintRepository.save(complaint);
    await this.publishDomainEvents(complaint);
  }
}
```

#### Domain Aggregates

```typescript
export class Complaint extends AggregateRoot {
  private constructor(
    private readonly id: ComplaintId,
    private title: string,
    private description: string,
    private status: ComplaintStatus,
    private priority: Priority,
    private assignedTo?: UserId,
    private createdAt: Date = new Date()
  ) {
    super();
  }

  static create(data: CreateComplaintData): Complaint {
    const complaint = new Complaint(
      ComplaintId.generate(),
      data.title,
      data.description,
      ComplaintStatus.CREATED,
      data.priority
    );

    complaint.addDomainEvent(
      new ComplaintCreatedEvent(complaint.id, data, complaint.createdAt)
    );

    return complaint;
  }

  assign(assignedTo: UserId): void {
    if (this.status !== ComplaintStatus.CREATED) {
      throw new Error('Seules les réclamations nouvelles peuvent être assignées');
    }

    this.assignedTo = assignedTo;
    this.status = ComplaintStatus.ASSIGNED;

    this.addDomainEvent(
      new ComplaintAssignedEvent(this.id, assignedTo, new Date())
    );
  }
}
```

### Query Side

#### Query Handlers

```typescript
export class ComplaintQueryHandlers {
  constructor(
    private complaintProjectionRepository: ComplaintProjectionRepository
  ) {}

  @QueryHandler(GetComplaintsByStatusQuery)
  async getComplaintsByStatus(query: GetComplaintsByStatusQuery): Promise<ComplaintProjection[]> {
    return CQRSInstrumentation.instrumentQuery(
      'complaint-service',
      'GetComplaintsByStatus',
      query.correlationId,
      async () => {
        return this.complaintProjectionRepository.findByStatus(query.status);
      }
    );
  }

  @QueryHandler(GetComplaintTimelineQuery)
  async getComplaintTimeline(query: GetComplaintTimelineQuery): Promise<ComplaintTimeline> {
    return CQRSInstrumentation.instrumentQuery(
      'complaint-service',
      'GetComplaintTimeline',
      query.correlationId,
      async () => {
        return this.complaintProjectionRepository.getTimeline(query.complaintId);
      }
    );
  }
}
```

#### Projections (Read Models)

```typescript
export interface ComplaintProjection {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  customerInfo: {
    userId: string;
    userName: string;
    email: string;
  };
}

export interface ComplaintTimeline {
  complaintId: string;
  events: ComplaintTimelineEvent[];
}

export interface ComplaintTimelineEvent {
  eventType: string;
  eventData: any;
  occurredAt: Date;
  actor?: string;
  description: string;
}
```

#### Projection Handlers

```typescript
export class ComplaintProjectionHandlers {
  constructor(
    private projectionRepository: ComplaintProjectionRepository
  ) {}

  @EventHandler(ComplaintCreatedEvent)
  async onComplaintCreated(event: ComplaintCreatedEvent): Promise<void> {
    await CQRSInstrumentation.instrumentProjectionUpdate(
      'complaint-service',
      'ComplaintProjection',
      event.metadata.correlationId,
      async () => {
        const projection: ComplaintProjection = {
          id: event.aggregateId,
          title: event.eventData.title,
          description: event.eventData.description,
          status: 'CREATED',
          priority: event.eventData.priority,
          createdAt: event.metadata.occurredOn,
          updatedAt: event.metadata.occurredOn,
          customerInfo: {
            userId: event.eventData.userId,
            userName: event.eventData.userName,
            email: event.eventData.email
          }
        };

        await this.projectionRepository.create(projection);
      }
    );
  }

  @EventHandler(ComplaintAssignedEvent)
  async onComplaintAssigned(event: ComplaintAssignedEvent): Promise<void> {
    await CQRSInstrumentation.instrumentProjectionUpdate(
      'complaint-service',
      'ComplaintProjection',
      event.metadata.correlationId,
      async () => {
        await this.projectionRepository.update(event.aggregateId, {
          status: 'ASSIGNED',
          assignedTo: event.eventData.assignedTo,
          assignedToName: event.eventData.assignedToName,
          updatedAt: event.metadata.occurredOn
        });
      }
    );
  }
}
```

## Architecture de Base de Données

### Write Model (Côté Command)

```sql
-- Tables optimisées pour l'écriture et la cohérence
CREATE TABLE complaints (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL,
    assigned_to UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Contraintes métier au niveau base
ALTER TABLE complaints ADD CONSTRAINT check_status 
    CHECK (status IN ('CREATED', 'ASSIGNED', 'PROCESSING', 'RESOLVED', 'CLOSED'));
```

### Read Model (Côté Query)

```sql
-- Projections dénormalisées pour performance de lecture
CREATE TABLE complaint_projections (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    assigned_to UUID,
    assigned_to_name VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    customer_user_id UUID NOT NULL,
    customer_user_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL
);

-- Index optimisés pour les requêtes fréquentes
CREATE INDEX idx_complaint_proj_status ON complaint_projections(status);
CREATE INDEX idx_complaint_proj_assigned ON complaint_projections(assigned_to);
CREATE INDEX idx_complaint_proj_customer ON complaint_projections(customer_user_id);
CREATE INDEX idx_complaint_proj_created ON complaint_projections(created_at);

-- Vue matérialisée pour le timeline
CREATE TABLE complaint_timeline (
    id UUID PRIMARY KEY,
    complaint_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    actor VARCHAR(255),
    description TEXT NOT NULL
);
```

## API RESTful

### Command Endpoints (Écriture)

```typescript
// POST /api/complaints - Créer une réclamation
app.post('/api/complaints', async (req, res) => {
  const command = new CreateComplaintDto(req.body);
  await commandHandlers.createComplaint(command);
  res.status(201).json({ success: true });
});

// PUT /api/complaints/:id/assign - Assigner une réclamation  
app.put('/api/complaints/:id/assign', async (req, res) => {
  const command = new AssignComplaintDto(req.params.id, req.body.assignedTo);
  await commandHandlers.assignComplaint(command);
  res.status(200).json({ success: true });
});

// PUT /api/complaints/:id/start-processing - Démarrer traitement
app.put('/api/complaints/:id/start-processing', async (req, res) => {
  const command = new StartProcessingDto(req.params.id, req.body.processedBy);
  await commandHandlers.startProcessing(command);
  res.status(200).json({ success: true });
});
```

### Query Endpoints (Lecture)

```typescript
// GET /api/complaints - Lister les réclamations avec filtres
app.get('/api/complaints', async (req, res) => {
  const query = new GetComplaintsQuery(req.query);
  const result = await queryHandlers.getComplaints(query);
  res.json(result);
});

// GET /api/complaints/:id - Détail d'une réclamation
app.get('/api/complaints/:id', async (req, res) => {
  const query = new GetComplaintDetailsQuery(req.params.id);
  const result = await queryHandlers.getComplaintDetails(query);
  res.json(result);
});

// GET /api/complaints/:id/timeline - Timeline d'une réclamation
app.get('/api/complaints/:id/timeline', async (req, res) => {
  const query = new GetComplaintTimelineQuery(req.params.id);
  const result = await queryHandlers.getComplaintTimeline(query);
  res.json(result);
});
```

## Monitoring et Métriques

### Métriques CQRS Spécifiques

```typescript
// Commandes
export const commandExecutionTotal = new Counter({
  name: 'command_executions_total',
  help: 'Total number of command executions',
  labelNames: ['service', 'command_type', 'status']
});

export const commandExecutionDuration = new Histogram({
  name: 'command_execution_duration_seconds',
  help: 'Duration of command executions in seconds',
  labelNames: ['service', 'command_type', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Requêtes
export const queryExecutionTotal = new Counter({
  name: 'query_executions_total',
  help: 'Total number of query executions',
  labelNames: ['service', 'query_type', 'status']
});

// Projections
export const projectionUpdateTotal = new Counter({
  name: 'projection_updates_total',
  help: 'Total number of projection updates',
  labelNames: ['service', 'projection_type', 'status']
});
```

### Dashboard Grafana

Panels inclus dans le dashboard CQRS :

- **Command Execution Rate** : Taux d'exécution des commandes par type
- **Query Performance** : Performance des requêtes par type
- **Projection Lag** : Retard dans la mise à jour des projections
- **Error Rates** : Taux d'erreur par type d'opération
- **Command vs Query Ratio** : Répartition read/write

## Avantages de l'Implémentation

### Performance

1. **Optimisation séparée** : Read models optimisés pour les requêtes fréquentes
2. **Scalabilité** : Scaling indépendant des lectures et écritures
3. **Cache-friendly** : Projections facilement mises en cache

### Maintenabilité

1. **Séparation des responsabilités** : Code plus clair et focalisé
2. **Évolutivité** : Nouvelles projections sans impact sur les écritures
3. **Testing** : Tests unitaires simplifiés par séparation

### Business Value

1. **Audit trail** : Historique complet via Event Sourcing
2. **Reporting avancé** : Projections spécialisées pour analytics
3. **Temps réel** : Mises à jour immédiates via événements

## Défis et Solutions

### Eventual Consistency

**Défi** : Les projections peuvent être temporairement en retard

**Solutions** :
- Monitoring du lag des projections
- Retry logic pour les échecs de mise à jour
- UI feedback pour les opérations asynchrones

### Complexité

**Défi** : Architecture plus complexe que CRUD simple

**Solutions** :
- Documentation détaillée des patterns
- Abstractions réutilisables
- Formation de l'équipe

### Debugging

**Défi** : Traçage dans un système distribué

**Solutions** :
- Correlation IDs pour traçage end-to-end
- Logging structuré avec contexte
- Monitoring détaillé des métriques

## Tests et Validation

### Tests Unitaires

```typescript
describe('ComplaintCommandHandlers', () => {
  it('should create complaint and publish events', async () => {
    const command = new CreateComplaintDto(complaintData);
    await commandHandlers.createComplaint(command);
    
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'COMPLAINT_CREATED'
      })
    );
  });
});
```

### Tests d'Intégration

```typescript
describe('CQRS Integration', () => {
  it('should update projection after command execution', async () => {
    // Command execution
    await commandHandlers.createComplaint(command);
    
    // Wait for event processing
    await waitForEventProcessing();
    
    // Verify projection update
    const projection = await queryHandlers.getComplaintDetails(query);
    expect(projection.status).toBe('CREATED');
  });
});
```

## Évolution Future

### Optimisations Prévues

1. **Snapshots** : Optimisation de la reconstruction d'agrégats
2. **Read Replicas** : Distribution des lectures sur replicas
3. **Event Compaction** : Compression de l'historique événementiel
4. **GraphQL** : API unifiée pour requêtes complexes

### Nouveaux Cas d'Usage

1. **Analytics** : Projections spécialisées pour BI
2. **Machine Learning** : Features extraites des événements
3. **Real-time Dashboards** : Vues temps réel pour management

## Références

- [CQRS Pattern - Martin Fowler](https://martinfowler.com/bliki/CQRS.html)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Domain-Driven Design](https://domainlanguage.com/ddd/)
- [Effective Aggregate Design](https://dddcommunity.org/library/vernon_2011/)

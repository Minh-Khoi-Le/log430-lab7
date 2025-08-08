# ADR-008: Architecture Événementielle avec Event Sourcing et CQRS

## Statut

**Accepté** - Implémenté en décembre 2024

## Contexte

Dans le cadre de l'évolution vers une architecture microservices plus mature, le système de gestion de magasin nécessite une stratégie pour gérer la cohérence des données distribuées, assurer la traçabilité complète des opérations business, et découpler les composants pour améliorer la scalabilité.

### Défis identifiés

1. **Cohérence des données distribuées** : Les opérations métier complexes impliquent plusieurs microservices
2. **Traçabilité et audit** : Besoin de suivre toutes les modifications et événements business
3. **Découplage** : Réduire les dépendances directes entre services
4. **Scalabilité des lectures vs écritures** : Optimiser séparément les opérations de lecture et d'écriture
5. **Reconstruction d'état** : Capacité de rejouer l'historique des événements

### Contraintes

- Intégration avec l'architecture microservices existante
- Compatibilité avec PostgreSQL comme base de données principale
- Support pour les patterns Saga déjà implémentés
- Monitoring et observabilité avec Prometheus/Grafana
- Déploiement via Docker Compose

## Décision

Nous adoptons une **architecture événementielle complète** comprenant :

### 1. Event Sourcing avec Event Store

- **Event Store Service** utilisant PostgreSQL pour la persistance
- Stockage immutable de tous les événements business
- Capacité de replay et reconstruction d'état
- Versioning et contrôle de concurrence optimiste

### 2. CQRS (Command Query Responsibility Segregation)

- Séparation claire entre les modèles de commande et de requête
- **Command Handlers** pour les opérations d'écriture
- **Query Handlers** pour les opérations de lecture optimisées
- **Projections** mises à jour via les événements

### 3. Message Broker avec RabbitMQ

- **RabbitMQ** comme bus d'événements central
- Exchanges et queues typés par domaine métier
- Retry logic avec exponential backoff
- Dead letter queues pour la gestion d'erreurs

### 4. Service d'Audit Événementiel

- **Audit Service** s'abonnant à tous les événements
- Logging automatique de toutes les activités système
- Corrélation distribuée avec correlation IDs
- Trails d'audit pour la conformité

## Architecture Technique

### Composants Principaux

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Complaint      │    │  Event Store    │    │  Audit          │
│  Service        │    │  Service        │    │  Service        │
│  (CQRS)         │    │  (PostgreSQL)   │    │  (Subscriber)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └─────────────┬─────────┴─────────┬─────────────┘
                       │                   │
                ┌─────────────────┐ ┌─────────────────┐
                │  RabbitMQ       │ │  Saga           │
                │  Message Broker │ │  Orchestrator   │
                └─────────────────┘ └─────────────────┘
```

### Event Store avec PostgreSQL

**Choix technique** : PostgreSQL avec JSONB pour flexibilité et performance

```sql
CREATE TABLE event_store (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Avantages PostgreSQL** :
- ACID compliance pour la cohérence
- JSONB pour la flexibilité des événements
- Indexes performants pour les requêtes temporelles
- Intégration native avec l'infrastructure existante

### CQRS Implementation

**Command Side** (Écriture) :
```typescript
export class ComplaintCommandHandlers {
  async createComplaint(command: CreateComplaintDto): Promise<void> {
    // 1. Validation métier
    // 2. Création de l'agrégat
    // 3. Application de la logique business
    // 4. Persistance des événements
    // 5. Publication des événements
  }
}
```

**Query Side** (Lecture) :
```typescript
export class ComplaintQueryHandlers {
  async getComplaintsByStatus(status: string): Promise<ComplaintProjection[]> {
    // Requêtes optimisées sur les projections
    return this.projectionRepository.findByStatus(status);
  }
}
```

### Message Broker Configuration

**Exchanges RabbitMQ** :
- `complaints.events` - Événements du domaine des réclamations
- `audit.events` - Événements d'audit
- `saga.events` - Événements de coordination Saga
- `notifications.events` - Événements de notification

**Queues par Service** :
- `complaint.commands` - Commandes pour le service réclamations
- `audit.all.events` - Tous les événements pour l'audit
- `saga.orchestration` - Coordination des workflows

## Patterns Implémentés

### 1. Event Sourcing Pattern

```typescript
// Stockage des événements
await eventStore.appendEvents('complaint-123', [
  new ComplaintCreatedEvent(complaintData),
  new ComplaintAssignedEvent(assignmentData)
]);

// Reconstruction d'état
const events = await eventStore.getEvents('complaint-123');
const complaint = Complaint.fromEvents(events);
```

### 2. CQRS Pattern

```typescript
// Séparation Command/Query
class ComplaintService {
  constructor(
    private commandHandlers: ComplaintCommandHandlers,
    private queryHandlers: ComplaintQueryHandlers
  ) {}
}
```

### 3. Projection Pattern

```typescript
export class ComplaintProjectionHandlers {
  @EventHandler(ComplaintCreatedEvent)
  async onComplaintCreated(event: ComplaintCreatedEvent): Promise<void> {
    // Mise à jour des vues de lecture optimisées
    await this.updateProjection(event);
  }
}
```

### 4. Saga Orchestration

```typescript
@SagaOrchestrator('ComplaintResolutionSaga')
export class ComplaintResolutionSaga {
  @SagaStart(ComplaintCreatedEvent)
  async startResolution(event: ComplaintCreatedEvent): Promise<void> {
    // Orchestration du workflow de résolution
  }
}
```

## Monitoring et Observabilité

### Métriques Prometheus

**Événements** :
- `events_published_total` - Nombre d'événements publiés
- `events_consumed_total` - Nombre d'événements consommés
- `event_publishing_duration_seconds` - Latence de publication
- `event_consumption_duration_seconds` - Latence de consommation

**CQRS** :
- `command_executions_total` - Exécutions de commandes
- `query_executions_total` - Exécutions de requêtes
- `projection_updates_total` - Mises à jour de projections

**Event Store** :
- `event_store_operations_total` - Opérations sur l'event store
- `event_store_event_count` - Nombre total d'événements
- `event_store_size_bytes` - Taille de l'event store

**Sagas** :
- `saga_executions_total` - Exécutions de sagas
- `saga_step_executions_total` - Étapes de saga exécutées
- `saga_compensations_total` - Compensations exécutées

### Dashboard Grafana

**Dashboard "Event-Driven Architecture"** inclut :
- Taux de publication/consommation d'événements
- Latence end-to-end des événements
- Taux d'erreur de traitement
- Métriques de performance CQRS
- Monitoring des sagas actives

## Intégration avec l'Architecture Existante

### Services Concernés

1. **Complaint Service** - Implémentation CQRS complète
2. **Event Store Service** - Persistance et replay d'événements
3. **Audit Service** - Souscription à tous les événements
4. **Saga Orchestrator** - Coordination des workflows complexes
5. **Notification Service** - Réaction aux événements métier

### Flux d'Événements Typique

```
1. HTTP Request → Complaint Service
2. Command Handler → Business Logic
3. Domain Events → Event Store (PostgreSQL)
4. Events Published → RabbitMQ
5. Event Consumption → Multiple Services
   - Audit Service → Audit Logs
   - Projection Handlers → Read Models
   - Saga Orchestrator → Workflow Steps
   - Notification Service → User Alerts
```

## Avantages

### Techniques
1. **Découplage** - Services indépendants via événements
2. **Scalabilité** - Séparation lecture/écriture optimisée
3. **Traçabilité** - Historique complet des événements
4. **Résilience** - Retry logic et dead letter queues
5. **Consistance** - Eventual consistency via événements

### Métier
1. **Audit complet** - Conformité réglementaire
2. **Reconstruction d'état** - Analyse historique
3. **Workflows complexes** - Orchestration via sagas
4. **Temps réel** - Réactions immédiates aux événements

## Inconvénients et Mitigation

### Complexité
- **Défi** : Courbe d'apprentissage des patterns
- **Mitigation** : Documentation complète et formation

### Eventual Consistency
- **Défi** : Cohérence finale vs cohérence immédiate
- **Mitigation** : Design conscient des contraintes business

### Debugging Distribué
- **Défi** : Traçage des flux événementiels
- **Mitigation** : Correlation IDs et logging structuré

## Validation et Métriques de Succès

### Critères de Succès

1. **Performance** : Latence P95 < 100ms pour publication d'événements
2. **Fiabilité** : 99.9% de livraison d'événements
3. **Audit** : 100% des événements business tracés
4. **Reconstruction** : Replay complet en < 30 secondes
5. **Monitoring** : Métriques temps réel disponibles

### Tests de Validation

- **Tests d'intégration** : Flux événementiels end-to-end
- **Tests de charge** : 1000+ événements/seconde
- **Tests de résilience** : Pannes et récupération
- **Tests d'audit** : Vérification de la traçabilité

## Évolution Future

### Optimisations Possibles

1. **Snapshotting** - Optimisation de la reconstruction d'état
2. **Event Versioning** - Gestion de l'évolution des schémas
3. **GDPR Compliance** - Effacement d'événements personnels
4. **Cross-Service Transactions** - Coordination transactionnelle

### Monitoring Avancé

1. **Business Intelligence** - Analytics sur les événements
2. **Alerting Proactif** - Détection d'anomalies
3. **Performance Tuning** - Optimisation continue

## Références

- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [RabbitMQ Best Practices](https://www.rabbitmq.com/best-practices.html)

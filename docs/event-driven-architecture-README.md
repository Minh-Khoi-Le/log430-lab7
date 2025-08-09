# Architecture Événementielle avec Sagas Chorégraphiées

## Table des Matières

- [Architecture Événementielle avec Sagas Chorégraphiées](#architecture-événementielle-avec-sagas-chorégraphiées)
  - [Table des Matières](#table-des-matières)
  - [Description](#description)
  - [Architecture](#architecture)
    - [Principes Architecturaux Clés](#principes-architecturaux-clés)
  - [Stack Technique](#stack-technique)
  - [Démarrage Rapide](#démarrage-rapide)
    - [Prérequis](#prérequis)
    - [Lancement de l'Application](#lancement-de-lapplication)
    - [Démarrage Manuel](#démarrage-manuel)
  - [Services Événementiels](#services-événementiels)
    - [Service de Plaintes (Complaint Service)](#service-de-plaintes-complaint-service)
    - [Service de Notifications](#service-de-notifications)
    - [Service d'Audit](#service-daudit)
    - [Service Event Store](#service-event-store)
  - [Messagerie et Événements](#messagerie-et-événements)
    - [Infrastructure de Messagerie](#infrastructure-de-messagerie)
    - [Schémas d'Événements](#schémas-dévénements)
    - [Gestion des Erreurs](#gestion-des-erreurs)
  - [Sagas Chorégraphiées](#sagas-chorégraphiées)
    - [Flux de Saga](#flux-de-saga)
    - [Mécanismes de Compensation](#mécanismes-de-compensation)
  - [CQRS (Command Query Responsibility Segregation)](#cqrs-command-query-responsibility-segregation)
    - [Séparation Commande/Requête](#séparation-commanderequête)
    - [Modèles de Lecture](#modèles-de-lecture)
  - [Event Sourcing](#event-sourcing)
    - [Stockage des Événements](#stockage-des-événements)
    - [Reconstruction d'État](#reconstruction-détat)
  - [Observabilité et Monitoring](#observabilité-et-monitoring)
    - [Métriques Personnalisées](#métriques-personnalisées)
    - [Tableaux de Bord Grafana](#tableaux-de-bord-grafana)
  - [Tests](#tests)
    - [Tests d'Intégration](#tests-dintégration)
    - [Tests de Charge](#tests-de-charge)
  - [Déploiement](#déploiement)
    - [Configuration Docker](#configuration-docker)
    - [Variables d'Environnement](#variables-denvironnement)
  - [Dépannage](#dépannage)
    - [Problèmes Courants](#problèmes-courants)
    - [Logs et Debugging](#logs-et-debugging)

## Description

Cette extension implémente une architecture événementielle complète avec messagerie Pub/Sub, Event Sourcing, CQRS (Command Query Responsibility Segregation), et sagas chorégraphiées pour la coordination de transactions distribuées. Le système démontre des patterns de communication résilients entre microservices avec une observabilité complète via Prometheus et Grafana.

L'implémentation se concentre sur un scénario métier de gestion des plaintes clients, montrant comment les événements circulent dans le système depuis la création d'une plainte jusqu'à sa résolution, avec des mécanismes de compensation appropriés pour les scénarios d'échec.

**Approche d'Intégration :** Les nouveaux composants événementiels s'intègrent parfaitement dans l'architecture microservices existante, étendant les fonctionnalités actuelles sans casser les APIs ou services existants. Les nouveaux services suivent les patterns établis et l'infrastructure déjà présente dans le projet.

## Architecture

### Principes Architecturaux Clés

1. **Architecture Événementielle** : Communication asynchrone via événements métier
2. **Sagas Chorégraphiées** : Coordination distribuée sans orchestrateur central
3. **CQRS** : Séparation des responsabilités lecture/écriture
4. **Event Sourcing** : Persistance de tous les événements métier
5. **Observabilité Complète** : Monitoring et traçabilité de bout en bout

```mermaid
graph TB
    subgraph "Couche Client"
        WC[Client Web<br/>React + Material-UI]
    end
    
    subgraph "Couche API Gateway"
        KG[Kong Gateway<br/>Port 8000]
    end
    
    subgraph "Services Événementiels"
        CS[Service Plaintes<br/>Port 3005]
        NS[Service Notifications<br/>Port 3006]
        AS[Service Audit<br/>Port 3007]
        ES[Service Event Store<br/>Port 3008]
    end
    
    subgraph "Services Existants"
        US[Service Utilisateurs<br/>Port 3001]
        CAS[Service Catalogue<br/>Port 3002]
        TS[Service Transactions<br/>Port 3003]
        SO[Orchestrateur Saga<br/>Port 3000]
    end
    
    subgraph "Infrastructure Messagerie"
        RMQ[RabbitMQ<br/>Port 5672]
        REDIS[Redis Streams<br/>Port 6379]
    end
    
    subgraph "Couche Données"
        PG[(PostgreSQL<br/>Base Partagée)]
        ES_DB[(Event Store<br/>MongoDB)]
    end
    
    subgraph "Monitoring"
        PROM[Prometheus<br/>Port 9090]
        GRAF[Grafana<br/>Port 3004]
    end
    
    WC --> KG
    KG --> CS
    KG --> US
    KG --> CAS
    KG --> TS
    
    CS --> RMQ
    NS --> RMQ
    AS --> RMQ
    ES --> RMQ
    
    RMQ --> REDIS
    
    CS --> PG
    US --> PG
    CAS --> PG
    TS --> PG
    
    ES --> ES_DB
    
    CS --> PROM
    NS --> PROM
    AS --> PROM
    ES --> PROM
    
    PROM --> GRAF
```

## Stack Technique

**Infrastructure de Messagerie :**

- **RabbitMQ** pour la messagerie Pub/Sub fiable
- **Redis Streams** pour la rejouabilité des événements
- **MongoDB** pour l'Event Store

**Services Événementiels :**

- **Node.js 18+** avec **Express.js**
- **TypeScript** pour la sécurité des types
- **Architecture DDD** avec contextes bornés
- **Patterns CQRS** avec séparation commande/requête

**Monitoring et Observabilité :**

- **Prometheus** pour la collecte de métriques
- **Grafana** pour la visualisation
- **Structured Logging** avec IDs de corrélation
- **Distributed Tracing** pour le suivi des sagas

## Démarrage Rapide

### Prérequis

- **Docker & Docker Compose** installés
- **Node.js 18+** pour le développement local
- **Environnement Windows** (scripts .bat)

### Lancement de l'Application

Le moyen le plus simple de démarrer tout le système :

```bash
cd src/scripts
.\quick-start-event-driven.bat
```

Ce script va :

1. Arrêter et nettoyer les conteneurs existants
2. Construire toutes les images Docker
3. Démarrer PostgreSQL, Redis, MongoDB, et tous les microservices
4. Démarrer RabbitMQ et attendre qu'il soit prêt
5. Lancer les migrations de base de données et alimenter les données de démo
6. Démarrer le client web localement

### Démarrage Manuel

Si vous préférez un contrôle manuel :

```bash
cd src

# Démarrer l'infrastructure
docker-compose up -d postgres redis mongodb rabbitmq

# Configurer RabbitMQ
docker-compose run --rm --profile setup rabbitmq-setup

# Migrations et données
docker-compose run --rm db-migrate
docker-compose run --rm db-seed

# Démarrer tous les services
docker-compose up -d

# Démarrer le frontend localement
cd web-client
npm install
npm run dev
```

**Points d'Accès :**

- **Client Web** : <http://localhost:5173>
- **API Gateway** : <http://localhost:8000>
- **RabbitMQ Management** : <http://localhost:15672> (admin/admin123)
- **Prometheus** : <http://localhost:9090>
- **Grafana** : <http://localhost:3004> (admin/admin)

## Services Événementiels

### Service de Plaintes (Complaint Service)

**Responsabilités :**

- Gestion du cycle de vie des plaintes
- Implémentation du pattern CQRS
- Publication d'événements métier
- Coordination des sagas chorégraphiées

**Endpoints API :**

```
POST   /api/complaints              # Créer une plainte
GET    /api/complaints              # Lister les plaintes
GET    /api/complaints/:id          # Détails d'une plainte
PUT    /api/complaints/:id/assign   # Assigner une plainte
PUT    /api/complaints/:id/process  # Traiter une plainte
PUT    /api/complaints/:id/close    # Fermer une plainte
```

**Événements Publiés :**

- `COMPLAINT_CREATED` : Plainte créée
- `COMPLAINT_ASSIGNED` : Plainte assignée
- `COMPLAINT_PROCESSED` : Plainte traitée
- `COMPLAINT_CLOSED` : Plainte fermée
- `COMPLAINT_COMPENSATION_REQUIRED` : Compensation requise

### Service de Notifications

**Responsabilités :**

- Traitement des événements de notification
- Envoi d'emails aux utilisateurs et administrateurs
- Historique des notifications
- Traitement idempotent des messages

**Événements Consommés :**

- `COMPLAINT_CREATED` → Notification de création
- `COMPLAINT_ASSIGNED` → Notification d'assignation
- `COMPLAINT_PROCESSED` → Notification de traitement
- `COMPLAINT_CLOSED` → Notification de fermeture

### Service d'Audit

**Responsabilités :**

- Journalisation de tous les événements métier
- Maintien des enregistrements de conformité
- Capacités de requête d'audit
- Logging structuré avec IDs de corrélation

**Endpoints API :**

```
GET /api/audit/trail/:aggregateId    # Piste d'audit pour un agrégat
GET /api/audit/search               # Recherche dans les logs d'audit
GET /api/audit/events               # Liste des événements
```

### Service Event Store

**Responsabilités :**

- Persistance immuable de tous les événements domaine
- Capacités de rejeu d'événements
- Support des patterns Event Sourcing
- Maintien de l'ordre et de la cohérence des événements

**Endpoints API :**

```
GET /api/events/stream/:streamId     # Événements d'un stream
GET /api/events/all                 # Tous les événements
POST /api/events/replay/:streamId    # Rejouer les événements
GET /api/events/state/:aggregateId   # État reconstruit
```

## Messagerie et Événements

### Infrastructure de Messagerie

**Configuration RabbitMQ :**

- **Exchanges** : `complaints.events`, `notifications.events`, `audit.events`
- **Queues Durables** : Stockage persistant des messages
- **Dead Letter Queues** : Gestion des messages échoués
- **Routing par Topic** : Routage basé sur les types d'événements

**Configuration Redis Streams :**

- **Streams** : `complaints-stream`, `notifications-stream`
- **Consumer Groups** : Gestion organisée des consommateurs
- **Suivi des Offsets** : Accusé de réception automatique

### Schémas d'Événements

**Événement de Base :**

```typescript
interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  metadata: {
    timestamp: Date;
    version: number;
    correlationId: string;
    causationId?: string;
    userId?: string;
  };
}
```

**Événement Plainte Créée :**

```typescript
interface ComplaintCreatedEvent extends DomainEvent {
  eventType: 'COMPLAINT_CREATED';
  eventData: {
    complaintId: string;
    userId: string;
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category: string;
    createdAt: Date;
  };
}
```

### Gestion des Erreurs

**Stratégies de Retry :**

- **Backoff Exponentiel** : Délai initial 1s, maximum 60s
- **Tentatives Maximum** : 5 tentatives
- **Dead Letter Queue** : Messages échoués définitivement

**Catégories d'Erreurs :**

- **Erreurs Transitoires** : Timeouts réseau, indisponibilité temporaire
- **Messages Empoisonnés** : Événements malformés, échecs de validation
- **Erreurs Métier** : Violations de règles domaine, transitions d'état invalides

## Sagas Chorégraphiées

### Flux de Saga

**Saga de Gestion de Plainte :**

```mermaid
sequenceDiagram
    participant Client
    participant ComplaintService
    participant NotificationService
    participant AuditService
    participant EventStore
    
    Client->>ComplaintService: Créer Plainte
    ComplaintService->>EventStore: Stocker COMPLAINT_CREATED
    ComplaintService->>RabbitMQ: Publier COMPLAINT_CREATED
    
    RabbitMQ->>NotificationService: COMPLAINT_CREATED
    NotificationService->>NotificationService: Envoyer Email
    NotificationService->>RabbitMQ: Publier NOTIFICATION_SENT
    
    RabbitMQ->>AuditService: COMPLAINT_CREATED
    AuditService->>AuditService: Logger Événement
    
    ComplaintService->>ComplaintService: Assigner Plainte
    ComplaintService->>RabbitMQ: Publier COMPLAINT_ASSIGNED
    
    Note over ComplaintService,AuditService: Processus continue...
```

### Mécanismes de Compensation

**Événements de Compensation :**

- `COMPLAINT_COMPENSATION_REQUIRED` : Déclenche la compensation
- `NOTIFICATION_COMPENSATION` : Annule les notifications
- `AUDIT_COMPENSATION` : Marque les entrées comme compensées

**Actions de Compensation :**

```typescript
interface CompensationAction {
  service: string;
  action: string;
  parameters: any;
  order: number;
}
```

## CQRS (Command Query Responsibility Segregation)

### Séparation Commande/Requête

**Côté Commande (Écriture) :**

- Handlers de commandes pour les opérations métier
- Publication d'événements après changements d'état
- Modèles domaine riches avec logique métier

**Côté Requête (Lecture) :**

- Projections optimisées construites à partir d'événements
- Repositories séparés pour les opérations de requête
- Modèles de vue dénormalisés

### Modèles de Lecture

**Vue Plainte :**

```typescript
interface ComplaintView {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  assignedTo?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  
  // Champs dérivés des événements
  timeline: ComplaintTimelineEntry[];
  notifications: NotificationEntry[];
  auditTrail: AuditEntry[];
}
```

## Event Sourcing

### Stockage des Événements

**Schéma MongoDB :**

```typescript
interface StoredEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  metadata: {
    timestamp: Date;
    version: number;
    correlationId: string;
    causationId?: string;
    userId?: string;
  };
}
```

### Reconstruction d'État

**Processus de Rejeu :**

1. Récupération des événements par ordre chronologique
2. Application séquentielle des événements
3. Reconstruction de l'état actuel de l'agrégat
4. Validation de la cohérence

## Observabilité et Monitoring

### Métriques Personnalisées

**Métriques Prometheus :**

```typescript
// Durée de traitement des événements
const eventProcessingDuration = new Histogram({
  name: 'event_processing_duration_seconds',
  help: 'Durée de traitement des événements',
  labelNames: ['event_type', 'service', 'status']
});

// Taux de publication d'événements
const eventPublishingRate = new Counter({
  name: 'events_published_total',
  help: 'Nombre total d\'événements publiés',
  labelNames: ['event_type', 'service']
});

// Durée d'exécution des sagas
const sagaExecutionDuration = new Histogram({
  name: 'saga_execution_duration_seconds',
  help: 'Durée d\'exécution des sagas',
  labelNames: ['saga_type', 'status']
});
```

### Tableaux de Bord Grafana

**Dashboard Architecture Événementielle :**

- Taux de publication d'événements par service et type
- Latence de traitement des événements (percentiles)
- Taux de succès/échec des sagas
- Métriques des Dead Letter Queues
- Métriques de performance de l'Event Store

## Tests

### Tests d'Intégration

**Tests de Flux d'Événements :**

```typescript
describe('Flux de Plainte Complète', () => {
  it('devrait traiter une plainte de bout en bout', async () => {
    // Créer une plainte
    const complaint = await createComplaint(complaintData);
    
    // Vérifier les événements publiés
    await waitForEvent('COMPLAINT_CREATED');
    
    // Vérifier les notifications envoyées
    const notifications = await getNotifications(complaint.id);
    expect(notifications).toHaveLength(1);
    
    // Vérifier l'audit trail
    const auditTrail = await getAuditTrail(complaint.id);
    expect(auditTrail).toContainEvent('COMPLAINT_CREATED');
  });
});
```

### Tests de Charge

**Scénarios k6 :**

- `event-publishing-load.js` : Test de charge publication d'événements
- `saga-coordination-stress.js` : Test de stress coordination sagas
- `event-store-performance.js` : Performance de l'Event Store

## Déploiement

### Configuration Docker

**docker-compose.event-driven.yml :**

```yaml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin123
    volumes:
      - mongodb_data:/data/db

  complaint-service:
    build: ./services/complaint-service
    ports:
      - "3005:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/retail_db
      - RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - rabbitmq
      - redis

  notification-service:
    build: ./services/notification-service
    ports:
      - "3006:3000"
    environment:
      - RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
    depends_on:
      - rabbitmq

  audit-service:
    build: ./services/audit-service
    ports:
      - "3007:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/retail_db
      - RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672
    depends_on:
      - postgres
      - rabbitmq

  event-store-service:
    build: ./services/event-store-service
    ports:
      - "3008:3000"
    environment:
      - MONGODB_URL=mongodb://admin:admin123@mongodb:27017/eventstore?authSource=admin
      - RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672
    depends_on:
      - mongodb
      - rabbitmq

volumes:
  rabbitmq_data:
  mongodb_data:
```

### Variables d'Environnement

**Variables Communes :**

- `DATABASE_URL` : URL de connexion PostgreSQL
- `RABBITMQ_URL` : URL de connexion RabbitMQ
- `REDIS_URL` : URL de connexion Redis
- `MONGODB_URL` : URL de connexion MongoDB
- `LOG_LEVEL` : Niveau de logging (debug, info, warn, error)
- `CORRELATION_ID_HEADER` : Header pour l'ID de corrélation

## Dépannage

### Problèmes Courants

**RabbitMQ ne démarre pas :**

```bash
# Vérifier les logs
docker logs rabbitmq

# Nettoyer les volumes
docker-compose down -v
docker-compose up -d rabbitmq
```

**Événements non traités :**

```bash
# Vérifier les queues RabbitMQ
curl -u admin:admin123 http://localhost:15672/api/queues

# Vérifier les Dead Letter Queues
curl -u admin:admin123 http://localhost:15672/api/queues/%2F/complaints.events.dlq
```

**Event Store inaccessible :**

```bash
# Vérifier MongoDB
docker exec -it mongodb mongo -u admin -p admin123

# Vérifier les collections
use eventstore
db.events.find().limit(5)
```

### Logs et Debugging

**Logs Structurés :**

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Event processed successfully",
  "eventType": "COMPLAINT_CREATED",
  "aggregateId": "complaint-123",
  "correlationId": "saga-456",
  "service": "complaint-service"
}
```

**Commandes de Debug :**

```bash
# Logs en temps réel
docker-compose logs -f complaint-service

# Métriques Prometheus
curl http://localhost:9090/api/v1/query?query=events_published_total

# État des services
docker-compose ps
```

---


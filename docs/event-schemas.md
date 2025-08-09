# Schémas d'Événements - Architecture Événementielle

## Table des Matières

- [Schémas d'Événements - Architecture Événementielle](#schémas-dévénements---architecture-événementielle)
  - [Table des Matières](#table-des-matières)
  - [Vue d'Ensemble](#vue-densemble)
  - [Structure d'Événement de Base](#structure-dévénement-de-base)
  - [Événements du Domaine Plaintes](#événements-du-domaine-plaintes)
    - [COMPLAINT\_CREATED](#complaint_created)
    - [COMPLAINT\_ASSIGNED](#complaint_assigned)
    - [COMPLAINT\_PROCESSED](#complaint_processed)
    - [COMPLAINT\_CLOSED](#complaint_closed)
    - [COMPLAINT\_COMPENSATION\_REQUIRED](#complaint_compensation_required)
  - [Événements de Notification](#événements-de-notification)
    - [NOTIFICATION\_SENT](#notification_sent)
    - [NOTIFICATION\_FAILED](#notification_failed)
    - [NOTIFICATION\_COMPENSATION](#notification_compensation)
  - [Événements d'Audit](#événements-daudit)
    - [AUDIT\_LOG\_CREATED](#audit_log_created)
    - [AUDIT\_SEARCH\_PERFORMED](#audit_search_performed)
  - [Événements Event Store](#événements-event-store)
    - [EVENT\_STORED](#event_stored)
    - [EVENT\_REPLAY\_STARTED](#event_replay_started)
    - [EVENT\_REPLAY\_COMPLETED](#event_replay_completed)
  - [Événements de Saga](#événements-de-saga)
    - [SAGA\_STARTED](#saga_started)
    - [SAGA\_STEP\_COMPLETED](#saga_step_completed)
    - [SAGA\_COMPLETED](#saga_completed)
    - [SAGA\_FAILED](#saga_failed)
    - [SAGA\_COMPENSATED](#saga_compensated)
  - [Métadonnées et Corrélation](#métadonnées-et-corrélation)
    - [Structure des Métadonnées](#structure-des-métadonnées)
    - [IDs de Corrélation](#ids-de-corrélation)
  - [Validation des Schémas](#validation-des-schémas)
    - [Règles de Validation](#règles-de-validation)
    - [Exemples de Validation](#exemples-de-validation)
  - [Versioning des Événements](#versioning-des-événements)
    - [Stratégie de Versioning](#stratégie-de-versioning)
    - [Migration d'Événements](#migration-dévénements)
  - [Sérialisation et Transport](#sérialisation-et-transport)
    - [Format JSON](#format-json)
    - [Headers de Message](#headers-de-message)
  - [Exemples Complets](#exemples-complets)
    - [Flux Complet de Plainte](#flux-complet-de-plainte)
    - [Scénario de Compensation](#scénario-de-compensation)

## Vue d'Ensemble

Ce document définit tous les schémas d'événements utilisés dans l'architecture événementielle avec sagas chorégraphiées. Chaque événement suit une structure standardisée pour assurer la cohérence, la traçabilité et l'interopérabilité entre les services.

**Principes de Design :**

- **Immutabilité** : Les événements ne peuvent pas être modifiés une fois créés
- **Traçabilité** : Chaque événement contient des métadonnées de corrélation
- **Versioning** : Support de l'évolution des schémas dans le temps
- **Validation** : Validation stricte des schémas à la publication et consommation

## Structure d'Événement de Base

Tous les événements héritent de cette structure de base :

```typescript
interface DomainEvent {
  // Identifiants uniques
  eventId: string;                    // UUID unique pour cet événement
  eventType: string;                  // Type d'événement (ex: COMPLAINT_CREATED)
  aggregateId: string;                // ID de l'agrégat concerné
  aggregateType: string;              // Type d'agrégat (ex: Complaint)
  
  // Données métier
  eventData: any;                     // Payload spécifique à l'événement
  
  // Métadonnées
  metadata: {
    timestamp: Date;                  // Horodatage de création
    version: number;                  // Version du schéma d'événement
    correlationId: string;            // ID de corrélation pour traçage
    causationId?: string;             // ID de l'événement causant
    userId?: string;                  // Utilisateur à l'origine (si applicable)
    sagaId?: string;                  // ID de saga (si applicable)
    source: string;                   // Service émetteur
  };
}
```

## Événements du Domaine Plaintes

### COMPLAINT_CREATED

Émis lors de la création d'une nouvelle plainte client.

```typescript
interface ComplaintCreatedEvent extends DomainEvent {
  eventType: 'COMPLAINT_CREATED';
  aggregateType: 'Complaint';
  eventData: {
    complaintId: string;              // ID unique de la plainte
    userId: string;                   // ID de l'utilisateur créateur
    title: string;                    // Titre de la plainte (max 255 chars)
    description: string;              // Description détaillée
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category: string;                 // Catégorie de plainte
    createdAt: Date;                  // Date de création
    customerInfo: {
      name: string;
      email: string;
      phone?: string;
    };
  };
}
```

**Exemple :**

```json
{
  "eventId": "evt_123e4567-e89b-12d3-a456-426614174000",
  "eventType": "COMPLAINT_CREATED",
  "aggregateId": "complaint_456",
  "aggregateType": "Complaint",
  "eventData": {
    "complaintId": "complaint_456",
    "userId": "user_789",
    "title": "Produit défectueux reçu",
    "description": "Le produit commandé est arrivé endommagé...",
    "priority": "HIGH",
    "category": "PRODUCT_QUALITY",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "customerInfo": {
      "name": "Jean Dupont",
      "email": "jean.dupont@email.com",
      "phone": "+33123456789"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": 1,
    "correlationId": "corr_abc123",
    "userId": "user_789",
    "sagaId": "saga_def456",
    "source": "complaint-service"
  }
}
```

### COMPLAINT_ASSIGNED

Émis lorsqu'une plainte est assignée à un agent.

```typescript
interface ComplaintAssignedEvent extends DomainEvent {
  eventType: 'COMPLAINT_ASSIGNED';
  aggregateType: 'Complaint';
  eventData: {
    complaintId: string;
    assignedTo: string;               // ID de l'agent assigné
    assignedBy: string;               // ID de l'assignateur
    assignedAt: Date;
    previousAssignee?: string;        // Assigné précédent (si réassignation)
    assignmentReason?: string;        // Raison de l'assignation
  };
}
```

### COMPLAINT_PROCESSED

Émis lorsqu'une plainte est traitée par un agent.

```typescript
interface ComplaintProcessedEvent extends DomainEvent {
  eventType: 'COMPLAINT_PROCESSED';
  aggregateType: 'Complaint';
  eventData: {
    complaintId: string;
    processedBy: string;              // ID de l'agent traitant
    resolution: string;               // Description de la résolution
    processedAt: Date;
    processingTime: number;           // Temps de traitement en minutes
    resolutionType: 'RESOLVED' | 'ESCALATED' | 'TRANSFERRED';
    attachments?: string[];           // URLs des pièces jointes
  };
}
```

### COMPLAINT_CLOSED

Émis lorsqu'une plainte est fermée.

```typescript
interface ComplaintClosedEvent extends DomainEvent {
  eventType: 'COMPLAINT_CLOSED';
  aggregateType: 'Complaint';
  eventData: {
    complaintId: string;
    closedBy: string;                 // ID de l'agent fermant
    closureReason: string;            // Raison de fermeture
    customerSatisfaction?: number;    // Note de satisfaction (1-5)
    closedAt: Date;
    totalProcessingTime: number;      // Temps total en minutes
    followUpRequired: boolean;        // Suivi requis
  };
}
```

### COMPLAINT_COMPENSATION_REQUIRED

Émis lorsqu'une compensation est requise dans le cadre d'une saga.

```typescript
interface ComplaintCompensationRequiredEvent extends DomainEvent {
  eventType: 'COMPLAINT_COMPENSATION_REQUIRED';
  aggregateType: 'Complaint';
  eventData: {
    complaintId: string;
    sagaId: string;                   // ID de la saga échouée
    reason: string;                   // Raison de la compensation
    failedStep: string;               // Étape ayant échoué
    compensationActions: CompensationAction[];
  };
}

interface CompensationAction {
  service: string;                    // Service à compenser
  action: string;                     // Action de compensation
  parameters: any;                    // Paramètres de l'action
  order: number;                      // Ordre d'exécution
}
```

## Événements de Notification

### NOTIFICATION_SENT

Émis lorsqu'une notification est envoyée avec succès.

```typescript
interface NotificationSentEvent extends DomainEvent {
  eventType: 'NOTIFICATION_SENT';
  aggregateType: 'Notification';
  eventData: {
    notificationId: string;
    complaintId: string;
    recipient: string;                // Email du destinataire
    notificationType: 'EMAIL' | 'SMS' | 'PUSH';
    subject: string;
    content: string;
    sentAt: Date;
    deliveryStatus: 'SENT' | 'DELIVERED' | 'FAILED';
  };
}
```

### NOTIFICATION_FAILED

Émis lorsqu'une notification échoue.

```typescript
interface NotificationFailedEvent extends DomainEvent {
  eventType: 'NOTIFICATION_FAILED';
  aggregateType: 'Notification';
  eventData: {
    notificationId: string;
    complaintId: string;
    recipient: string;
    notificationType: 'EMAIL' | 'SMS' | 'PUSH';
    failureReason: string;
    failedAt: Date;
    retryCount: number;
    maxRetries: number;
  };
}
```

### NOTIFICATION_COMPENSATION

Émis pour compenser une notification dans le cadre d'une saga.

```typescript
interface NotificationCompensationEvent extends DomainEvent {
  eventType: 'NOTIFICATION_COMPENSATION';
  aggregateType: 'Notification';
  eventData: {
    originalNotificationId: string;
    complaintId: string;
    compensationAction: 'CANCEL' | 'RECALL' | 'CORRECT';
    reason: string;
    compensatedAt: Date;
  };
}
```

## Événements d'Audit

### AUDIT_LOG_CREATED

Émis lorsqu'une entrée d'audit est créée.

```typescript
interface AuditLogCreatedEvent extends DomainEvent {
  eventType: 'AUDIT_LOG_CREATED';
  aggregateType: 'AuditLog';
  eventData: {
    auditId: string;
    aggregateId: string;
    aggregateType: string;
    action: string;                   // Action auditée
    userId?: string;                  // Utilisateur concerné
    changes: any;                     // Changements effectués
    timestamp: Date;
    ipAddress?: string;               // Adresse IP de l'utilisateur
    userAgent?: string;               // User agent du navigateur
  };
}
```

### AUDIT_SEARCH_PERFORMED

Émis lorsqu'une recherche d'audit est effectuée.

```typescript
interface AuditSearchPerformedEvent extends DomainEvent {
  eventType: 'AUDIT_SEARCH_PERFORMED';
  aggregateType: 'AuditSearch';
  eventData: {
    searchId: string;
    performedBy: string;              // ID de l'utilisateur
    searchCriteria: {
      aggregateId?: string;
      aggregateType?: string;
      dateFrom?: Date;
      dateTo?: Date;
      userId?: string;
    };
    resultsCount: number;
    performedAt: Date;
  };
}
```

## Événements Event Store

### EVENT_STORED

Émis lorsqu'un événement est stocké dans l'Event Store.

```typescript
interface EventStoredEvent extends DomainEvent {
  eventType: 'EVENT_STORED';
  aggregateType: 'EventStore';
  eventData: {
    storedEventId: string;
    originalEventType: string;
    streamId: string;
    version: number;
    storedAt: Date;
    size: number;                     // Taille en bytes
  };
}
```

### EVENT_REPLAY_STARTED

Émis au début d'un rejeu d'événements.

```typescript
interface EventReplayStartedEvent extends DomainEvent {
  eventType: 'EVENT_REPLAY_STARTED';
  aggregateType: 'EventReplay';
  eventData: {
    replayId: string;
    streamId: string;
    fromVersion?: number;
    toVersion?: number;
    startedBy: string;
    startedAt: Date;
    estimatedEventCount: number;
  };
}
```

### EVENT_REPLAY_COMPLETED

Émis à la fin d'un rejeu d'événements.

```typescript
interface EventReplayCompletedEvent extends DomainEvent {
  eventType: 'EVENT_REPLAY_COMPLETED';
  aggregateType: 'EventReplay';
  eventData: {
    replayId: string;
    streamId: string;
    eventsReplayed: number;
    completedAt: Date;
    duration: number;                 // Durée en millisecondes
    success: boolean;
    errors?: string[];
  };
}
```

## Événements de Saga

### SAGA_STARTED

Émis au début d'une saga.

```typescript
interface SagaStartedEvent extends DomainEvent {
  eventType: 'SAGA_STARTED';
  aggregateType: 'Saga';
  eventData: {
    sagaId: string;
    sagaType: string;                 // Type de saga
    initiatingEvent: string;          // Événement déclencheur
    startedAt: Date;
    expectedSteps: string[];          // Étapes prévues
  };
}
```

### SAGA_STEP_COMPLETED

Émis lorsqu'une étape de saga est complétée.

```typescript
interface SagaStepCompletedEvent extends DomainEvent {
  eventType: 'SAGA_STEP_COMPLETED';
  aggregateType: 'Saga';
  eventData: {
    sagaId: string;
    stepName: string;
    completedAt: Date;
    stepResult: any;
    nextStep?: string;
  };
}
```

### SAGA_COMPLETED

Émis lorsqu'une saga se termine avec succès.

```typescript
interface SagaCompletedEvent extends DomainEvent {
  eventType: 'SAGA_COMPLETED';
  aggregateType: 'Saga';
  eventData: {
    sagaId: string;
    sagaType: string;
    completedAt: Date;
    duration: number;                 // Durée totale en millisecondes
    stepsCompleted: string[];
    finalResult: any;
  };
}
```

### SAGA_FAILED

Émis lorsqu'une saga échoue.

```typescript
interface SagaFailedEvent extends DomainEvent {
  eventType: 'SAGA_FAILED';
  aggregateType: 'Saga';
  eventData: {
    sagaId: string;
    sagaType: string;
    failedAt: Date;
    failedStep: string;
    failureReason: string;
    compensationRequired: boolean;
  };
}
```

### SAGA_COMPENSATED

Émis lorsqu'une saga est compensée.

```typescript
interface SagaCompensatedEvent extends DomainEvent {
  eventType: 'SAGA_COMPENSATED';
  aggregateType: 'Saga';
  eventData: {
    sagaId: string;
    compensatedAt: Date;
    compensationSteps: string[];
    compensationResult: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  };
}
```

## Métadonnées et Corrélation

### Structure des Métadonnées

```typescript
interface EventMetadata {
  timestamp: Date;                    // Horodatage UTC
  version: number;                    // Version du schéma (commence à 1)
  correlationId: string;              // ID de corrélation unique
  causationId?: string;               // ID de l'événement causant
  userId?: string;                    // Utilisateur à l'origine
  sagaId?: string;                    // ID de saga si applicable
  source: string;                     // Service émetteur
  traceId?: string;                   // ID de trace distribuée
  spanId?: string;                    // ID de span pour tracing
}
```

### IDs de Corrélation

**Génération des IDs :**

- `correlationId` : UUID v4 généré au début d'une requête
- `causationId` : `eventId` de l'événement déclencheur
- `sagaId` : UUID v4 généré au début d'une saga
- `traceId` : ID de trace distribuée (compatible OpenTelemetry)

**Propagation :**

```typescript
// Exemple de propagation d'IDs
const newEvent: DomainEvent = {
  eventId: generateUUID(),
  eventType: 'COMPLAINT_ASSIGNED',
  aggregateId: complaint.id,
  aggregateType: 'Complaint',
  eventData: { /* ... */ },
  metadata: {
    timestamp: new Date(),
    version: 1,
    correlationId: incomingEvent.metadata.correlationId, // Propagé
    causationId: incomingEvent.eventId,                  // Référence causale
    sagaId: incomingEvent.metadata.sagaId,               // Propagé
    source: 'complaint-service'
  }
};
```

## Validation des Schémas

### Règles de Validation

**Validation Structurelle :**

- Tous les champs obligatoires présents
- Types de données corrects
- Longueurs de chaînes respectées
- Formats de dates valides

**Validation Métier :**

- Valeurs d'énumération valides
- Contraintes de domaine respectées
- Cohérence des références

### Exemples de Validation

```typescript
// Validation avec Joi
const complaintCreatedSchema = Joi.object({
  eventId: Joi.string().uuid().required(),
  eventType: Joi.string().valid('COMPLAINT_CREATED').required(),
  aggregateId: Joi.string().required(),
  aggregateType: Joi.string().valid('Complaint').required(),
  eventData: Joi.object({
    complaintId: Joi.string().required(),
    userId: Joi.string().required(),
    title: Joi.string().max(255).required(),
    description: Joi.string().required(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
    category: Joi.string().required(),
    createdAt: Joi.date().iso().required(),
    customerInfo: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().optional()
    }).required()
  }).required(),
  metadata: Joi.object({
    timestamp: Joi.date().iso().required(),
    version: Joi.number().integer().min(1).required(),
    correlationId: Joi.string().uuid().required(),
    causationId: Joi.string().uuid().optional(),
    userId: Joi.string().optional(),
    sagaId: Joi.string().uuid().optional(),
    source: Joi.string().required()
  }).required()
});
```

## Versioning des Événements

### Stratégie de Versioning

**Versioning Sémantique :**

- **Version 1** : Version initiale
- **Version 2** : Ajout de champs optionnels
- **Version 3** : Changements breaking (nouveau type d'événement)

**Compatibilité :**

- **Backward Compatible** : Nouveaux champs optionnels
- **Forward Compatible** : Ignorer les champs inconnus
- **Breaking Changes** : Nouveau type d'événement

### Migration d'Événements

```typescript
// Exemple de migration v1 -> v2
interface ComplaintCreatedEventV1 extends DomainEvent {
  eventData: {
    complaintId: string;
    userId: string;
    title: string;
    description: string;
    priority: string;
    category: string;
    createdAt: Date;
  };
}

interface ComplaintCreatedEventV2 extends DomainEvent {
  eventData: {
    complaintId: string;
    userId: string;
    title: string;
    description: string;
    priority: string;
    category: string;
    createdAt: Date;
    customerInfo: {              // Nouveau champ v2
      name: string;
      email: string;
      phone?: string;
    };
  };
}

// Fonction de migration
function migrateComplaintCreatedV1ToV2(eventV1: ComplaintCreatedEventV1): ComplaintCreatedEventV2 {
  return {
    ...eventV1,
    metadata: {
      ...eventV1.metadata,
      version: 2
    },
    eventData: {
      ...eventV1.eventData,
      customerInfo: {
        name: 'Unknown',           // Valeur par défaut
        email: 'unknown@email.com'
      }
    }
  };
}
```

## Sérialisation et Transport

### Format JSON

Tous les événements sont sérialisés en JSON avec les conventions suivantes :

```json
{
  "eventId": "string (UUID)",
  "eventType": "string (UPPER_SNAKE_CASE)",
  "aggregateId": "string",
  "aggregateType": "string (PascalCase)",
  "eventData": {
    "field1": "value1",
    "dateField": "2024-01-15T10:30:00.000Z",
    "numberField": 123
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": 1,
    "correlationId": "string (UUID)",
    "source": "string (kebab-case)"
  }
}
```

### Headers de Message

**Headers RabbitMQ :**

```typescript
const messageHeaders = {
  'content-type': 'application/json',
  'event-type': event.eventType,
  'aggregate-type': event.aggregateType,
  'correlation-id': event.metadata.correlationId,
  'saga-id': event.metadata.sagaId,
  'source': event.metadata.source,
  'version': event.metadata.version.toString()
};
```

## Exemples Complets

### Flux Complet de Plainte

```json
[
  {
    "eventId": "evt_001",
    "eventType": "COMPLAINT_CREATED",
    "aggregateId": "complaint_123",
    "aggregateType": "Complaint",
    "eventData": {
      "complaintId": "complaint_123",
      "userId": "user_456",
      "title": "Produit défectueux",
      "description": "Le produit est arrivé cassé",
      "priority": "HIGH",
      "category": "PRODUCT_QUALITY",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "customerInfo": {
        "name": "Jean Dupont",
        "email": "jean@email.com"
      }
    },
    "metadata": {
      "timestamp": "2024-01-15T10:00:00.000Z",
      "version": 1,
      "correlationId": "corr_abc123",
      "userId": "user_456",
      "sagaId": "saga_def456",
      "source": "complaint-service"
    }
  },
  {
    "eventId": "evt_002",
    "eventType": "NOTIFICATION_SENT",
    "aggregateId": "notification_789",
    "aggregateType": "Notification",
    "eventData": {
      "notificationId": "notification_789",
      "complaintId": "complaint_123",
      "recipient": "jean@email.com",
      "notificationType": "EMAIL",
      "subject": "Votre plainte a été reçue",
      "content": "Nous avons bien reçu votre plainte...",
      "sentAt": "2024-01-15T10:01:00.000Z",
      "deliveryStatus": "SENT"
    },
    "metadata": {
      "timestamp": "2024-01-15T10:01:00.000Z",
      "version": 1,
      "correlationId": "corr_abc123",
      "causationId": "evt_001",
      "sagaId": "saga_def456",
      "source": "notification-service"
    }
  }
]
```

### Scénario de Compensation

```json
[
  {
    "eventId": "evt_003",
    "eventType": "SAGA_FAILED",
    "aggregateId": "saga_def456",
    "aggregateType": "Saga",
    "eventData": {
      "sagaId": "saga_def456",
      "sagaType": "ComplaintHandlingSaga",
      "failedAt": "2024-01-15T10:05:00.000Z",
      "failedStep": "ProcessComplaint",
      "failureReason": "External service unavailable",
      "compensationRequired": true
    },
    "metadata": {
      "timestamp": "2024-01-15T10:05:00.000Z",
      "version": 1,
      "correlationId": "corr_abc123",
      "sagaId": "saga_def456",
      "source": "complaint-service"
    }
  },
  {
    "eventId": "evt_004",
    "eventType": "COMPLAINT_COMPENSATION_REQUIRED",
    "aggregateId": "complaint_123",
    "aggregateType": "Complaint",
    "eventData": {
      "complaintId": "complaint_123",
      "sagaId": "saga_def456",
      "reason": "Processing failed - external service unavailable",
      "failedStep": "ProcessComplaint",
      "compensationActions": [
        {
          "service": "notification-service",
          "action": "SEND_FAILURE_NOTIFICATION",
          "parameters": {
            "recipient": "jean@email.com",
            "reason": "Technical issue"
          },
          "order": 1
        }
      ]
    },
    "metadata": {
      "timestamp": "2024-01-15T10:05:30.000Z",
      "version": 1,
      "correlationId": "corr_abc123",
      "causationId": "evt_003",
      "sagaId": "saga_def456",
      "source": "complaint-service"
    }
  }
]
```

---

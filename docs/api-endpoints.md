# Documentation des Endpoints API - Architecture Événementielle

## Table des Matières

- [Documentation des Endpoints API - Architecture Événementielle](#documentation-des-endpoints-api---architecture-événementielle)
  - [Table des Matières](#table-des-matières)
  - [Vue d'Ensemble](#vue-densemble)
  - [Authentification et Autorisation](#authentification-et-autorisation)
  - [Service de Plaintes (Complaint Service)](#service-de-plaintes-complaint-service)
    - [Créer une Plainte](#créer-une-plainte)
    - [Lister les Plaintes](#lister-les-plaintes)
    - [Obtenir une Plainte](#obtenir-une-plainte)
    - [Assigner une Plainte](#assigner-une-plainte)
    - [Traiter une Plainte](#traiter-une-plainte)
    - [Fermer une Plainte](#fermer-une-plainte)
    - [Obtenir les Statistiques](#obtenir-les-statistiques)
  - [Service de Notifications](#service-de-notifications)
    - [Lister les Notifications](#lister-les-notifications)
    - [Obtenir une Notification](#obtenir-une-notification)
    - [Marquer comme Lue](#marquer-comme-lue)
    - [Renvoyer une Notification](#renvoyer-une-notification)
  - [Service d'Audit](#service-daudit)
    - [Obtenir la Piste d'Audit](#obtenir-la-piste-daudit)
    - [Rechercher dans les Logs](#rechercher-dans-les-logs)
    - [Lister les Événements](#lister-les-événements)
    - [Exporter les Logs](#exporter-les-logs)
  - [Service Event Store](#service-event-store)
    - [Obtenir les Événements d'un Stream](#obtenir-les-événements-dun-stream)
    - [Lister Tous les Événements](#lister-tous-les-événements)
    - [Rejouer les Événements](#rejouer-les-événements)
    - [Obtenir l'État Reconstruit](#obtenir-létat-reconstruit)
    - [Obtenir les Statistiques du Store](#obtenir-les-statistiques-du-store)
  - [Endpoints de Monitoring](#endpoints-de-monitoring)
    - [Health Checks](#health-checks)
    - [Métriques Prometheus](#métriques-prometheus)
    - [Informations de Version](#informations-de-version)
  - [Gestion des Erreurs](#gestion-des-erreurs)
    - [Codes d'Erreur Standards](#codes-derreur-standards)
    - [Format des Réponses d'Erreur](#format-des-réponses-derreur)
  - [Pagination et Filtrage](#pagination-et-filtrage)
    - [Paramètres de Pagination](#paramètres-de-pagination)
    - [Paramètres de Filtrage](#paramètres-de-filtrage)
  - [Exemples de Requêtes](#exemples-de-requêtes)
    - [Flux Complet de Plainte](#flux-complet-de-plainte)
    - [Recherche d'Audit](#recherche-daudit)
    - [Rejeu d'Événements](#rejeu-dévénements)

## Vue d'Ensemble

Cette documentation décrit tous les endpoints API des services événementiels. Tous les endpoints sont accessibles via Kong Gateway sur le port 8000 avec le préfixe `/api`.

**Services Couverts :**

- **Complaint Service** (Port 3005) : Gestion des plaintes
- **Notification Service** (Port 3006) : Gestion des notifications
- **Audit Service** (Port 3007) : Journalisation et audit
- **Event Store Service** (Port 3008) : Stockage et rejeu d'événements

**Conventions :**

- Format de réponse : JSON
- Encodage : UTF-8
- Dates : Format ISO 8601 (UTC)
- IDs : UUID v4
- Pagination : Basée sur offset/limit

## Authentification et Autorisation

**Authentification :**

- Header requis : `X-API-Key: frontend-app-key-12345`
- Token JWT pour les opérations utilisateur : `Authorization: Bearer <token>`

**Rôles :**

- **CLIENT** : Peut créer et consulter ses propres plaintes
- **AGENT** : Peut traiter et assigner les plaintes
- **ADMIN** : Accès complet à tous les endpoints

## Service de Plaintes (Complaint Service)

Base URL : `http://localhost:8000/api/complaints`

### Créer une Plainte

```http
POST /api/complaints
```

**Headers :**

```
Content-Type: application/json
X-API-Key: frontend-app-key-12345
Authorization: Bearer <jwt_token>
```

**Body :**

```json
{
  "title": "Produit défectueux reçu",
  "description": "Le produit commandé est arrivé endommagé lors de la livraison. L'emballage était intact mais le produit à l'intérieur était cassé.",
  "priority": "HIGH",
  "category": "PRODUCT_QUALITY",
  "customerInfo": {
    "name": "Jean Dupont",
    "email": "jean.dupont@email.com",
    "phone": "+33123456789"
  }
}
```

**Réponse (201 Created) :**

```json
{
  "success": true,
  "data": {
    "id": "complaint_123e4567-e89b-12d3-a456-426614174000",
    "userId": "user_789",
    "title": "Produit défectueux reçu",
    "description": "Le produit commandé est arrivé endommagé...",
    "status": "OPEN",
    "priority": "HIGH",
    "category": "PRODUCT_QUALITY",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "customerInfo": {
      "name": "Jean Dupont",
      "email": "jean.dupont@email.com",
      "phone": "+33123456789"
    }
  },
  "metadata": {
    "correlationId": "corr_abc123",
    "sagaId": "saga_def456"
  }
}
```

### Lister les Plaintes

```http
GET /api/complaints
```

**Paramètres de Requête :**

```
?page=1&limit=20&status=OPEN&priority=HIGH&category=PRODUCT_QUALITY&userId=user_123&sortBy=createdAt&sortOrder=desc
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "complaints": [
      {
        "id": "complaint_123",
        "userId": "user_789",
        "title": "Produit défectueux reçu",
        "description": "Le produit commandé est arrivé endommagé...",
        "status": "OPEN",
        "priority": "HIGH",
        "category": "PRODUCT_QUALITY",
        "assignedTo": null,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Obtenir une Plainte

```http
GET /api/complaints/{id}
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "id": "complaint_123",
    "userId": "user_789",
    "title": "Produit défectueux reçu",
    "description": "Le produit commandé est arrivé endommagé...",
    "status": "ASSIGNED",
    "priority": "HIGH",
    "category": "PRODUCT_QUALITY",
    "assignedTo": "agent_456",
    "resolution": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:15:00.000Z",
    "closedAt": null,
    "customerInfo": {
      "name": "Jean Dupont",
      "email": "jean.dupont@email.com",
      "phone": "+33123456789"
    },
    "timeline": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "action": "CREATED",
        "actor": "user_789",
        "details": "Plainte créée par le client"
      },
      {
        "timestamp": "2024-01-15T11:15:00.000Z",
        "action": "ASSIGNED",
        "actor": "admin_123",
        "details": "Assignée à l'agent agent_456"
      }
    ],
    "notifications": [
      {
        "id": "notif_001",
        "type": "EMAIL",
        "recipient": "jean.dupont@email.com",
        "subject": "Votre plainte a été reçue",
        "sentAt": "2024-01-15T10:31:00.000Z",
        "status": "DELIVERED"
      }
    ]
  }
}
```

### Assigner une Plainte

```http
PUT /api/complaints/{id}/assign
```

**Body :**

```json
{
  "assignedTo": "agent_456",
  "assignmentReason": "Expertise en qualité produit"
}
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "id": "complaint_123",
    "status": "ASSIGNED",
    "assignedTo": "agent_456",
    "updatedAt": "2024-01-15T11:15:00.000Z"
  },
  "metadata": {
    "eventId": "evt_assign_001",
    "correlationId": "corr_abc123"
  }
}
```

### Traiter une Plainte

```http
PUT /api/complaints/{id}/process
```

**Body :**

```json
{
  "resolution": "Produit remplacé et livraison gratuite offerte pour compenser le désagrément",
  "resolutionType": "RESOLVED",
  "attachments": [
    "https://storage.example.com/resolution-proof-123.pdf"
  ]
}
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "id": "complaint_123",
    "status": "IN_PROGRESS",
    "resolution": "Produit remplacé et livraison gratuite offerte...",
    "processedBy": "agent_456",
    "processedAt": "2024-01-15T14:30:00.000Z",
    "updatedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

### Fermer une Plainte

```http
PUT /api/complaints/{id}/close
```

**Body :**

```json
{
  "closureReason": "Résolution satisfaisante - client satisfait",
  "customerSatisfaction": 5,
  "followUpRequired": false
}
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "id": "complaint_123",
    "status": "CLOSED",
    "closureReason": "Résolution satisfaisante - client satisfait",
    "customerSatisfaction": 5,
    "closedBy": "agent_456",
    "closedAt": "2024-01-15T16:00:00.000Z",
    "totalProcessingTime": 330
  }
}
```

### Obtenir les Statistiques

```http
GET /api/complaints/statistics
```

**Paramètres :**

```
?dateFrom=2024-01-01&dateTo=2024-01-31&groupBy=status
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "totalComplaints": 156,
    "byStatus": {
      "OPEN": 23,
      "ASSIGNED": 45,
      "IN_PROGRESS": 67,
      "RESOLVED": 18,
      "CLOSED": 3
    },
    "byPriority": {
      "LOW": 34,
      "MEDIUM": 89,
      "HIGH": 28,
      "CRITICAL": 5
    },
    "averageProcessingTime": 245,
    "averageSatisfaction": 4.2,
    "period": {
      "from": "2024-01-01T00:00:00.000Z",
      "to": "2024-01-31T23:59:59.999Z"
    }
  }
}
```

## Service de Notifications

Base URL : `http://localhost:8000/api/notifications`

### Lister les Notifications

```http
GET /api/notifications
```

**Paramètres :**

```
?complaintId=complaint_123&type=EMAIL&status=SENT&page=1&limit=20
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_001",
        "complaintId": "complaint_123",
        "recipient": "jean.dupont@email.com",
        "type": "EMAIL",
        "subject": "Votre plainte a été reçue",
        "content": "Nous avons bien reçu votre plainte...",
        "status": "DELIVERED",
        "sentAt": "2024-01-15T10:31:00.000Z",
        "deliveredAt": "2024-01-15T10:31:15.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "totalPages": 1
    }
  }
}
```

### Obtenir une Notification

```http
GET /api/notifications/{id}
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "id": "notif_001",
    "complaintId": "complaint_123",
    "recipient": "jean.dupont@email.com",
    "type": "EMAIL",
    "subject": "Votre plainte a été reçue",
    "content": "Nous avons bien reçu votre plainte concernant le produit défectueux...",
    "status": "DELIVERED",
    "sentAt": "2024-01-15T10:31:00.000Z",
    "deliveredAt": "2024-01-15T10:31:15.000Z",
    "retryCount": 0,
    "lastError": null,
    "metadata": {
      "correlationId": "corr_abc123",
      "template": "complaint-created",
      "provider": "smtp"
    }
  }
}
```

### Marquer comme Lue

```http
PUT /api/notifications/{id}/read
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "id": "notif_001",
    "status": "READ",
    "readAt": "2024-01-15T12:00:00.000Z"
  }
}
```

### Renvoyer une Notification

```http
POST /api/notifications/{id}/resend
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "id": "notif_001",
    "status": "RESENT",
    "resentAt": "2024-01-15T13:00:00.000Z",
    "retryCount": 1
  }
}
```

## Service d'Audit

Base URL : `http://localhost:8000/api/audit`

### Obtenir la Piste d'Audit

```http
GET /api/audit/trail/{aggregateId}
```

**Paramètres :**

```
?aggregateType=Complaint&dateFrom=2024-01-01&dateTo=2024-01-31
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "aggregateId": "complaint_123",
    "aggregateType": "Complaint",
    "auditEntries": [
      {
        "id": "audit_001",
        "action": "CREATED",
        "userId": "user_789",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "changes": {
          "title": "Produit défectueux reçu",
          "status": "OPEN",
          "priority": "HIGH"
        },
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0..."
      },
      {
        "id": "audit_002",
        "action": "ASSIGNED",
        "userId": "admin_123",
        "timestamp": "2024-01-15T11:15:00.000Z",
        "changes": {
          "assignedTo": "agent_456",
          "status": "ASSIGNED"
        },
        "ipAddress": "192.168.1.101"
      }
    ],
    "totalEntries": 2
  }
}
```

### Rechercher dans les Logs

```http
GET /api/audit/search
```

**Paramètres :**

```
?query=COMPLAINT_CREATED&userId=user_789&dateFrom=2024-01-01&dateTo=2024-01-31&page=1&limit=50
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "audit_001",
        "aggregateId": "complaint_123",
        "aggregateType": "Complaint",
        "action": "CREATED",
        "userId": "user_789",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "correlationId": "corr_abc123"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "totalPages": 1
    },
    "searchCriteria": {
      "query": "COMPLAINT_CREATED",
      "userId": "user_789",
      "dateFrom": "2024-01-01T00:00:00.000Z",
      "dateTo": "2024-01-31T23:59:59.999Z"
    }
  }
}
```

### Lister les Événements

```http
GET /api/audit/events
```

**Paramètres :**

```
?eventType=COMPLAINT_CREATED&page=1&limit=20&sortBy=timestamp&sortOrder=desc
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "eventId": "evt_001",
        "eventType": "COMPLAINT_CREATED",
        "aggregateId": "complaint_123",
        "aggregateType": "Complaint",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "correlationId": "corr_abc123",
        "userId": "user_789"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

### Exporter les Logs

```http
GET /api/audit/export
```

**Paramètres :**

```
?format=csv&dateFrom=2024-01-01&dateTo=2024-01-31&aggregateType=Complaint
```

**Réponse (200 OK) :**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="audit-export-2024-01-15.csv"

id,aggregateId,aggregateType,action,userId,timestamp,correlationId
audit_001,complaint_123,Complaint,CREATED,user_789,2024-01-15T10:30:00.000Z,corr_abc123
audit_002,complaint_123,Complaint,ASSIGNED,admin_123,2024-01-15T11:15:00.000Z,corr_abc123
```

## Service Event Store

Base URL : `http://localhost:8000/api/events`

### Obtenir les Événements d'un Stream

```http
GET /api/events/stream/{streamId}
```

**Paramètres :**

```
?fromVersion=1&toVersion=10&limit=100
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "streamId": "complaint_123",
    "events": [
      {
        "eventId": "evt_001",
        "eventType": "COMPLAINT_CREATED",
        "aggregateId": "complaint_123",
        "aggregateType": "Complaint",
        "version": 1,
        "timestamp": "2024-01-15T10:30:00.000Z",
        "eventData": {
          "complaintId": "complaint_123",
          "userId": "user_789",
          "title": "Produit défectueux reçu"
        },
        "metadata": {
          "correlationId": "corr_abc123",
          "source": "complaint-service"
        }
      }
    ],
    "totalEvents": 5,
    "fromVersion": 1,
    "toVersion": 5
  }
}
```

### Lister Tous les Événements

```http
GET /api/events/all
```

**Paramètres :**

```
?fromTimestamp=2024-01-15T00:00:00.000Z&eventType=COMPLAINT_CREATED&page=1&limit=50
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "eventId": "evt_001",
        "eventType": "COMPLAINT_CREATED",
        "aggregateId": "complaint_123",
        "timestamp": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1247,
      "totalPages": 25
    }
  }
}
```

### Rejouer les Événements

```http
POST /api/events/replay/{streamId}
```

**Body :**

```json
{
  "fromVersion": 1,
  "toVersion": 5,
  "targetService": "complaint-service",
  "replayMode": "SEQUENTIAL"
}
```

**Réponse (202 Accepted) :**

```json
{
  "success": true,
  "data": {
    "replayId": "replay_789",
    "streamId": "complaint_123",
    "status": "STARTED",
    "estimatedEvents": 5,
    "startedAt": "2024-01-15T15:00:00.000Z"
  }
}
```

### Obtenir l'État Reconstruit

```http
GET /api/events/state/{aggregateId}
```

**Paramètres :**

```
?atVersion=3&includeMetadata=true
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "aggregateId": "complaint_123",
    "aggregateType": "Complaint",
    "currentVersion": 5,
    "reconstructedAt": "2024-01-15T15:30:00.000Z",
    "state": {
      "id": "complaint_123",
      "userId": "user_789",
      "title": "Produit défectueux reçu",
      "status": "CLOSED",
      "priority": "HIGH",
      "assignedTo": "agent_456",
      "resolution": "Produit remplacé",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "closedAt": "2024-01-15T16:00:00.000Z"
    },
    "eventsApplied": 5
  }
}
```

### Obtenir les Statistiques du Store

```http
GET /api/events/statistics
```

**Réponse (200 OK) :**

```json
{
  "success": true,
  "data": {
    "totalEvents": 12456,
    "totalStreams": 234,
    "eventsByType": {
      "COMPLAINT_CREATED": 156,
      "COMPLAINT_ASSIGNED": 134,
      "COMPLAINT_PROCESSED": 98,
      "COMPLAINT_CLOSED": 87,
      "NOTIFICATION_SENT": 445
    },
    "storageSize": "45.6 MB",
    "oldestEvent": "2024-01-01T00:00:00.000Z",
    "newestEvent": "2024-01-15T16:00:00.000Z"
  }
}
```

## Endpoints de Monitoring

### Health Checks

```http
GET /api/health
```

**Réponse (200 OK) :**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T16:00:00.000Z",
  "services": {
    "complaint-service": {
      "status": "healthy",
      "responseTime": "12ms",
      "database": "connected",
      "messaging": "connected"
    },
    "notification-service": {
      "status": "healthy",
      "responseTime": "8ms",
      "messaging": "connected",
      "smtp": "connected"
    },
    "audit-service": {
      "status": "healthy",
      "responseTime": "15ms",
      "database": "connected",
      "messaging": "connected"
    },
    "event-store-service": {
      "status": "healthy",
      "responseTime": "10ms",
      "mongodb": "connected",
      "messaging": "connected"
    }
  }
}
```

### Métriques Prometheus

```http
GET /api/metrics
```

**Réponse (200 OK) :**

```
# HELP events_published_total Total number of events published
# TYPE events_published_total counter
events_published_total{event_type="COMPLAINT_CREATED",service="complaint-service"} 156
events_published_total{event_type="COMPLAINT_ASSIGNED",service="complaint-service"} 134

# HELP event_processing_duration_seconds Duration of event processing
# TYPE event_processing_duration_seconds histogram
event_processing_duration_seconds_bucket{event_type="COMPLAINT_CREATED",service="notification-service",le="0.1"} 145
event_processing_duration_seconds_bucket{event_type="COMPLAINT_CREATED",service="notification-service",le="0.5"} 156
```

### Informations de Version

```http
GET /api/version
```

**Réponse (200 OK) :**

```json
{
  "version": "1.0.0",
  "buildDate": "2024-01-15T12:00:00.000Z",
  "gitCommit": "abc123def456",
  "environment": "production",
  "services": {
    "complaint-service": "1.0.0",
    "notification-service": "1.0.0",
    "audit-service": "1.0.0",
    "event-store-service": "1.0.0"
  }
}
```

## Gestion des Erreurs

### Codes d'Erreur Standards

| Code | Description | Exemple |
|------|-------------|---------|
| 400 | Bad Request | Données de requête invalides |
| 401 | Unauthorized | Token manquant ou invalide |
| 403 | Forbidden | Permissions insuffisantes |
| 404 | Not Found | Ressource introuvable |
| 409 | Conflict | Conflit de données |
| 422 | Unprocessable Entity | Validation métier échouée |
| 429 | Too Many Requests | Limite de taux dépassée |
| 500 | Internal Server Error | Erreur serveur interne |
| 503 | Service Unavailable | Service temporairement indisponible |

### Format des Réponses d'Erreur

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données fournies ne sont pas valides",
    "details": [
      {
        "field": "title",
        "message": "Le titre est requis"
      },
      {
        "field": "priority",
        "message": "La priorité doit être LOW, MEDIUM, HIGH ou CRITICAL"
      }
    ],
    "correlationId": "corr_abc123",
    "timestamp": "2024-01-15T16:00:00.000Z"
  }
}
```

## Pagination et Filtrage

### Paramètres de Pagination

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `page` | integer | 1 | Numéro de page (commence à 1) |
| `limit` | integer | 20 | Nombre d'éléments par page (max 100) |
| `sortBy` | string | `createdAt` | Champ de tri |
| `sortOrder` | string | `desc` | Ordre de tri (`asc` ou `desc`) |

### Paramètres de Filtrage

**Plaintes :**

- `status` : Statut de la plainte
- `priority` : Priorité de la plainte
- `category` : Catégorie de la plainte
- `userId` : ID de l'utilisateur
- `assignedTo` : ID de l'agent assigné
- `dateFrom` : Date de début (ISO 8601)
- `dateTo` : Date de fin (ISO 8601)

**Notifications :**

- `complaintId` : ID de la plainte
- `type` : Type de notification
- `status` : Statut de la notification
- `recipient` : Email du destinataire

**Audit :**

- `aggregateType` : Type d'agrégat
- `action` : Action auditée
- `userId` : ID de l'utilisateur
- `eventType` : Type d'événement

## Exemples de Requêtes

### Flux Complet de Plainte

```bash
# 1. Créer une plainte
curl -X POST http://localhost:8000/api/complaints \
  -H "Content-Type: application/json" \
  -H "X-API-Key: frontend-app-key-12345" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "title": "Produit défectueux",
    "description": "Le produit est arrivé cassé",
    "priority": "HIGH",
    "category": "PRODUCT_QUALITY",
    "customerInfo": {
      "name": "Jean Dupont",
      "email": "jean@email.com"
    }
  }'

# 2. Assigner la plainte
curl -X PUT http://localhost:8000/api/complaints/complaint_123/assign \
  -H "Content-Type: application/json" \
  -H "X-API-Key: frontend-app-key-12345" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "assignedTo": "agent_456",
    "assignmentReason": "Expertise produit"
  }'

# 3. Traiter la plainte
curl -X PUT http://localhost:8000/api/complaints/complaint_123/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: frontend-app-key-12345" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "resolution": "Produit remplacé",
    "resolutionType": "RESOLVED"
  }'

# 4. Fermer la plainte
curl -X PUT http://localhost:8000/api/complaints/complaint_123/close \
  -H "Content-Type: application/json" \
  -H "X-API-Key: frontend-app-key-12345" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "closureReason": "Client satisfait",
    "customerSatisfaction": 5
  }'
```

### Recherche d'Audit

```bash
# Rechercher les événements de création de plaintes
curl -X GET "http://localhost:8000/api/audit/search?query=COMPLAINT_CREATED&dateFrom=2024-01-01&dateTo=2024-01-31" \
  -H "X-API-Key: frontend-app-key-12345" \
  -H "Authorization: Bearer <jwt_token>"

# Obtenir la piste d'audit d'une plainte
curl -X GET http://localhost:8000/api/audit/trail/complaint_123 \
  -H "X-API-Key: frontend-app-key-12345" \
  -H "Authorization: Bearer <jwt_token>"
```

### Rejeu d'Événements

```bash
# Rejouer les événements d'un stream
curl -X POST http://localhost:8000/api/events/replay/complaint_123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: frontend-app-key-12345" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "fromVersion": 1,
    "toVersion": 5,
    "targetService": "complaint-service",
    "replayMode": "SEQUENTIAL"
  }'

# Obtenir l'état reconstruit
curl -X GET http://localhost:8000/api/events/state/complaint_123 \
  -H "X-API-Key: frontend-app-key-12345" \
  -H "Authorization: Bearer <jwt_token>"
```

---

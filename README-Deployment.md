# LOG430 Lab 7 - Architecture Complète Unifiée

## Vue d'Ensemble

Ce projet implémente une architecture microservices complète avec support événementiel intégré, incluant :

- **Architecture Microservices Traditionnelle** : Services User, Catalog, Transaction
- **Architecture Événementielle** : Services Complaint, Notification, Audit, Event Store
- **Sagas Chorégraphiées** : Coordination distribuée des transactions
- **Event Sourcing & CQRS** : Patterns avancés de gestion des données
- **Observabilité Complète** : Monitoring avec Prometheus et Grafana

## Déploiement Unifié

### Démarrage Rapide (Recommandé)

```bash
cd src/scripts
.\quick-start.bat
```

Ce script unique démarre **tout le système** :

- Infrastructure (PostgreSQL, MongoDB, Redis, RabbitMQ)
- Configuration automatique des queues et exchanges
- Tous les microservices (7 services au total)
- Kong API Gateway avec routage unifié
- Monitoring (Prometheus, Grafana)
- Interface web

### Architecture Déployée

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Kong Gateway  │    │   Microservices │
│   localhost:5173│◄──►│   localhost:8000│◄──►│                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                │             ┌─────────────┐ │
                                │             │User Service │ │
                                │             │   :3001     │ │
                                │             └─────────────┘ │
                                │                        │
                                │             ┌─────────────┐ │
                                │             │Catalog Svc  │ │
                                │             │   :3002     │ │
                                │             └─────────────┘ │
                                │                        │
                                │             ┌─────────────┐ │
                                │             │Transaction  │ │
                                │             │ Service     │ │
                                │             │   :3003     │ │
                                │             └─────────────┘ │
                                │                        │
                                │             ┌─────────────┐ │
                                │             │Complaint    │ │
                                │             │ Service     │ │
                                │             │   :3005     │ │
                                │             └─────────────┘ │
                                │                        │
                                │             ┌─────────────┐ │
                                │             │Notification │ │
                                │             │ Service     │ │
                                │             │   :3006     │ │
                                │             └─────────────┘ │
                                │                        │
                                │             ┌─────────────┐ │
                                │             │Audit Service│ │
                                │             │   :3007     │ │
                                │             └─────────────┘ │
                                │                        │
                                │             ┌─────────────┐ │
                                │             │Event Store  │ │
                                │             │ Service     │ │
                                │             │   :3008     │ │
                                │             └─────────────┘ │
                                │                        │
                                ▼                        ▼
                        ┌─────────────────┐    ┌─────────────────┐
                        │ Infrastructure  │    │   Monitoring    │
                        │                 │    │                 │
                        │ ┌─────────────┐ │    │ ┌─────────────┐ │
                        │ │PostgreSQL 15│ │    │ │ Prometheus  │ │
                        │ │  (Shared)   │ │    │ │   :9090     │ │
                        │ └─────────────┘ │    │ └─────────────┘ │
                        │                 │    │                 │
                        │ ┌─────────────┐ │    │ ┌─────────────┐ │
                        │ │  MongoDB    │ │    │ │  Grafana    │ │
                        │ │ (EventStore)│ │    │ │   :3004     │ │
                        │ └─────────────┘ │    │ └─────────────┘ │
                        │                 │    │                 │
                        │ ┌─────────────┐ │    │ ┌─────────────┐ │
                        │ │  Redis 7    │ │    │ │  RabbitMQ   │ │
                        │ │  (Cache)    │ │    │ │Management UI│ │
                        │ └─────────────┘ │    │ │   :15672    │ │
                        │                 │    │ └─────────────┘ │
                        └─────────────────┘    └─────────────────┘
```

## Points d'Accès

### Applications

- **Interface Web** : <http://localhost:5173>
- **API Gateway** : <http://localhost:8000>

### Monitoring

- **Grafana** : <http://localhost:3004> (admin/admin)
- **Prometheus** : <http://localhost:9090>
- **RabbitMQ Management** : <http://localhost:15672> (admin/admin123)

### Services Directs (pour développement)

- **User Service** : <http://localhost:3001>
- **Catalog Service** : <http://localhost:3002>
- **Transaction Service** : <http://localhost:3003>
- **Complaint Service** : <http://localhost:3005>
- **Notification Service** : <http://localhost:3006>
- **Audit Service** : <http://localhost:3007>
- **Event Store Service** : <http://localhost:3008>

## Fonctionnalités Intégrées

### 1. Microservices Traditionnels

- Gestion des utilisateurs et authentification
- Catalogue de produits et inventaire
- Transactions et ventes

### 2. Architecture Événementielle

- Gestion des plaintes avec workflow complet
- Notifications automatiques par email
- Audit trail complet de toutes les actions
- Event Store pour rejeu et reconstruction d'état

### 3. Patterns Avancés

- **CQRS** : Séparation lecture/écriture
- **Event Sourcing** : Persistance par événements
- **Sagas Chorégraphiées** : Coordination distribuée
- **Compensation** : Gestion des échecs avec rollback

## Tests et Validation

### Validation du Déploiement

```bash
cd src/scripts
.\validate-deployment.bat
```

### Tests des Fonctionnalités Événementielles

```bash
# Test de scénario de succès
.\simulate-success-scenario.bat

# Test de scénario d'échec avec compensation
.\simulate-saga-failure.bat
```

## Configuration Unifiée

### Docker Compose

Tout est configuré dans un seul fichier `src/docker-compose.yml` :

- Infrastructure partagée
- Tous les microservices
- Configuration réseau unifiée
- Volumes persistants
- Health checks

### Kong Gateway

Configuration unifiée dans `src/api-gateway/kong/kong.yml` :

- Routage pour tous les services
- Authentification par API key
- Rate limiting global
- CORS configuré
- Métriques Prometheus

### Variables d'Environnement

Configuration cohérente pour tous les services :

```bash
# Base de données partagée
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/log430_store

# Cache partagé
REDIS_HOST=redis
REDIS_PORT=6379

# Messagerie (services événementiels)
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672

# Event Store (MongoDB)
MONGODB_URL=mongodb://admin:admin123@mongodb:27017/eventstore?authSource=admin
```

## Avantages de l'Architecture Unifiée

### 1. Simplicité de Déploiement

- Un seul script pour tout démarrer
- Configuration centralisée
- Gestion des dépendances automatique

### 2. Cohérence Architecturale

- Patterns partagés entre services
- Infrastructure commune
- Monitoring unifié

### 3. Évolutivité

- Ajout facile de nouveaux services
- Scaling indépendant par service
- Configuration flexible

### 4. Observabilité

- Métriques centralisées
- Logs corrélés
- Tracing distribué

## Dépannage

### Services Non Accessibles

```bash
# Vérifier l'état des conteneurs
docker-compose ps

# Vérifier les logs
docker-compose logs [service-name]

# Redémarrer un service spécifique
docker-compose restart [service-name]
```

### Problèmes de Messagerie

```bash
# Vérifier RabbitMQ
curl -u admin:admin123 http://localhost:15672/api/overview

# Reconfigurer les queues
docker-compose run --rm --profile setup rabbitmq-setup
```

### Reset Complet

```bash
# Arrêter et nettoyer tout
docker-compose down -v
docker system prune -f

# Redémarrer
.\quick-start.bat
```

## Documentation Complète

- **[Architecture Événementielle](docs/event-driven-architecture-README.md)** - Guide détaillé
- **[API Endpoints](docs/api-endpoints.md)** - Documentation des APIs
- **[Schémas d'Événements](docs/event-schemas.md)** - Définition des événements
- **[ADRs](docs/adr/)** - Décisions architecturales

## Crédentials de Démonstration

- **Admin** : admin / admin123
- **Client** : client / client123
- **RabbitMQ** : admin / admin123
- **Grafana** : admin / admin

---

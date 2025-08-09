# ADR-009: Infrastructure de Messagerie RabbitMQ

## Statut

Accepté

## Contexte

Dans le cadre de l'implémentation de l'architecture événementielle (ADR-008), nous devons choisir et configurer une infrastructure de messagerie robuste pour supporter la communication asynchrone entre microservices, la publication/souscription d'événements, et la coordination des sagas chorégraphiées.

### Exigences Techniques

1. **Fiabilité** : Garantie de livraison des messages critiques
2. **Performance** : Support de milliers de messages par seconde
3. **Durabilité** : Persistance des messages en cas de panne
4. **Scalabilité** : Capacité de montée en charge horizontale
5. **Gestion d'Erreurs** : Dead Letter Queues et mécanismes de retry
6. **Monitoring** : Observabilité complète du système de messagerie
7. **Facilité d'Opération** : Interface de gestion et outils de debugging

### Contraintes

- Intégration avec l'infrastructure Docker existante
- Compatibilité avec les services Node.js/TypeScript
- Budget et ressources d'exploitation limitées
- Équipe familière avec les technologies standard

## Décision

Nous adoptons **RabbitMQ 3.x** comme infrastructure de messagerie principale avec la configuration suivante :

### Architecture de Messagerie

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Publishers    │    │    RabbitMQ     │    │   Consumers     │
│                 │    │                 │    │                 │
│ Complaint Svc   │───►│ complaints.     │───►│ Notification    │
│ Notification    │    │ events          │    │ Audit Service   │
│ Audit Service   │    │                 │    │ Event Store     │
│ Event Store     │    │ notifications.  │    │                 │
└─────────────────┘    │ events          │    └─────────────────┘
                       │                 │
                       │ audit.events    │
                       │                 │
                       │ saga.events     │
                       └─────────────────┘
```

### Configuration des Exchanges

**1. Topic Exchanges par Domaine**

```yaml
exchanges:
  complaints.events:
    type: topic
    durable: true
    routing_patterns:
      - "complaint.created"
      - "complaint.assigned"
      - "complaint.processed"
      - "complaint.closed"
      - "complaint.compensation.required"
  
  notifications.events:
    type: topic
    durable: true
    routing_patterns:
      - "notification.sent"
      - "notification.failed"
      - "notification.compensation"
  
  audit.events:
    type: topic
    durable: true
    routing_patterns:
      - "audit.log.created"
      - "audit.search.performed"
  
  saga.events:
    type: topic
    durable: true
    routing_patterns:
      - "saga.started"
      - "saga.step.completed"
      - "saga.completed"
      - "saga.failed"
      - "saga.compensated"
```

### Configuration des Queues

**2. Queues par Service et Type d'Événement**

```yaml
queues:
  # Complaint Service Queues
  complaint-service.saga-events:
    durable: true
    arguments:
      x-dead-letter-exchange: "dlx.complaints"
      x-message-ttl: 3600000  # 1 hour
      x-max-retries: 3
  
  # Notification Service Queues
  notification-service.complaint-events:
    durable: true
    arguments:
      x-dead-letter-exchange: "dlx.notifications"
      x-message-ttl: 1800000  # 30 minutes
      x-max-retries: 5
  
  # Audit Service Queues
  audit-service.all-events:
    durable: true
    arguments:
      x-dead-letter-exchange: "dlx.audit"
      x-message-ttl: 7200000  # 2 hours
  
  # Event Store Queues
  event-store.all-events:
    durable: true
    arguments:
      x-dead-letter-exchange: "dlx.eventstore"
```

### Dead Letter Queues (DLQ)

**3. Gestion des Messages Échoués**

```yaml
dead_letter_exchanges:
  dlx.complaints:
    type: direct
    queues:
      - complaints.dlq
  
  dlx.notifications:
    type: direct
    queues:
      - notifications.dlq
  
  dlx.audit:
    type: direct
    queues:
      - audit.dlq
  
  dlx.eventstore:
    type: direct
    queues:
      - eventstore.dlq
```

## Justification Technique

### Pourquoi RabbitMQ vs Alternatives

**Apache Kafka**

- ❌ Complexité opérationnelle élevée
- ❌ Overkill pour notre volume de messages
- ❌ Courbe d'apprentissage importante
- ✅ Performance très élevée (non nécessaire)

**Redis Pub/Sub**

- ❌ Pas de persistance native
- ❌ Pas de garantie de livraison
- ❌ Fonctionnalités limitées pour les patterns complexes
- ✅ Très simple à utiliser

**Amazon SQS/SNS**

- ❌ Vendor lock-in
- ❌ Coûts variables
- ❌ Latence réseau
- ✅ Gestion complète par AWS

**RabbitMQ** ✅

- ✅ Équilibre parfait complexité/fonctionnalités
- ✅ Patterns de messagerie riches (Pub/Sub, RPC, Routing)
- ✅ Garanties de livraison configurables
- ✅ Interface de gestion web intuitive
- ✅ Écosystème mature et documentation complète
- ✅ Support natif Docker
- ✅ Monitoring Prometheus intégré

### Configuration de Performance

**Connection Pooling**

```typescript
const connectionConfig = {
  hostname: 'rabbitmq',
  port: 5672,
  username: 'admin',
  password: 'admin123',
  vhost: '/',
  heartbeat: 60,
  connection_timeout: 10000,
  channel_max: 100,
  frame_max: 131072,
  locale: 'en_US'
};
```

**Publisher Confirms**

```typescript
const publisherOptions = {
  confirm: true,
  mandatory: true,
  persistent: true,
  deliveryMode: 2,
  timestamp: Date.now(),
  appId: 'complaint-service'
};
```

**Consumer Configuration**

```typescript
const consumerOptions = {
  noAck: false,
  exclusive: false,
  prefetchCount: 10,
  consumerTag: 'notification-service-v1',
  arguments: {
    'x-cancel-on-ha-failover': true
  }
};
```

## Patterns de Messagerie Implémentés

### 1. Publish/Subscribe Pattern

**Usage** : Diffusion d'événements métier à plusieurs services

```typescript
// Publisher (Complaint Service)
await channel.publish(
  'complaints.events',
  'complaint.created',
  Buffer.from(JSON.stringify(event)),
  { persistent: true, correlationId: event.metadata.correlationId }
);

// Subscribers (Notification, Audit, Event Store)
await channel.consume('notification-service.complaint-events', (msg) => {
  const event = JSON.parse(msg.content.toString());
  await handleComplaintCreated(event);
  channel.ack(msg);
});
```

### 2. Work Queue Pattern

**Usage** : Distribution de charge pour le traitement d'événements

```typescript
// Multiple workers processing from same queue
const workers = ['worker-1', 'worker-2', 'worker-3'];
workers.forEach(workerId => {
  channel.consume('heavy-processing-queue', async (msg) => {
    await processHeavyTask(JSON.parse(msg.content.toString()));
    channel.ack(msg);
  }, { consumerTag: workerId });
});
```

### 3. RPC Pattern (pour Event Store)

**Usage** : Requêtes synchrones pour reconstruction d'état

```typescript
// RPC Client
const replyQueue = await channel.assertQueue('', { exclusive: true });
const correlationId = generateUUID();

await channel.sendToQueue('event-store.rpc', 
  Buffer.from(JSON.stringify({ aggregateId: 'complaint_123' })),
  { 
    replyTo: replyQueue.queue,
    correlationId: correlationId
  }
);

// RPC Server
await channel.consume('event-store.rpc', async (msg) => {
  const request = JSON.parse(msg.content.toString());
  const state = await reconstructState(request.aggregateId);
  
  channel.sendToQueue(msg.properties.replyTo,
    Buffer.from(JSON.stringify(state)),
    { correlationId: msg.properties.correlationId }
  );
  channel.ack(msg);
});
```

## Stratégies de Résilience

### 1. Retry avec Backoff Exponentiel

```typescript
class RetryHandler {
  async handleWithRetry(message: any, handler: Function, maxRetries = 3) {
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        await handler(message);
        return;
      } catch (error) {
        attempt++;
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        
        if (attempt >= maxRetries) {
          await this.sendToDeadLetter(message, error);
          throw error;
        }
        
        await this.delay(delay);
      }
    }
  }
}
```

### 2. Circuit Breaker pour Publishers

```typescript
class CircuitBreakerPublisher {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async publish(exchange: string, routingKey: string, message: any) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > 30000) { // 30s timeout
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      await this.channel.publish(exchange, routingKey, 
        Buffer.from(JSON.stringify(message)));
      
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= 5) {
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }
}
```

### 3. Message Deduplication

```typescript
class DeduplicationHandler {
  private processedMessages = new Set<string>();
  
  async handleMessage(message: any, handler: Function) {
    const messageId = message.properties.messageId;
    
    if (this.processedMessages.has(messageId)) {
      console.log(`Duplicate message ignored: ${messageId}`);
      return;
    }
    
    await handler(message);
    this.processedMessages.add(messageId);
    
    // Cleanup old entries periodically
    if (this.processedMessages.size > 10000) {
      this.processedMessages.clear();
    }
  }
}
```

## Monitoring et Observabilité

### Métriques Prometheus

```typescript
// Métriques personnalisées
const messagePublishedCounter = new Counter({
  name: 'rabbitmq_messages_published_total',
  help: 'Total messages published',
  labelNames: ['exchange', 'routing_key', 'service']
});

const messageProcessingDuration = new Histogram({
  name: 'rabbitmq_message_processing_duration_seconds',
  help: 'Message processing duration',
  labelNames: ['queue', 'service', 'status']
});

const queueSizeGauge = new Gauge({
  name: 'rabbitmq_queue_size',
  help: 'Current queue size',
  labelNames: ['queue']
});
```

### Health Checks

```typescript
class RabbitMQHealthCheck {
  async checkHealth(): Promise<HealthStatus> {
    try {
      // Test connection
      const connection = await amqp.connect(connectionUrl);
      const channel = await connection.createChannel();
      
      // Test basic operations
      await channel.assertExchange('health-check', 'direct');
      await channel.deleteExchange('health-check');
      
      await connection.close();
      
      return {
        status: 'healthy',
        details: {
          connection: 'ok',
          operations: 'ok',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}
```

## Configuration Docker

```yaml
# docker-compose.event-driven.yml
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports:
      - "5672:5672"      # AMQP port
      - "15672:15672"    # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123
      RABBITMQ_DEFAULT_VHOST: /
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - ./rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf
      - ./rabbitmq/definitions.json:/etc/rabbitmq/definitions.json
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - event-driven-network

volumes:
  rabbitmq_data:

networks:
  event-driven-network:
    driver: bridge
```

## Sécurité

### 1. Authentification et Autorisation

```json
// rabbitmq/definitions.json
{
  "users": [
    {
      "name": "admin",
      "password_hash": "...",
      "tags": "administrator"
    },
    {
      "name": "complaint-service",
      "password_hash": "...",
      "tags": ""
    },
    {
      "name": "notification-service",
      "password_hash": "...",
      "tags": ""
    }
  ],
  "permissions": [
    {
      "user": "complaint-service",
      "vhost": "/",
      "configure": "complaints\\..*",
      "write": "complaints\\..*",
      "read": "complaints\\..*"
    }
  ]
}
```

### 2. TLS/SSL Configuration

```conf
# rabbitmq/rabbitmq.conf
listeners.ssl.default = 5671
ssl_options.cacertfile = /etc/rabbitmq/ca_certificate.pem
ssl_options.certfile   = /etc/rabbitmq/server_certificate.pem
ssl_options.keyfile    = /etc/rabbitmq/server_key.pem
ssl_options.verify     = verify_peer
ssl_options.fail_if_no_peer_cert = true
```

## Conséquences

### Avantages

1. **Fiabilité Éprouvée**
   - Garanties de livraison configurables
   - Persistance des messages critiques
   - Mécanismes de retry sophistiqués

2. **Flexibilité des Patterns**
   - Support natif Pub/Sub, Work Queues, RPC
   - Routing complexe avec topic exchanges
   - Dead Letter Queues pour gestion d'erreurs

3. **Observabilité Complète**
   - Interface de gestion web riche
   - Métriques Prometheus natives
   - Logs détaillés et debugging

4. **Écosystème Mature**
   - Clients officiels pour tous les langages
   - Documentation complète
   - Communauté active

### Inconvénients

1. **Complexité Opérationnelle**
   - Configuration initiale complexe
   - Gestion des permissions et utilisateurs
   - Monitoring de multiples composants

2. **Point de Défaillance Potentiel**
   - Bien que résilient, reste un composant central
   - Nécessite clustering pour haute disponibilité
   - Backup et recovery procedures

3. **Consommation de Ressources**
   - Mémoire pour les queues en mémoire
   - Stockage pour les messages persistants
   - CPU pour le routage des messages

## Alternatives Futures

Si les besoins évoluent, nous pourrions considérer :

1. **Migration vers Kafka** : Pour très haut débit
2. **Clustering RabbitMQ** : Pour haute disponibilité
3. **Solutions Cloud** : AWS SQS/SNS pour réduire l'opérationnel

## Références

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [AMQP 0-9-1 Protocol](https://www.rabbitmq.com/amqp-0-9-1-reference.html)
- [RabbitMQ Best Practices](https://www.rabbitmq.com/best-practices.html)
- [Monitoring RabbitMQ](https://www.rabbitmq.com/monitoring.html)

---

**Date** : 15 janvier 2024  
**Auteur** : Équipe Infrastructure  
**Réviseurs** : Équipe Architecture, DevOps  
**Statut** : Accepté et implémenté

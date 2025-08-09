@echo off
echo ========================================
echo Simulation Scénario d'Échec de Saga
echo avec Mécanismes de Compensation
echo ========================================
echo.

set API_KEY=frontend-app-key-12345
set BASE_URL=http://localhost:8000
set CORRELATION_ID=test-failure-%RANDOM%

echo Correlation ID: %CORRELATION_ID%
echo.

echo [1/5] Création d'une plainte qui va échouer...
curl -X POST %BASE_URL%/api/complaints ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: %API_KEY%" ^
  -H "X-Correlation-ID: %CORRELATION_ID%" ^
  -d "{\"title\":\"Test - Échec de Saga\",\"description\":\"Simulation d'un échec pour tester la compensation\",\"priority\":\"CRITICAL\",\"category\":\"SYSTEM_ERROR\",\"customerInfo\":{\"name\":\"Test Failure\",\"email\":\"failure@example.com\"},\"simulateFailure\":true}" ^
  -o failure_complaint_response.json

if %ERRORLEVEL% NEQ 0 (
    echo  Erreur lors de la création de la plainte (attendu pour le test)
) else (
    echo  Plainte créée, échec simulé en cours...
)

echo.
echo Attente de la propagation et de l'échec (15 secondes)...
timeout /t 15 /nobreak

echo.
echo [2/5] Simulation d'un échec de service de notification...
echo Arrêt temporaire du service de notification pour simuler l'échec...

docker-compose stop notification-service

echo ✓ Service de notification arrêté
echo.

echo [3/5] Tentative d'envoi de notification (va échouer)...
curl -X POST %BASE_URL%/api/notifications ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: %API_KEY%" ^
  -H "X-Correlation-ID: %CORRELATION_ID%" ^
  -d "{\"complaintId\":\"complaint_failure_test\",\"recipient\":\"failure@example.com\",\"type\":\"EMAIL\",\"subject\":\"Test d'échec\",\"content\":\"Ce message ne devrait pas être envoyé\"}" ^
  -o failed_notification_response.json

echo  Échec de notification simulé (attendu)
echo.

echo [4/5] Vérification des événements de compensation...
timeout /t 5 /nobreak

echo Recherche des événements de compensation dans l'audit...
curl -X GET "%BASE_URL%/api/audit/search?query=COMPENSATION&correlationId=%CORRELATION_ID%" ^
  -H "X-API-Key: %API_KEY%" ^
  -o compensation_audit_response.json

echo.
echo Recherche des événements d'échec dans l'Event Store...
curl -X GET "%BASE_URL%/api/events/all?eventType=SAGA_FAILED&correlationId=%CORRELATION_ID%" ^
  -H "X-API-Key: %API_KEY%" ^
  -o saga_failed_events.json

echo.
echo [5/5] Redémarrage du service et vérification de la récupération...
echo Redémarrage du service de notification...

docker-compose start notification-service

echo ✓ Service de notification redémarré
echo.

echo Attente de la récupération (10 secondes)...
timeout /t 10 /nobreak

echo Vérification de la santé du service...
curl -X GET http://localhost:3006/health -o notification_health.json

echo.
echo ========================================
echo Vérification des Dead Letter Queues
echo ========================================
echo.

echo Vérification des messages en Dead Letter Queue...
curl -u admin:admin123 "http://localhost:15672/api/queues/%%2F/notifications.events.dlq" ^
  -o dlq_status.json

if %ERRORLEVEL% NEQ 0 (
    echo  Impossible de vérifier les DLQ
) else (
    echo  Statut des Dead Letter Queues récupéré
)

echo.
echo ========================================
echo Simulation de Récupération Manuelle
echo ========================================
echo.

echo Tentative de rejeu des événements échoués...
curl -X POST "%BASE_URL%/api/events/replay/saga_%CORRELATION_ID%" ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: %API_KEY%" ^
  -d "{\"fromVersion\":1,\"replayMode\":\"SEQUENTIAL\",\"targetService\":\"notification-service\"}" ^
  -o replay_response.json

echo.
echo ========================================
echo Résultats de la Simulation d'Échec
echo ========================================
echo.

echo Fichiers générés:
echo - failure_complaint_response.json
echo - failed_notification_response.json
echo - compensation_audit_response.json
echo - saga_failed_events.json
echo - notification_health.json
echo - dlq_status.json
echo - replay_response.json
echo.

echo Vérifications recommandées:
echo.
echo 1. RabbitMQ Management - Dead Letter Queues:
echo    http://localhost:15672/#/queues/%%2F/notifications.events.dlq
echo.
echo 2. Grafana - Métriques d'échec:
echo    http://localhost:3004/d/saga-monitoring
echo.
echo 3. Logs des services:
echo    docker-compose logs notification-service
echo    docker-compose logs complaint-service
echo.
echo 4. Métriques Prometheus:
echo    curl "http://localhost:9090/api/v1/query?query=saga_failed_total"
echo    curl "http://localhost:9090/api/v1/query?query=events_failed_total"
echo.

echo Commandes de diagnostic:
echo.
echo # Vérifier les messages en DLQ
echo curl -u admin:admin123 http://localhost:15672/api/queues/%%2F/notifications.events.dlq/get ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"count\":10,\"ackmode\":\"ack_requeue_false\",\"encoding\":\"auto\"}"
echo.
echo # Vérifier l'état des sagas
echo curl "%BASE_URL%/api/events/all?eventType=SAGA_*&correlationId=%CORRELATION_ID%" ^
echo   -H "X-API-Key: %API_KEY%"
echo.
echo # Forcer la compensation manuelle
echo curl -X POST "%BASE_URL%/api/complaints/compensate" ^
echo   -H "Content-Type: application/json" ^
echo   -H "X-API-Key: %API_KEY%" ^
echo   -d "{\"sagaId\":\"saga_%CORRELATION_ID%\",\"reason\":\"Manual compensation test\"}"
echo.

echo ========================================
echo Simulation d'échec terminée
echo Correlation ID: %CORRELATION_ID%
echo ========================================
echo.
echo Note: Cette simulation démontre:
echo - Gestion des échecs de service
echo - Mécanismes de Dead Letter Queue
echo - Événements de compensation
echo - Récupération automatique
echo - Rejeu d'événements
echo.
pause
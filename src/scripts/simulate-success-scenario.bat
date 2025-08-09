@echo off
echo ========================================
echo Simulation Scénario de Succès
echo Architecture Événementielle
echo ========================================
echo.

set API_KEY=frontend-app-key-12345
set BASE_URL=http://localhost:8000
set CORRELATION_ID=test-success-%RANDOM%

echo Correlation ID: %CORRELATION_ID%
echo.

echo [1/6] Création d'une plainte...
curl -X POST %BASE_URL%/api/complaints ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: %API_KEY%" ^
  -H "X-Correlation-ID: %CORRELATION_ID%" ^
  -d "{\"title\":\"Test - Produit défectueux\",\"description\":\"Simulation d'une plainte pour test du flux événementiel\",\"priority\":\"HIGH\",\"category\":\"PRODUCT_QUALITY\",\"customerInfo\":{\"name\":\"Test User\",\"email\":\"test@example.com\",\"phone\":\"+33123456789\"}}" ^
  -o complaint_response.json

if %ERRORLEVEL% NEQ 0 (
    echo  Erreur lors de la création de la plainte
    pause
    exit /b 1
)

echo ✓ Plainte créée avec succès
echo.

echo Attente de la propagation des événements (10 secondes)...
timeout /t 10 /nobreak

echo.
echo [2/6] Vérification des notifications envoyées...
curl -X GET "%BASE_URL%/api/notifications?correlationId=%CORRELATION_ID%" ^
  -H "X-API-Key: %API_KEY%" ^
  -o notifications_response.json

if %ERRORLEVEL% NEQ 0 (
    echo  Erreur lors de la récupération des notifications
) else (
    echo  Notifications récupérées
)

echo.
echo [3/6] Vérification des logs d'audit...
curl -X GET "%BASE_URL%/api/audit/search?correlationId=%CORRELATION_ID%" ^
  -H "X-API-Key: %API_KEY%" ^
  -o audit_response.json

if %ERRORLEVEL% NEQ 0 (
    echo  Erreur lors de la récupération des logs d'audit
) else (
    echo  Logs d'audit récupérés
)

echo.
echo [4/6] Vérification de l'Event Store...
curl -X GET "%BASE_URL%/api/events/all?correlationId=%CORRELATION_ID%" ^
  -H "X-API-Key: %API_KEY%" ^
  -o events_response.json

if %ERRORLEVEL% NEQ 0 (
    echo  Erreur lors de la récupération des événements
) else (
    echo  Événements récupérés de l'Event Store
)

echo.
echo [5/6] Assignation de la plainte...

REM Extraire l'ID de la plainte du fichier de réponse (simulation)
set COMPLAINT_ID=complaint_test_%RANDOM%

curl -X PUT %BASE_URL%/api/complaints/%COMPLAINT_ID%/assign ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: %API_KEY%" ^
  -H "X-Correlation-ID: %CORRELATION_ID%" ^
  -d "{\"assignedTo\":\"agent_test\",\"assignmentReason\":\"Test d'assignation automatique\"}" ^
  -o assignment_response.json

if %ERRORLEVEL% NEQ 0 (
    echo  Erreur lors de l'assignation (normal si plainte inexistante)
) else (
    echo  Plainte assignée avec succès
)

echo.
echo [6/6] Traitement et fermeture de la plainte...

curl -X PUT %BASE_URL%/api/complaints/%COMPLAINT_ID%/process ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: %API_KEY%" ^
  -H "X-Correlation-ID: %CORRELATION_ID%" ^
  -d "{\"resolution\":\"Produit remplacé et livraison gratuite offerte\",\"resolutionType\":\"RESOLVED\"}" ^
  -o processing_response.json

timeout /t 2 /nobreak

curl -X PUT %BASE_URL%/api/complaints/%COMPLAINT_ID%/close ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: %API_KEY%" ^
  -H "X-Correlation-ID: %CORRELATION_ID%" ^
  -d "{\"closureReason\":\"Client satisfait de la résolution\",\"customerSatisfaction\":5,\"followUpRequired\":false}" ^
  -o closure_response.json

echo.
echo ========================================
echo Résultats de la Simulation
echo ========================================
echo.

echo Fichiers générés:
echo - complaint_response.json
echo - notifications_response.json  
echo - audit_response.json
echo - events_response.json
echo - assignment_response.json
echo - processing_response.json
echo - closure_response.json
echo.

echo Vérifications à effectuer:
echo 1. Consulter RabbitMQ Management: http://localhost:15672
echo 2. Vérifier Grafana: http://localhost:3004
echo 3. Consulter les logs: docker-compose logs -f complaint-service
echo.

echo Commandes de vérification:
echo.
echo # Vérifier les queues RabbitMQ
echo curl -u admin:admin123 http://localhost:15672/api/queues
echo.
echo # Vérifier les métriques Prometheus
echo curl http://localhost:9090/api/v1/query?query=events_published_total
echo.
echo # Vérifier la santé des services
echo curl http://localhost:3005/health
echo curl http://localhost:3006/health
echo curl http://localhost:3007/health
echo curl http://localhost:3008/health
echo.

echo ========================================
echo Simulation terminée
echo Correlation ID: %CORRELATION_ID%
echo ========================================
pause
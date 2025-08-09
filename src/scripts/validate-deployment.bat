@echo off
echo ========================================
echo Validation du Déploiement
echo Architecture Événementielle
echo ========================================
echo.

echo [1/8] Verification des conteneurs Docker...
docker-compose ps

echo.
echo [2/8] Test de santé des services événementiels...

echo Complaint Service:
curl -s http://localhost:3005/health | findstr "healthy" && echo  OK || echo  ERREUR

echo Notification Service:
curl -s http://localhost:3006/health | findstr "healthy" && echo  OK || echo  ERREUR

echo Audit Service:
curl -s http://localhost:3007/health | findstr "healthy" && echo  OK || echo  ERREUR

echo Event Store Service:
curl -s http://localhost:3008/health | findstr "healthy" && echo  OK || echo  ERREUR

echo.
echo [3/8] Verification de RabbitMQ...
curl -s -u admin:admin123 http://localhost:15672/api/overview | findstr "rabbitmq_version" && echo  RabbitMQ OK || echo  RabbitMQ ERREUR

echo.
echo [4/8] Verification de MongoDB...
docker exec mongodb mongosh --eval "db.adminCommand('ping')" --quiet && echo  MongoDB OK || echo  MongoDB ERREUR

echo.
echo [5/8] Test des endpoints API...

echo Test création de plainte:
curl -s -X POST http://localhost:8000/api/complaints ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: frontend-app-key-12345" ^
  -d "{\"title\":\"Test Validation\",\"description\":\"Test de validation du déploiement\",\"priority\":\"LOW\",\"category\":\"TEST\"}" ^
  | findstr "success" && echo ✓ API Plaintes OK || echo  API Plaintes ERREUR

echo.
echo [6/8] Verification des queues RabbitMQ...
curl -s -u admin:admin123 http://localhost:15672/api/queues | findstr "complaint-service.queue" && echo  Queues configurées || echo  Queues manquantes

echo.
echo [7/8] Test des métriques Prometheus...
curl -s http://localhost:9090/api/v1/query?query=up | findstr "success" && echo  Prometheus OK || echo  Prometheus ERREUR

echo.
echo [8/8] Verification de Grafana...
curl -s http://localhost:3004/api/health | findstr "ok" && echo  Grafana OK || echo  Grafana ERREUR

echo.
echo ========================================
echo Résumé de la Validation
echo ========================================
echo.
echo Points d'accès validés:
echo - Services événementiels: Ports 3005-3008
echo - RabbitMQ Management: http://localhost:15672
echo - MongoDB: Port 27017
echo - Prometheus: http://localhost:9090
echo - Grafana: http://localhost:3004
echo.
echo Pour des tests approfondis, exécutez:
echo .\simulate-success-scenario.bat
echo .\simulate-saga-failure.bat
echo.
pause
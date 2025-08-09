#!/usr/bin/env node

const http = require('http');

// Helper function to trigger metrics by calling service endpoints
async function triggerMetrics() {
  const services = [
    { name: 'user-service', port: 3001 },
    { name: 'catalog-service', port: 3002 },
    { name: 'transaction-service', port: 3003 },
    { name: 'saga-orchestrator-service', port: 3009 },
    { name: 'event-store-service', port: 3008 }
  ];

  console.log(' Triggering HTTP metrics by calling service endpoints...');

  for (let i = 0; i < 10; i++) {
    console.log(`\n--- Round ${i + 1} ---`);
    
    for (const service of services) {
      try {
        const req = http.request({
          hostname: 'localhost',
          port: service.port,
          path: '/health',
          method: 'GET'
        }, (res) => {
          console.log(` ${service.name}: ${res.statusCode}`);
        });

        req.on('error', (err) => {
          console.log(` ${service.name}: ${err.message}`);
        });

        req.end();
      } catch (error) {
        console.log(` ${service.name}: ${error.message}`);
      }
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n Checking if metrics show up in services...');
  
  for (const service of services) {
    try {
      const req = http.request({
        hostname: 'localhost',
        port: service.port,
        path: '/metrics',
        method: 'GET'
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const httpRequestsTotal = body.match(/http_requests_total\{[^}]*\}\s+(\d+)/g);
          if (httpRequestsTotal && httpRequestsTotal.length > 0) {
            console.log(` ${service.name}: Found HTTP metrics`);
            httpRequestsTotal.slice(0, 3).forEach(metric => {
              console.log(`   ${metric}`);
            });
          } else {
            console.log(` ${service.name}: No HTTP request metrics found`);
          }
        });
      });

      req.on('error', (err) => {
        console.log(` Error checking ${service.name} metrics: ${err.message}`);
      });

      req.end();
    } catch (error) {
      console.log(` Error checking ${service.name}: ${error.message}`);
    }
  }
}

triggerMetrics().catch(console.error);

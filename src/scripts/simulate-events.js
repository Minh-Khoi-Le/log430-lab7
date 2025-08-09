#!/usr/bin/env node

const http = require('http');

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Function to simulate sale transactions (which should trigger sagas)
async function simulateSaleTransaction() {
  try {
    console.log(' Simulating sale transaction...');
    
    // Create a sale through the saga orchestrator
    const saleData = {
      customerId: Math.floor(Math.random() * 100) + 1,
      products: [
        {
          productId: Math.floor(Math.random() * 50) + 1,
          quantity: Math.floor(Math.random() * 5) + 1,
          price: (Math.random() * 100 + 10).toFixed(2)
        }
      ],
      storeId: Math.floor(Math.random() * 5) + 1
    };

    const response = await makeRequest({
      hostname: 'localhost',
      port: 3009,
      path: '/api/sagas/sales',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    }, saleData);

    if (response.statusCode === 200 || response.statusCode === 201) {
      console.log(' Sale transaction initiated successfully');
      return JSON.parse(response.body);
    } else {
      console.log(` Sale transaction failed: ${response.statusCode}`);
      console.log(response.body);
    }
  } catch (error) {
    console.log(` Error simulating sale transaction: ${error.message}`);
  }
}

// Function to generate user activity
async function simulateUserActivity() {
  try {
    console.log(' Simulating user activity...');
    
    // Try to login a user
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const response = await makeRequest({
      hostname: 'localhost',
      port: 8000, // Kong API Gateway
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, loginData);

    console.log(` User login attempt: ${response.statusCode}`);
  } catch (error) {
    console.log(` Error simulating user activity: ${error.message}`);
  }
}

// Function to simulate catalog access
async function simulateCatalogActivity() {
  try {
    console.log(' Simulating catalog activity...');
    
    const response = await makeRequest({
      hostname: 'localhost',
      port: 8000, // Kong API Gateway
      path: '/api/products',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(` Catalog access: ${response.statusCode}`);
  } catch (error) {
    console.log(` Error simulating catalog activity: ${error.message}`);
  }
}

// Function to check metrics endpoint
async function checkMetrics(serviceName, port) {
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/metrics',
      method: 'GET'
    });

    if (response.statusCode === 200) {
      const metrics = response.body;
      
      // Check for event-specific metrics
      const hasEventMetrics = metrics.includes('events_published_total') || 
                             metrics.includes('events_consumed_total') ||
                             metrics.includes('saga_executions_total');
      
      const hasHttpMetrics = metrics.includes('http_requests_total');
      
      console.log(` ${serviceName} metrics:`);
      console.log(`    Event Metrics: ${hasEventMetrics ? '✅' : '❌'}`);
      console.log(`    HTTP Metrics: ${hasHttpMetrics ? '✅' : '❌'}`);
      
      if (hasEventMetrics) {
        // Extract some event metric values
        const lines = metrics.split('\n');
        lines.forEach(line => {
          if (line.includes('events_published_total') || 
              line.includes('events_consumed_total') || 
              line.includes('saga_executions_total') ||
              line.includes('active_sagas')) {
            console.log(`    ${line}`);
          }
        });
      }
    } else {
      console.log(` ${serviceName} metrics not available (${response.statusCode})`);
    }
  } catch (error) {
    console.log(` Error checking ${serviceName} metrics: ${error.message}`);
  }
}

// Main simulation function
async function runSimulation() {
  console.log(' Starting Event-Driven Architecture Metrics Simulation');
  console.log('=' .repeat(60));

  const services = [
    { name: 'User Service', port: 3001 },
    { name: 'Catalog Service', port: 3002 },
    { name: 'Transaction Service', port: 3003 },
    { name: 'Saga Orchestrator', port: 3009 },
    { name: 'Event Store Service', port: 3008 }
  ];

  // Check initial metrics
  console.log('\n Checking initial metrics...');
  for (const service of services) {
    await checkMetrics(service.name, service.port);
  }

  console.log('\n Running simulations to generate metrics...');
  
  // Run simulations multiple times to generate data
  for (let i = 0; i < 5; i++) {
    console.log(`\n--- Simulation Round ${i + 1} ---`);
    
    await simulateUserActivity();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await simulateCatalogActivity();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await simulateSaleTransaction();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n Checking metrics after simulation...');
  for (const service of services) {
    await checkMetrics(service.name, service.port);
  }

  console.log('\n Checking Prometheus targets...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 9090,
      path: '/api/v1/targets',
      method: 'GET'
    });

    if (response.statusCode === 200) {
      const targets = JSON.parse(response.body);
      console.log(' Prometheus is accessible');
      
      if (targets.data && targets.data.activeTargets) {
        const serviceTargets = targets.data.activeTargets.filter(target => 
          services.some(service => target.labels.job.includes(service.name.toLowerCase().replace(' ', '-')))
        );
        
        console.log(` Service targets configured: ${serviceTargets.length}/${services.length}`);
        
        serviceTargets.forEach(target => {
          const health = target.health === 'up' ? 'y' : 'n';
          console.log(`   ${health} ${target.labels.job}: ${target.health}`);
        });
      }
    }
  } catch (error) {
    console.log(` Error checking Prometheus: ${error.message}`);
  }

  console.log('\n Simulation complete! Check Grafana dashboard at http://localhost:3004');
  console.log('   Username: admin');
  console.log('   Password: admin');
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n Simulation interrupted');
  process.exit(0);
});

// Run the simulation
runSimulation().catch(console.error);

#!/usr/bin/env node

/**
 * Test script to verify event-driven monitoring implementation
 * This script tests metrics collection, correlation context, and structured logging
 */

const http = require('http');
const { performance } = require('perf_hooks');

// Configuration
const SERVICES = [
  { name: 'user-service', port: 3001 },
  { name: 'catalog-service', port: 3002 },
  { name: 'transaction-service', port: 3003 },
  { name: 'complaint-service', port: 3005 },
  { name: 'audit-service', port: 3007 },
  { name: 'event-store-service', port: 3008 }
];

const CORRELATION_ID = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
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

// Test health endpoints
async function testHealthEndpoints() {
  console.log('\n🏥 Testing Health Endpoints...');
  
  for (const service of SERVICES) {
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port: service.port,
        path: '/health',
        method: 'GET',
        headers: {
          'x-correlation-id': CORRELATION_ID,
          'x-user-id': 'test-user-123'
        }
      });
      
      console.log(`✅ ${service.name}: ${response.statusCode === 200 ? 'HEALTHY' : 'UNHEALTHY'}`);
      
      // Check if correlation headers are returned
      if (response.headers['x-correlation-id']) {
        console.log(`   📋 Correlation ID propagated: ${response.headers['x-correlation-id']}`);
      }
      
    } catch (error) {
      console.log(`❌ ${service.name}: ERROR - ${error.message}`);
    }
  }
}

// Test metrics endpoints
async function testMetricsEndpoints() {
  console.log('\n📊 Testing Metrics Endpoints...');
  
  for (const service of SERVICES) {
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port: service.port,
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
        const hasSystemMetrics = metrics.includes('nodejs_');
        
        console.log(`✅ ${service.name}: Metrics available`);
        console.log(`   📈 HTTP Metrics: ${hasHttpMetrics ? '✅' : '❌'}`);
        console.log(`   🖥️  System Metrics: ${hasSystemMetrics ? '✅' : '❌'}`);
        console.log(`   🔄 Event Metrics: ${hasEventMetrics ? '✅' : '❌'}`);
        
        // Count total metrics
        const metricLines = metrics.split('\n').filter(line => 
          line && !line.startsWith('#') && line.includes(' ')
        );
        console.log(`   📊 Total Metrics: ${metricLines.length}`);
        
      } else {
        console.log(`❌ ${service.name}: Metrics not available (${response.statusCode})`);
      }
      
    } catch (error) {
      console.log(`❌ ${service.name}: ERROR - ${error.message}`);
    }
  }
}

// Test correlation context propagation
async function testCorrelationPropagation() {
  console.log('\n🔗 Testing Correlation Context Propagation...');
  
  const testCorrelationId = `correlation-test-${Date.now()}`;
  const testUserId = 'test-user-456';
  const testSagaId = 'test-saga-789';
  
  // Test with user service (has correlation middleware)
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET',
      headers: {
        'x-correlation-id': testCorrelationId,
        'x-user-id': testUserId,
        'x-saga-id': testSagaId,
        'x-causation-id': 'test-causation-123'
      }
    });
    
    console.log('✅ Correlation headers sent to user-service');
    console.log(`   📋 Correlation ID returned: ${response.headers['x-correlation-id']}`);
    console.log(`   👤 User ID returned: ${response.headers['x-user-id']}`);
    console.log(`   🔄 Saga ID returned: ${response.headers['x-saga-id']}`);
    
    // Verify correlation ID matches
    if (response.headers['x-correlation-id'] === testCorrelationId) {
      console.log('✅ Correlation ID properly propagated');
    } else {
      console.log('❌ Correlation ID not properly propagated');
    }
    
  } catch (error) {
    console.log(`❌ Correlation test failed: ${error.message}`);
  }
}

// Test API endpoints with correlation
async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints with Correlation...');
  
  const testCorrelationId = `api-test-${Date.now()}`;
  
  // Test user service endpoints
  try {
    console.log('Testing user service API...');
    
    // Test user registration with correlation
    const registerResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': testCorrelationId,
        'x-user-id': 'test-user-registration'
      }
    }, {
      name: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123'
    });
    
    console.log(`   📝 Registration: ${registerResponse.statusCode}`);
    console.log(`   📋 Correlation returned: ${registerResponse.headers['x-correlation-id']}`);
    
  } catch (error) {
    console.log(`   ❌ User service API test failed: ${error.message}`);
  }
  
  // Test complaint service endpoints (if available)
  try {
    console.log('Testing complaint service API...');
    
    const complaintsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3005,
      path: '/api/complaints',
      method: 'GET',
      headers: {
        'x-correlation-id': testCorrelationId,
        'x-user-id': 'test-user-complaints'
      }
    });
    
    console.log(`   📋 Complaints list: ${complaintsResponse.statusCode}`);
    console.log(`   📋 Correlation returned: ${complaintsResponse.headers['x-correlation-id']}`);
    
  } catch (error) {
    console.log(`   ❌ Complaint service API test failed: ${error.message}`);
  }
}

// Test Prometheus metrics collection
async function testPrometheusIntegration() {
  console.log('\n🎯 Testing Prometheus Integration...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 9090,
      path: '/api/v1/targets',
      method: 'GET'
    });
    
    if (response.statusCode === 200) {
      const targets = JSON.parse(response.body);
      console.log('✅ Prometheus is accessible');
      
      if (targets.data && targets.data.activeTargets) {
        const serviceTargets = targets.data.activeTargets.filter(target => 
          SERVICES.some(service => target.labels.job === service.name)
        );
        
        console.log(`   🎯 Service targets configured: ${serviceTargets.length}/${SERVICES.length}`);
        
        serviceTargets.forEach(target => {
          const health = target.health === 'up' ? '✅' : '❌';
          console.log(`   ${health} ${target.labels.job}: ${target.health}`);
        });
      }
    } else {
      console.log(`❌ Prometheus not accessible (${response.statusCode})`);
    }
    
  } catch (error) {
    console.log(`❌ Prometheus test failed: ${error.message}`);
  }
}

// Test Grafana dashboards
async function testGrafanaDashboards() {
  console.log('\n📈 Testing Grafana Integration...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3004,
      path: '/api/health',
      method: 'GET'
    });
    
    if (response.statusCode === 200) {
      console.log('✅ Grafana is accessible');
      
      // Test dashboard API
      try {
        const dashboardResponse = await makeRequest({
          hostname: 'localhost',
          port: 3004,
          path: '/api/search?query=event-driven',
          method: 'GET',
          headers: {
            'Authorization': 'Basic YWRtaW46YWRtaW4=' // admin:admin
          }
        });
        
        if (dashboardResponse.statusCode === 200) {
          const dashboards = JSON.parse(dashboardResponse.body);
          console.log(`   📊 Event-driven dashboards found: ${dashboards.length}`);
          
          dashboards.forEach(dashboard => {
            console.log(`   📈 ${dashboard.title} (${dashboard.uid})`);
          });
        }
        
      } catch (error) {
        console.log(`   ⚠️  Dashboard API test failed: ${error.message}`);
      }
      
    } else {
      console.log(`❌ Grafana not accessible (${response.statusCode})`);
    }
    
  } catch (error) {
    console.log(`❌ Grafana test failed: ${error.message}`);
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Event-Driven Monitoring Tests');
  console.log(`📋 Test Correlation ID: ${CORRELATION_ID}`);
  console.log('=' .repeat(60));
  
  const startTime = performance.now();
  
  try {
    await testHealthEndpoints();
    await testMetricsEndpoints();
    await testCorrelationPropagation();
    await testAPIEndpoints();
    await testPrometheusIntegration();
    await testGrafanaDashboards();
    
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '=' .repeat(60));
    console.log(`✅ All tests completed in ${duration}s`);
    console.log('\n📊 Next Steps:');
    console.log('1. Check Grafana dashboards at http://localhost:3004');
    console.log('2. View Prometheus targets at http://localhost:9090/targets');
    console.log('3. Monitor service logs for structured logging with correlation IDs');
    console.log('4. Generate some API traffic to see metrics in action');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testHealthEndpoints,
  testMetricsEndpoints,
  testCorrelationPropagation
};
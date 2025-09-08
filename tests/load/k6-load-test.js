import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTrend = new Trend('response_time');
const requestCounter = new Counter('requests_total');

// Test configuration
export const options = {
  stages: [
    // Ramp-up
    { duration: '2m', target: 10 },
    { duration: '5m', target: 50 },
    { duration: '10m', target: 100 },
    
    // Sustained load
    { duration: '15m', target: 100 },
    
    // Peak load
    { duration: '5m', target: 200 },
    { duration: '10m', target: 200 },
    
    // Ramp-down
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // 95% of requests must complete below 2s
    'http_req_failed': ['rate<0.05'],    // Error rate must be below 5%
    'errors': ['rate<0.1'],              // Custom error rate below 10%
  },
  
  // Test data
  setupTimeout: '30s',
  teardownTimeout: '30s',
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_TOKEN = __ENV.API_TOKEN || 'test-token';

// Test data
const testPrompts = [
  'Create a new agent for sentiment analysis',
  'Generate a report on system performance',
  'Analyze the following text for emotional content',
  'Create an ensemble of agents for multi-task processing',
  'Verify the integrity of agent fingerprints',
  'Process natural language query about user behavior',
  'Generate meta-prompts for code generation',
  'Validate the trust score of system agents',
  'Create a specialized agent for data analysis',
  'Process complex multi-step reasoning task'
];

const agentTypes = ['nlp', 'analysis', 'generation', 'classification'];
const capabilities = [
  ['sentiment_analysis', 'text_classification'],
  ['data_analysis', 'pattern_recognition'],
  ['code_generation', 'documentation'],
  ['image_processing', 'computer_vision']
];

// Setup function
export function setup() {
  console.log('Starting load test setup...');
  
  // Health check
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    throw new Error('Health check failed');
  }
  
  console.log('Setup completed successfully');
  return { baseUrl: BASE_URL, token: API_TOKEN };
}

// Main test function
export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };
  
  // Weighted test scenarios
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40% - NLP Processing requests
    testNLPProcessing(data, headers);
  } else if (scenario < 0.6) {
    // 20% - Agent management operations
    testAgentOperations(data, headers);
  } else if (scenario < 0.8) {
    // 20% - Metrics and dashboard requests
    testMetricsRequests(data, headers);
  } else {
    // 20% - QLAFS verification operations
    testQLAFSOperations(data, headers);
  }
  
  // Random think time between requests
  sleep(Math.random() * 3 + 1);
}

function testNLPProcessing(data, headers) {
  const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
  
  const payload = {
    text: prompt,
    user_id: `load_test_user_${__VU}`,
    session_id: `session_${__VU}_${__ITER}`,
    options: {
      temperature: Math.random() * 0.5 + 0.5,
      max_tokens: Math.floor(Math.random() * 500) + 100,
    }
  };
  
  const response = http.post(
    `${data.baseUrl}/api/v1/process`,
    JSON.stringify(payload),
    { headers }
  );
  
  const success = check(response, {
    'NLP processing status is 200': (r) => r.status === 200,
    'NLP processing has valid response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.intent && body.confidence !== undefined;
      } catch {
        return false;
      }
    },
    'NLP processing response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  requestCounter.add(1, { endpoint: 'nlp_process' });
  responseTrend.add(response.timings.duration, { endpoint: 'nlp_process' });
  errorRate.add(!success);
}

function testAgentOperations(data, headers) {
  const operation = Math.random();
  
  if (operation < 0.3) {
    // Create agent
    const agentType = agentTypes[Math.floor(Math.random() * agentTypes.length)];
    const capabilitySet = capabilities[Math.floor(Math.random() * capabilities.length)];
    
    const payload = {
      name: `Load Test Agent ${__VU}_${__ITER}`,
      description: `Generated agent for load testing - VU ${__VU}`,
      type: agentType,
      capabilities: capabilitySet,
      configuration: {
        model: 'azure-gpt-4',
        temperature: Math.random() * 0.8 + 0.2,
        max_tokens: Math.floor(Math.random() * 1000) + 500,
      }
    };
    
    const response = http.post(
      `${data.baseUrl}/api/v1/agents`,
      JSON.stringify(payload),
      { headers }
    );
    
    const success = check(response, {
      'Create agent status is 201': (r) => r.status === 201,
      'Create agent has valid ID': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id && body.id.length > 0;
        } catch {
          return false;
        }
      },
    });
    
    requestCounter.add(1, { endpoint: 'agent_create' });
    responseTrend.add(response.timings.duration, { endpoint: 'agent_create' });
    errorRate.add(!success);
    
  } else if (operation < 0.7) {
    // List agents
    const response = http.get(`${data.baseUrl}/api/v1/agents`, { headers });
    
    const success = check(response, {
      'List agents status is 200': (r) => r.status === 200,
      'List agents has valid structure': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.agents);
        } catch {
          return false;
        }
      },
    });
    
    requestCounter.add(1, { endpoint: 'agent_list' });
    responseTrend.add(response.timings.duration, { endpoint: 'agent_list' });
    errorRate.add(!success);
    
  } else {
    // Get agent details (simulate existing agent ID)
    const agentId = `test-agent-${Math.floor(Math.random() * 100)}`;
    
    const response = http.get(`${data.baseUrl}/api/v1/agents/${agentId}`, { headers });
    
    const success = check(response, {
      'Get agent allows 200 or 404': (r) => r.status === 200 || r.status === 404,
      'Get agent response time < 2s': (r) => r.timings.duration < 2000,
    });
    
    requestCounter.add(1, { endpoint: 'agent_get' });
    responseTrend.add(response.timings.duration, { endpoint: 'agent_get' });
    errorRate.add(!success);
  }
}

function testMetricsRequests(data, headers) {
  const metricsEndpoint = Math.random();
  
  let endpoint, url;
  
  if (metricsEndpoint < 0.5) {
    endpoint = 'dashboard';
    url = `${data.baseUrl}/api/v1/metrics/dashboard`;
  } else {
    endpoint = 'models';
    url = `${data.baseUrl}/api/v1/metrics/models`;
  }
  
  const response = http.get(url, { headers });
  
  const success = check(response, {
    'Metrics status is 200': (r) => r.status === 200,
    'Metrics has valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    'Metrics response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  requestCounter.add(1, { endpoint: `metrics_${endpoint}` });
  responseTrend.add(response.timings.duration, { endpoint: `metrics_${endpoint}` });
  errorRate.add(!success);
}

function testQLAFSOperations(data, headers) {
  const operation = Math.random();
  
  if (operation < 0.6) {
    // Agent verification
    const agentId = `test-agent-${Math.floor(Math.random() * 100)}`;
    const response = http.get(`${data.baseUrl}/api/v1/agents/${agentId}/verify`, { headers });
    
    const success = check(response, {
      'QLAFS verify allows 200 or 404': (r) => r.status === 200 || r.status === 404,
      'QLAFS verify response time < 3s': (r) => r.timings.duration < 3000,
    });
    
    requestCounter.add(1, { endpoint: 'qlafs_verify' });
    responseTrend.add(response.timings.duration, { endpoint: 'qlafs_verify' });
    errorRate.add(!success);
    
  } else {
    // Fingerprint retrieval
    const agentId = `test-agent-${Math.floor(Math.random() * 100)}`;
    const response = http.get(`${data.baseUrl}/api/v1/agents/${agentId}/fingerprint`, { headers });
    
    const success = check(response, {
      'QLAFS fingerprint allows 200 or 404': (r) => r.status === 200 || r.status === 404,
      'QLAFS fingerprint response time < 2s': (r) => r.timings.duration < 2000,
    });
    
    requestCounter.add(1, { endpoint: 'qlafs_fingerprint' });
    responseTrend.add(response.timings.duration, { endpoint: 'qlafs_fingerprint' });
    errorRate.add(!success);
  }
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed');
  
  // Final health check
  const healthResponse = http.get(`${data.baseUrl}/health`);
  console.log(`Final health check status: ${healthResponse.status}`);
}

// Handle summary for custom reporting
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_duration: data.state.testRunDurationMs,
    total_requests: data.metrics.requests_total.count,
    failed_requests: data.metrics.http_req_failed.count,
    error_rate: data.metrics.http_req_failed.rate,
    avg_response_time: data.metrics.http_req_duration.avg,
    p95_response_time: data.metrics['http_req_duration{p(95)}'],
    p99_response_time: data.metrics['http_req_duration{p(99)}'],
    max_response_time: data.metrics.http_req_duration.max,
    rps: data.metrics.http_reqs.rate,
    vus_max: data.metrics.vus_max.max,
    
    // Custom metrics
    custom_error_rate: data.metrics.errors?.rate || 0,
    custom_response_time: data.metrics.response_time?.avg || 0,
    
    // Endpoint breakdown
    endpoints: {}
  };
  
  // Extract endpoint-specific metrics
  if (data.metrics.requests_total && data.metrics.requests_total.values) {
    for (const [tags, value] of Object.entries(data.metrics.requests_total.values)) {
      if (tags.includes('endpoint:')) {
        const endpoint = tags.split('endpoint:')[1].split(',')[0];
        summary.endpoints[endpoint] = value.count;
      }
    }
  }
  
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'summary.json': JSON.stringify(summary, null, 2),
    'summary.html': generateHTMLReport(summary),
  };
}

function generateHTMLReport(summary) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Load Test Results - Quantum NLP Platform</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .metric { margin: 10px 0; }
            .pass { color: green; }
            .fail { color: red; }
            .warn { color: orange; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Load Test Results</h1>
        <p><strong>Test Completed:</strong> ${summary.timestamp}</p>
        <p><strong>Duration:</strong> ${Math.round(summary.test_duration / 1000)}s</p>
        
        <h2>Summary Metrics</h2>
        <div class="metric">
            <strong>Total Requests:</strong> ${summary.total_requests}
        </div>
        <div class="metric">
            <strong>Failed Requests:</strong> ${summary.failed_requests}
        </div>
        <div class="metric ${summary.error_rate > 0.05 ? 'fail' : 'pass'}">
            <strong>Error Rate:</strong> ${(summary.error_rate * 100).toFixed(2)}%
        </div>
        <div class="metric">
            <strong>Requests/sec:</strong> ${summary.rps.toFixed(2)}
        </div>
        <div class="metric">
            <strong>Max Virtual Users:</strong> ${summary.vus_max}
        </div>
        
        <h2>Response Time Metrics</h2>
        <div class="metric">
            <strong>Average:</strong> ${summary.avg_response_time.toFixed(2)}ms
        </div>
        <div class="metric ${summary.p95_response_time > 2000 ? 'fail' : 'pass'}">
            <strong>95th Percentile:</strong> ${summary.p95_response_time.toFixed(2)}ms
        </div>
        <div class="metric">
            <strong>99th Percentile:</strong> ${summary.p99_response_time.toFixed(2)}ms
        </div>
        <div class="metric">
            <strong>Maximum:</strong> ${summary.max_response_time.toFixed(2)}ms
        </div>
        
        <h2>Endpoint Breakdown</h2>
        <table>
            <tr><th>Endpoint</th><th>Requests</th></tr>
            ${Object.entries(summary.endpoints)
              .map(([endpoint, count]) => `<tr><td>${endpoint}</td><td>${count}</td></tr>`)
              .join('')}
        </table>
    </body>
    </html>
  `;
}
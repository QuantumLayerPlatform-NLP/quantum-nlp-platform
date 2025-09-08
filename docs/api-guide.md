# API Reference Guide

## Overview

The Quantum NLP Platform provides comprehensive REST and WebSocket APIs for managing AI agents, processing natural language, and accessing QLAFS verification services.

**Base URL**: `https://api.quantum-nlp.example.com/api/v1`

## Authentication

All API requests require authentication using JWT tokens.

```http
Authorization: Bearer <your-jwt-token>
```

### Obtaining a Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-123",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "developer"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh-token-here",
  "expiresIn": 86400
}
```

## Core NLP Processing

### Process Natural Language

Process text input through the NLP pipeline with intent recognition and agent orchestration.

```http
POST /process
Content-Type: application/json
Authorization: Bearer <token>

{
  "text": "Create a new agent for sentiment analysis",
  "userId": "user-123",
  "sessionId": "session-456",
  "options": {
    "temperature": 0.7,
    "maxTokens": 1000,
    "model": "azure-gpt-4"
  }
}
```

**Response:**
```json
{
  "taskId": "task-789",
  "intent": "create_agent",
  "confidence": 0.95,
  "entities": [
    {
      "type": "agent_type",
      "value": "sentiment_analysis",
      "confidence": 0.98
    }
  ],
  "response": "I'll create a sentiment analysis agent for you...",
  "agentId": "agent-abc123",
  "status": "processing",
  "estimatedTime": 30,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Stream Processing

For real-time processing with streaming responses:

```http
POST /process-stream
Content-Type: application/json
Authorization: Bearer <token>

{
  "text": "Generate a comprehensive analysis report",
  "userId": "user-123",
  "stream": true
}
```

**Response:** Server-Sent Events (SSE)
```
data: {"type": "start", "taskId": "task-789"}

data: {"type": "progress", "step": "intent_recognition", "progress": 0.2}

data: {"type": "partial", "content": "I'll generate a comprehensive..."}

data: {"type": "complete", "result": {...}, "taskId": "task-789"}
```

## Agent Management

### Create Agent

```http
POST /agents
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Sentiment Analysis Agent",
  "description": "Analyzes emotional tone in text",
  "type": "nlp",
  "capabilities": ["sentiment_analysis", "emotion_detection"],
  "configuration": {
    "model": "azure-gpt-4",
    "temperature": 0.3,
    "maxTokens": 500
  },
  "metaPrompt": {
    "systemPrompt": "You are a sentiment analysis expert...",
    "template": "Analyze the sentiment of: {{input}}"
  }
}
```

**Response:**
```json
{
  "id": "agent-abc123",
  "name": "Sentiment Analysis Agent",
  "status": "creating",
  "fingerprint": "sha256:1234567890abcdef...",
  "trustScore": 0.0,
  "createdAt": "2024-01-15T10:30:00Z",
  "estimatedReadyTime": "2024-01-15T10:32:00Z"
}
```

### Get Agent

```http
GET /agents/{agentId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "agent-abc123",
  "name": "Sentiment Analysis Agent",
  "description": "Analyzes emotional tone in text",
  "status": "active",
  "type": "nlp",
  "capabilities": ["sentiment_analysis", "emotion_detection"],
  "configuration": {
    "model": "azure-gpt-4",
    "temperature": 0.3,
    "maxTokens": 500
  },
  "fingerprint": "sha256:1234567890abcdef...",
  "trustScore": 0.87,
  "verificationStatus": "verified",
  "performance": {
    "successRate": 0.94,
    "averageLatency": 340,
    "totalInvocations": 1250
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "lastActive": "2024-01-15T15:45:00Z"
}
```

### List Agents

```http
GET /agents?page=1&limit=20&status=active&type=nlp
Authorization: Bearer <token>
```

**Response:**
```json
{
  "agents": [
    {
      "id": "agent-abc123",
      "name": "Sentiment Analysis Agent",
      "status": "active",
      "trustScore": 0.87,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Update Agent

```http
PUT /agents/{agentId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "description": "Updated description",
  "configuration": {
    "temperature": 0.4
  }
}
```

### Delete Agent

```http
DELETE /agents/{agentId}
Authorization: Bearer <token>
```

**Response:** `204 No Content`

### Execute Agent

```http
POST /agents/{agentId}/execute
Content-Type: application/json
Authorization: Bearer <token>

{
  "input": "I love this new feature!",
  "context": {
    "userId": "user-123",
    "sessionId": "session-456"
  }
}
```

**Response:**
```json
{
  "taskId": "task-xyz789",
  "output": {
    "sentiment": "positive",
    "confidence": 0.94,
    "emotions": ["joy", "satisfaction"],
    "score": 0.8
  },
  "metrics": {
    "latency": 245,
    "tokensUsed": 87,
    "cost": 0.0023
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

## QLAFS Verification

### Agent Verification

```http
GET /agents/{agentId}/verify
Authorization: Bearer <token>
```

**Response:**
```json
{
  "agentId": "agent-abc123",
  "verified": true,
  "trustScore": 0.87,
  "fingerprint": {
    "static": "sha256:abcd1234...",
    "behavioral": "sha256:efgh5678...",
    "cognitive": "sha256:ijkl9012...",
    "compositional": "sha256:mnop3456..."
  },
  "consensus": {
    "validatorCount": 7,
    "agreement": 0.86,
    "lastConsensus": "2024-01-15T14:30:00Z"
  },
  "securityEvents": 0,
  "lastVerified": "2024-01-15T15:30:00Z"
}
```

### Get Agent Fingerprint

```http
GET /agents/{agentId}/fingerprint
Authorization: Bearer <token>
```

**Response:**
```json
{
  "agentId": "agent-abc123",
  "fingerprints": {
    "static": {
      "hash": "sha256:abcd1234...",
      "algorithm": "sha256",
      "components": {
        "codeStructure": "sha256:1111...",
        "configuration": "sha256:2222...",
        "dependencies": "sha256:3333..."
      },
      "generatedAt": "2024-01-15T10:30:00Z"
    },
    "behavioral": {
      "hash": "sha256:efgh5678...",
      "patterns": {
        "responseTime": 0.95,
        "resourceUsage": 0.82,
        "errorRate": 0.03
      },
      "generatedAt": "2024-01-15T15:30:00Z"
    }
  },
  "compositeHash": "sha256:composite123..."
}
```

### Get Agent Lineage

```http
GET /agents/{agentId}/lineage
Authorization: Bearer <token>
```

**Response:**
```json
{
  "agentId": "agent-abc123",
  "lineage": {
    "ancestors": [
      {
        "id": "agent-parent123",
        "name": "Base NLP Agent",
        "relationship": "derived_from",
        "distance": 1
      }
    ],
    "descendants": [
      {
        "id": "agent-child456",
        "name": "Enhanced Sentiment Agent",
        "relationship": "specialized_version",
        "distance": 1
      }
    ],
    "siblings": [
      {
        "id": "agent-sibling789",
        "name": "Emotion Detection Agent",
        "relationship": "peer_variant",
        "commonAncestor": "agent-parent123"
      }
    ]
  },
  "trustNetwork": {
    "directTrustConnections": 12,
    "networkTrustScore": 0.89,
    "influenceRank": 0.76
  }
}
```

## Metrics and Analytics

### Dashboard Metrics

```http
GET /metrics/dashboard?organizationId=org-123&timeRange=24h
Authorization: Bearer <token>
```

**Response:**
```json
{
  "timestamp": "2024-01-15T16:00:00Z",
  "timeRange": "24h",
  "systemHealth": {
    "status": "healthy",
    "uptime": "99.97%",
    "services": [
      {
        "name": "nlp-gateway",
        "status": "online",
        "responseTime": 45,
        "errorRate": 0.001
      }
    ]
  },
  "agentMetrics": {
    "totalAgents": 127,
    "activeAgents": 89,
    "completedTasks": 12450,
    "successRate": 0.94,
    "averageExecutionTime": 345
  },
  "nlpMetrics": {
    "totalRequests": 8934,
    "averageResponseTime": 287,
    "intentAccuracy": 0.92,
    "modelUsage": [
      {
        "model": "azure-gpt-4",
        "requests": 5234,
        "cost": 45.67
      }
    ]
  },
  "qlafsMetrics": {
    "verifiedAgents": 121,
    "trustScore": 0.88,
    "consensusAgreement": 0.94,
    "transparencyEntries": 45672,
    "securityIncidents": 0
  },
  "costMetrics": {
    "totalCost": 234.56,
    "dailyCost": 45.67,
    "costByProvider": [
      {
        "provider": "azure",
        "cost": 123.45,
        "percentage": 0.53
      }
    ]
  }
}
```

### Model Performance Metrics

```http
GET /metrics/models?timeRange=7d
Authorization: Bearer <token>
```

**Response:**
```json
{
  "models": [
    {
      "name": "azure-gpt-4",
      "provider": "azure",
      "requests": 45678,
      "averageLatency": 523,
      "successRate": 0.97,
      "cost": 567.89,
      "performance": {
        "p95Latency": 1234,
        "throughput": 12.5,
        "errorTypes": {
          "timeout": 45,
          "rateLimit": 12,
          "serverError": 8
        }
      }
    }
  ],
  "summary": {
    "totalRequests": 78945,
    "averageCost": 0.0072,
    "bestPerforming": "azure-gpt-4",
    "recommendations": [
      "Consider increasing rate limits for azure-gpt-4"
    ]
  }
}
```

## WebSocket API

### Real-time Updates

Connect to WebSocket for live updates:

```javascript
const ws = new WebSocket('wss://api.quantum-nlp.example.com/ws');

ws.onopen = function() {
  // Subscribe to specific events
  ws.send(JSON.stringify({
    action: 'subscribe',
    topics: ['agents', 'tasks', 'metrics']
  }));
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

**Message Types:**

```json
// Agent status update
{
  "type": "agent_update",
  "agentId": "agent-abc123",
  "status": "active",
  "trustScore": 0.89,
  "timestamp": "2024-01-15T16:00:00Z"
}

// Task completion
{
  "type": "task_complete",
  "taskId": "task-xyz789",
  "result": {...},
  "metrics": {...},
  "timestamp": "2024-01-15T16:01:00Z"
}

// Real-time metrics
{
  "type": "metrics_update",
  "metrics": {
    "activeAgents": 91,
    "requestsPerSecond": 23.5,
    "averageLatency": 234
  },
  "timestamp": "2024-01-15T16:02:00Z"
}
```

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "INVALID_AGENT_TYPE",
    "message": "The specified agent type 'invalid-type' is not supported",
    "details": {
      "field": "type",
      "validTypes": ["nlp", "analysis", "generation"]
    },
    "timestamp": "2024-01-15T16:00:00Z",
    "requestId": "req-123456"
  }
}
```

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `204 No Content` - Request successful, no response body
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

### Common Error Codes

- `AUTH_TOKEN_EXPIRED` - JWT token has expired
- `INVALID_AGENT_TYPE` - Unsupported agent type
- `AGENT_NOT_FOUND` - Agent does not exist
- `INSUFFICIENT_QUOTA` - API quota exceeded
- `VALIDATION_FAILED` - Input validation error
- `QLAFS_VERIFICATION_FAILED` - Agent verification failed
- `CONSENSUS_TIMEOUT` - Consensus operation timed out

## Rate Limiting

API requests are rate limited per user/organization:

- **Standard**: 1000 requests per hour
- **Premium**: 10000 requests per hour
- **Enterprise**: Custom limits

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642276800
```

## SDKs and Libraries

Official SDKs are available for:

- **JavaScript/TypeScript**: `npm install @quantum-nlp/sdk`
- **Python**: `pip install quantum-nlp-sdk`
- **Go**: `go get github.com/quantum-nlp/sdk-go`
- **Java**: Maven/Gradle artifacts available

Example usage:

```javascript
import { QuantumNLP } from '@quantum-nlp/sdk';

const client = new QuantumNLP({
  apiKey: 'your-api-key',
  baseURL: 'https://api.quantum-nlp.example.com'
});

// Process text
const result = await client.process({
  text: 'Create a sentiment analysis agent',
  userId: 'user-123'
});

// Create agent
const agent = await client.agents.create({
  name: 'My Agent',
  type: 'nlp'
});
```

For comprehensive examples and tutorials, visit our [Developer Documentation](https://docs.quantum-nlp.example.com).
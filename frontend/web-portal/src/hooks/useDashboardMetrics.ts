import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useWebSocket } from './useWebSocket';

interface DashboardMetrics {
  selectedAgentId?: string;
  systemHealth: SystemHealth;
  agentMetrics: AgentMetrics;
  nlpMetrics: NLPMetrics;
  qlafsMetrics: QlafsMetrics;
  costMetrics: CostMetrics;
  performanceMetrics: PerformanceMetrics;
  timestamp: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: string;
  services: ServiceStatus[];
  lastUpdated: string;
}

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  responseTime: number;
  errorRate: number;
}

interface AgentMetrics {
  totalAgents: number;
  activeAgents: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  successRate: number;
  topPerformingAgents: Array<{
    id: string;
    name: string;
    successRate: number;
    executionTime: number;
  }>;
}

interface NLPMetrics {
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  intentAccuracy: number;
  languageDistribution: Array<{
    language: string;
    count: number;
  }>;
  modelUsage: Array<{
    model: string;
    requests: number;
    cost: number;
  }>;
}

interface QlafsMetrics {
  verifiedAgents: number;
  trustScore: number;
  fingerprintMatches: number;
  consensusAgreement: number;
  transparencyEntries: number;
  securityIncidents: number;
}

interface CostMetrics {
  totalCost: number;
  dailyCost: number;
  monthlyCost: number;
  costByProvider: Array<{
    provider: string;
    cost: number;
    percentage: number;
  }>;
  costTrend: Array<{
    date: string;
    cost: number;
  }>;
}

interface PerformanceMetrics {
  requestsPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  errorRate: number;
  throughputTrend: Array<{
    timestamp: string;
    requests: number;
    latency: number;
  }>;
}

interface UseDashboardMetricsOptions {
  refetchInterval?: number;
  enabled?: boolean;
  organizationId?: string;
  userId?: string;
}

export const useDashboardMetrics = (options: UseDashboardMetricsOptions = {}) => {
  const {
    refetchInterval = 30000, // 30 seconds
    enabled = true,
    organizationId,
    userId
  } = options;

  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // WebSocket connection for real-time updates
  const { data: realtimeData, connected } = useWebSocket('/ws/metrics', {
    reconnect: true,
    reconnectAttempts: 5,
    reconnectDelay: 1000
  });

  // Fetch dashboard metrics
  const fetchDashboardMetrics = async (): Promise<DashboardMetrics> => {
    const params = new URLSearchParams();
    
    if (organizationId) {
      params.append('organizationId', organizationId);
    }
    
    if (userId) {
      params.append('userId', userId);
    }

    const response = await axios.get(`/api/v1/metrics/dashboard?${params.toString()}`);
    return response.data;
  };

  // React Query for dashboard metrics
  const {
    data,
    isLoading: loading,
    error,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['dashboard-metrics', organizationId, userId],
    queryFn: fetchDashboardMetrics,
    refetchInterval,
    enabled,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 10000, // Consider data stale after 10 seconds
    gcTime: 300000, // Keep in cache for 5 minutes (renamed from cacheTime in React Query v5)
  });

  // Handle real-time updates
  useEffect(() => {
    if (realtimeData && connected) {
      // Update query cache with real-time data
      queryClient.setQueryData(
        ['dashboard-metrics', organizationId, userId],
        (oldData: DashboardMetrics | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            ...realtimeData,
            timestamp: new Date().toISOString()
          };
        }
      );
      
      setLastUpdated(new Date());
    }
  }, [realtimeData, connected, queryClient, organizationId, userId]);

  // Fetch specific metric categories
  const fetchSystemHealth = useCallback(async () => {
    try {
      const response = await axios.get('/api/v1/metrics/system/health');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      throw error;
    }
  }, []);

  const fetchAgentMetrics = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (organizationId) params.append('organizationId', organizationId);
      
      const response = await axios.get(`/api/v1/metrics/agents?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch agent metrics:', error);
      throw error;
    }
  }, [organizationId]);

  const fetchCostMetrics = useCallback(async (timeRange = '24h') => {
    try {
      const params = new URLSearchParams();
      params.append('range', timeRange);
      if (organizationId) params.append('organizationId', organizationId);
      
      const response = await axios.get(`/api/v1/metrics/costs?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch cost metrics:', error);
      throw error;
    }
  }, [organizationId]);

  const fetchPerformanceMetrics = useCallback(async (timeRange = '1h') => {
    try {
      const params = new URLSearchParams();
      params.append('range', timeRange);
      if (organizationId) params.append('organizationId', organizationId);
      
      const response = await axios.get(`/api/v1/metrics/performance?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      throw error;
    }
  }, [organizationId]);

  // Invalidate and refetch metrics
  const invalidateMetrics = useCallback(() => {
    queryClient.invalidateQueries(['dashboard-metrics']);
  }, [queryClient]);

  // Manual refresh
  const refreshMetrics = useCallback(() => {
    return refetch();
  }, [refetch]);

  // Export metrics data
  const exportMetrics = useCallback(async (format: 'json' | 'csv' = 'json') => {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (organizationId) params.append('organizationId', organizationId);
      
      const response = await axios.get(`/api/v1/metrics/export?${params.toString()}`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-metrics-${Date.now()}.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export metrics:', error);
      throw error;
    }
  }, [organizationId]);

  // Calculate derived metrics
  const derivedMetrics = React.useMemo(() => {
    if (!data) return null;

    const { agentMetrics, nlpMetrics, performanceMetrics } = data;

    return {
      overallHealth: calculateOverallHealth(data),
      trends: calculateTrends(data),
      alerts: generateAlerts(data),
      recommendations: generateRecommendations(data),
      efficiency: {
        agentEfficiency: agentMetrics.successRate,
        nlpAccuracy: nlpMetrics.intentAccuracy,
        systemPerformance: 1 - performanceMetrics.errorRate
      }
    };
  }, [data]);

  return {
    data,
    loading: loading || isRefetching,
    error,
    connected,
    lastUpdated,
    derivedMetrics,
    actions: {
      refetch: refreshMetrics,
      invalidate: invalidateMetrics,
      export: exportMetrics,
      fetchSystemHealth,
      fetchAgentMetrics,
      fetchCostMetrics,
      fetchPerformanceMetrics
    }
  };
};

// Helper functions
function calculateOverallHealth(data: DashboardMetrics): 'healthy' | 'warning' | 'critical' {
  const { systemHealth, agentMetrics, performanceMetrics } = data;
  
  if (systemHealth.status === 'critical' || 
      performanceMetrics.errorRate > 0.1 || 
      agentMetrics.successRate < 0.8) {
    return 'critical';
  }
  
  if (systemHealth.status === 'degraded' || 
      performanceMetrics.errorRate > 0.05 || 
      agentMetrics.successRate < 0.9) {
    return 'warning';
  }
  
  return 'healthy';
}

function calculateTrends(data: DashboardMetrics) {
  // Simplified trend calculation
  return {
    costTrend: 'increasing',
    performanceTrend: 'stable',
    agentTrend: 'increasing'
  };
}

function generateAlerts(data: DashboardMetrics) {
  const alerts = [];
  
  if (data.performanceMetrics.errorRate > 0.05) {
    alerts.push({
      type: 'error',
      message: 'High error rate detected',
      severity: 'high'
    });
  }
  
  if (data.costMetrics.dailyCost > 1000) {
    alerts.push({
      type: 'cost',
      message: 'Daily cost exceeds threshold',
      severity: 'medium'
    });
  }
  
  return alerts;
}

function generateRecommendations(data: DashboardMetrics) {
  const recommendations = [];
  
  if (data.agentMetrics.successRate < 0.9) {
    recommendations.push({
      type: 'optimization',
      message: 'Consider optimizing agent configurations to improve success rate',
      impact: 'medium'
    });
  }
  
  return recommendations;
}
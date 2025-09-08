import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Speed,
  Memory,
  Psychology,
  Security,
  Refresh,
  MoreVert,
  Timeline,
  Assessment,
  MonetizationOn,
  ErrorOutline
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { format } from 'date-fns';

interface DashboardProps {
  userId: string;
  organizationId?: string;
  metrics?: DashboardMetrics;
  realtimeData?: RealtimeData;
}

interface DashboardMetrics {
  selectedAgentId?: string;
  systemHealth: SystemHealth;
  agentMetrics: AgentMetrics;
  nlpMetrics: NLPMetrics;
  qlafsMetrics: QlafsMetrics;
  costMetrics: CostMetrics;
  performanceMetrics: PerformanceMetrics;
}

interface RealtimeData {
  timestamp: string;
  activeAgents: number;
  processingRequests: number;
  systemLoad: number;
  memoryUsage: number;
  errorRate: number;
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

export const Dashboard: React.FC<DashboardProps> = ({
  userId,
  organizationId,
  metrics,
  realtimeData
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Trigger metrics refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'critical':
      case 'offline':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (!metrics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Platform Dashboard
        </Typography>
        <Box>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <IconButton onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>Export Data</MenuItem>
            <MenuItem onClick={handleMenuClose}>Configure Alerts</MenuItem>
            <MenuItem onClick={handleMenuClose}>View Detailed Report</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Real-time Status Bar */}
      {realtimeData && (
        <Card sx={{ mb: 3, bgcolor: 'primary.dark', color: 'white' }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="body2" opacity={0.8}>Active Agents</Typography>
                <Typography variant="h6">{realtimeData.activeAgents}</Typography>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="body2" opacity={0.8}>Processing</Typography>
                <Typography variant="h6">{realtimeData.processingRequests}</Typography>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="body2" opacity={0.8}>System Load</Typography>
                <Typography variant="h6">{formatPercentage(realtimeData.systemLoad)}</Typography>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="body2" opacity={0.8}>Memory Usage</Typography>
                <Typography variant="h6">{formatPercentage(realtimeData.memoryUsage)}</Typography>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="body2" opacity={0.8}>Error Rate</Typography>
                <Typography variant="h6">{formatPercentage(realtimeData.errorRate)}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {/* System Health */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Security sx={{ mr: 1 }} />
                <Typography variant="h6">System Health</Typography>
                <Box ml="auto">
                  <Chip 
                    label={metrics.systemHealth.status}
                    color={getStatusColor(metrics.systemHealth.status) as any}
                    size="small"
                  />
                </Box>
              </Box>
              <Typography variant="body2" color="textSecondary" mb={2}>
                Uptime: {metrics.systemHealth.uptime}
              </Typography>
              {metrics.systemHealth.services.map((service) => (
                <Box key={service.name} mb={1}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{service.name}</Typography>
                    <Chip 
                      label={service.status}
                      color={getStatusColor(service.status) as any}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between" mt={0.5}>
                    <Typography variant="caption">
                      Response: {service.responseTime}ms
                    </Typography>
                    <Typography variant="caption">
                      Error: {formatPercentage(service.errorRate)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Agent Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Psychology sx={{ mr: 1 }} />
                <Typography variant="h6">Agent Performance</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="h4">{metrics.agentMetrics.totalAgents}</Typography>
                  <Typography variant="body2" color="textSecondary">Total Agents</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h4" color="success.main">
                    {metrics.agentMetrics.activeAgents}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">Active</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Success Rate</Typography>
                    <Typography variant="body2">
                      {formatPercentage(metrics.agentMetrics.successRate)}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={metrics.agentMetrics.successRate * 100}
                    sx={{ mt: 1 }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* NLP Processing Metrics */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Timeline sx={{ mr: 1 }} />
                <Typography variant="h6">NLP Processing</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Typography variant="h5">{metrics.nlpMetrics.totalRequests.toLocaleString()}</Typography>
                  <Typography variant="body2" color="textSecondary">Total Requests</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="h5">{metrics.nlpMetrics.averageResponseTime}ms</Typography>
                  <Typography variant="body2" color="textSecondary">Avg Response</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="h5">{formatPercentage(metrics.nlpMetrics.intentAccuracy)}</Typography>
                  <Typography variant="body2" color="textSecondary">Intent Accuracy</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="h5">
                    {formatPercentage(metrics.nlpMetrics.successfulRequests / metrics.nlpMetrics.totalRequests)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">Success Rate</Typography>
                </Grid>
              </Grid>
              
              {/* Performance Trend Chart */}
              <Box mt={3}>
                <Typography variant="subtitle2" mb={2}>Performance Trend</Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={metrics.performanceMetrics.throughputTrend}>
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                    />
                    <YAxis />
                    <RechartsTooltip />
                    <Line 
                      type="monotone" 
                      dataKey="requests" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* QLAFS Security Metrics */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Security sx={{ mr: 1 }} />
                <Typography variant="h6">QLAFS Security</Typography>
              </Box>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Trust Score</Typography>
                  <Typography variant="h6" color="success.main">
                    {formatPercentage(metrics.qlafsMetrics.trustScore)}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={metrics.qlafsMetrics.trustScore * 100}
                  color="success"
                  sx={{ mt: 1 }}
                />
              </Box>
              
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Verified Agents</Typography>
                  <Typography variant="h6">{metrics.qlafsMetrics.verifiedAgents}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Consensus</Typography>
                  <Typography variant="h6">
                    {formatPercentage(metrics.qlafsMetrics.consensusAgreement)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Fingerprints</Typography>
                  <Typography variant="h6">{metrics.qlafsMetrics.fingerprintMatches}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Log Entries</Typography>
                  <Typography variant="h6">{metrics.qlafsMetrics.transparencyEntries}</Typography>
                </Grid>
              </Grid>

              {metrics.qlafsMetrics.securityIncidents > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Box display="flex" alignItems="center">
                    <ErrorOutline sx={{ mr: 1 }} />
                    <Typography variant="body2">
                      {metrics.qlafsMetrics.securityIncidents} security incidents detected
                    </Typography>
                  </Box>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cost Overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <MonetizationOn sx={{ mr: 1 }} />
                <Typography variant="h6">Cost Overview</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="h5">{formatCurrency(metrics.costMetrics.dailyCost)}</Typography>
                  <Typography variant="body2" color="textSecondary">Today</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h5">{formatCurrency(metrics.costMetrics.monthlyCost)}</Typography>
                  <Typography variant="body2" color="textSecondary">This Month</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h5">{formatCurrency(metrics.costMetrics.totalCost)}</Typography>
                  <Typography variant="body2" color="textSecondary">Total</Typography>
                </Grid>
              </Grid>
              
              {/* Cost by Provider Pie Chart */}
              <Box mt={2}>
                <Typography variant="subtitle2" mb={1}>Cost by Provider</Typography>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={metrics.costMetrics.costByProvider}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="cost"
                    >
                      {metrics.costMetrics.costByProvider.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Speed sx={{ mr: 1 }} />
                <Typography variant="h6">Performance Metrics</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="h5">{metrics.performanceMetrics.requestsPerSecond}</Typography>
                  <Typography variant="body2" color="textSecondary">Requests/sec</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5">{metrics.performanceMetrics.averageLatency}ms</Typography>
                  <Typography variant="body2" color="textSecondary">Avg Latency</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5">{metrics.performanceMetrics.p95Latency}ms</Typography>
                  <Typography variant="body2" color="textSecondary">P95 Latency</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" color={metrics.performanceMetrics.errorRate > 0.05 ? 'error.main' : 'text.primary'}>
                    {formatPercentage(metrics.performanceMetrics.errorRate)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">Error Rate</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
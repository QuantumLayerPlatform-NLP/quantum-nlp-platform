import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChartBarIcon, 
  CpuChipIcon, 
  ShieldCheckIcon, 
  BoltIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { MetricsChart } from './MetricsChart';
import { SystemHealthCard } from './SystemHealthCard';
import { AgentPerformanceGrid } from './AgentPerformanceGrid';
import { CostAnalytics } from './CostAnalytics';
import { AlertPanel } from './AlertPanel';
import { PerformanceTrends } from './PerformanceTrends';

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

interface RealtimeData {
  activeAgents: number;
  processingRequests: number;
  systemLoad: number;
  errorRate: number;
  timestamp: string;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  hover: { scale: 1.02, transition: { duration: 0.2 } }
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'purple';
}> = ({ title, value, change, icon, trend, color = 'blue' }) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800'
  };

  const trendIcon = trend === 'up' ? (
    <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
  ) : trend === 'down' ? (
    <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
  ) : null;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className={`p-6 rounded-lg border shadow-sm ${colorClasses[color]} backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <div className="flex items-center space-x-2">
            <p className="text-2xl font-bold">{value}</p>
            {trendIcon}
          </div>
          {change && (
            <p className="text-sm opacity-60">
              {change > 0 ? '+' : ''}{change.toFixed(1)}% from last hour
            </p>
          )}
        </div>
        <div className="p-3 rounded-full bg-white bg-opacity-50">
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  userId,
  organizationId,
  metrics,
  realtimeData
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'costs' | 'security'>('overview');

  // Calculate key metrics
  const overallHealth = metrics?.systemHealth?.status || 'healthy';
  const totalAgents = metrics?.agentMetrics?.totalAgents || 0;
  const activeAgents = realtimeData?.activeAgents || metrics?.agentMetrics?.activeAgents || 0;
  const successRate = metrics?.agentMetrics?.successRate || 0;
  const dailyCost = metrics?.costMetrics?.dailyCost || 0;
  const systemLoad = realtimeData?.systemLoad || 0;
  const trustScore = metrics?.qlafsMetrics?.trustScore || 0;
  const processingRequests = realtimeData?.processingRequests || 0;

  const healthColor = overallHealth === 'healthy' ? 'green' : 
                     overallHealth === 'degraded' ? 'yellow' : 'red';

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Platform Overview</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and analytics for your AI agents
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="px-3 py-2 border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="System Health"
          value={overallHealth.charAt(0).toUpperCase() + overallHealth.slice(1)}
          icon={<ShieldCheckIcon className="w-6 h-6" />}
          color={healthColor}
        />
        
        <StatCard
          title="Active Agents"
          value={`${activeAgents}/${totalAgents}`}
          change={5.2}
          trend="up"
          icon={<CpuChipIcon className="w-6 h-6" />}
          color="blue"
        />
        
        <StatCard
          title="Success Rate"
          value={`${(successRate * 100).toFixed(1)}%`}
          change={2.1}
          trend="up"
          icon={<CheckCircleIcon className="w-6 h-6" />}
          color="green"
        />
        
        <StatCard
          title="Daily Cost"
          value={`$${dailyCost.toFixed(2)}`}
          change={-3.2}
          trend="down"
          icon={<CurrencyDollarIcon className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: ChartBarIcon },
            { id: 'agents', name: 'Agents', icon: CpuChipIcon },
            { id: 'costs', name: 'Costs', icon: CurrencyDollarIcon },
            { id: 'security', name: 'Security', icon: ShieldCheckIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System Health */}
              <SystemHealthCard 
                health={metrics?.systemHealth}
                className="lg:col-span-1"
              />

              {/* Real-time Metrics */}
              <div className="bg-card rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 text-card-foreground">Real-time Activity</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Processing Requests</span>
                    <span className="font-medium">{processingRequests}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">System Load</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{(systemLoad * 100).toFixed(1)}%</span>
                      <div className="w-20 h-2 bg-gray-200 rounded-full">
                        <div
                          className={`h-full rounded-full ${
                            systemLoad > 0.8 ? 'bg-red-500' :
                            systemLoad > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${systemLoad * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">QLAFS Trust Score</span>
                    <span className="font-medium text-green-600">{(trustScore * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Performance Trends */}
              <PerformanceTrends 
                data={metrics?.performanceMetrics?.throughputTrend || []}
                className="lg:col-span-2"
              />
            </div>
          )}

          {activeTab === 'agents' && (
            <AgentPerformanceGrid 
              agents={metrics?.agentMetrics?.topPerformingAgents || []}
              totalStats={metrics?.agentMetrics}
            />
          )}

          {activeTab === 'costs' && (
            <CostAnalytics 
              costMetrics={metrics?.costMetrics}
              timeRange={selectedTimeRange}
            />
          )}

          {activeTab === 'security' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* QLAFS Security Overview */}
              <div className="bg-card rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 text-card-foreground flex items-center">
                  <ShieldCheckIcon className="w-5 h-5 mr-2" />
                  QLAFS Security
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verified Agents</span>
                    <span className="font-medium">{metrics?.qlafsMetrics?.verifiedAgents || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trust Score</span>
                    <span className="font-medium text-green-600">
                      {((metrics?.qlafsMetrics?.trustScore || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fingerprint Matches</span>
                    <span className="font-medium">{metrics?.qlafsMetrics?.fingerprintMatches || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consensus Agreement</span>
                    <span className="font-medium">
                      {((metrics?.qlafsMetrics?.consensusAgreement || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Alerts */}
              <AlertPanel 
                incidents={metrics?.qlafsMetrics?.securityIncidents || 0}
                className="lg:col-span-1"
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-primary">{metrics?.nlpMetrics?.totalRequests?.toLocaleString() || '0'}</div>
          <div className="text-sm text-muted-foreground">Total Requests</div>
        </div>
        <div className="text-center p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{((metrics?.nlpMetrics?.intentAccuracy || 0) * 100).toFixed(1)}%</div>
          <div className="text-sm text-muted-foreground">Intent Accuracy</div>
        </div>
        <div className="text-center p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{metrics?.nlpMetrics?.averageResponseTime?.toFixed(0) || '0'}ms</div>
          <div className="text-sm text-muted-foreground">Avg Response Time</div>
        </div>
        <div className="text-center p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-purple-600">{metrics?.qlafsMetrics?.transparencyEntries?.toLocaleString() || '0'}</div>
          <div className="text-sm text-muted-foreground">Transparency Entries</div>
        </div>
      </div>
    </div>
  );
};
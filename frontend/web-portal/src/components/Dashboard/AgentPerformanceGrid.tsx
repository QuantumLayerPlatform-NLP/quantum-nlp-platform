import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CpuChipIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ChartBarIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface Agent {
  id: string;
  name: string;
  successRate: number;
  executionTime: number;
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  successRate: number;
}

interface AgentPerformanceGridProps {
  agents: Agent[];
  totalStats?: AgentStats;
}

export const AgentPerformanceGrid: React.FC<AgentPerformanceGridProps> = ({ 
  agents, 
  totalStats 
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'successRate' | 'executionTime'>('successRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Generate mock data if none provided
  const mockAgents: Agent[] = Array.from({ length: 12 }, (_, i) => ({
    id: `agent-${i + 1}`,
    name: `Agent ${i + 1}`,
    successRate: 0.8 + Math.random() * 0.19,
    executionTime: 1000 + Math.random() * 3000
  }));

  const mockStats: AgentStats = {
    totalAgents: 15,
    activeAgents: 12,
    completedTasks: 2847,
    failedTasks: 153,
    averageExecutionTime: 2340,
    successRate: 0.949
  };

  const displayAgents = agents.length > 0 ? agents : mockAgents;
  const displayStats = totalStats || mockStats;

  const sortedAgents = [...displayAgents].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const handleSort = (field: 'name' | 'successRate' | 'executionTime') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getPerformanceColor = (successRate: number) => {
    if (successRate >= 0.95) return 'text-green-600 bg-green-50 border-green-200';
    if (successRate >= 0.85) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (successRate >= 0.75) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg border p-4 text-center"
        >
          <CpuChipIcon className="w-8 h-8 mx-auto mb-2 text-blue-500" />
          <div className="text-2xl font-bold text-card-foreground">{displayStats.activeAgents}</div>
          <div className="text-sm text-muted-foreground">Active Agents</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg border p-4 text-center"
        >
          <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <div className="text-2xl font-bold text-card-foreground">{displayStats.completedTasks.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Completed Tasks</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-lg border p-4 text-center"
        >
          <ClockIcon className="w-8 h-8 mx-auto mb-2 text-purple-500" />
          <div className="text-2xl font-bold text-card-foreground">{displayStats.averageExecutionTime.toFixed(0)}ms</div>
          <div className="text-sm text-muted-foreground">Avg Execution Time</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-lg border p-4 text-center"
        >
          <ChartBarIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <div className="text-2xl font-bold text-card-foreground">{(displayStats.successRate * 100).toFixed(1)}%</div>
          <div className="text-sm text-muted-foreground">Success Rate</div>
        </motion.div>
      </div>

      {/* Agent Performance Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-lg border overflow-hidden"
      >
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-card-foreground">Agent Performance Details</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Agent Name</span>
                    {sortBy === 'name' && (
                      <span className="text-primary">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort('successRate')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Success Rate</span>
                    {sortBy === 'successRate' && (
                      <span className="text-primary">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort('executionTime')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Execution Time</span>
                    {sortBy === 'executionTime' && (
                      <span className="text-primary">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {sortedAgents.map((agent, index) => (
                <motion.tr
                  key={agent.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  className="hover:bg-muted/30"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <CpuChipIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-card-foreground">{agent.name}</div>
                        <div className="text-sm text-muted-foreground">{agent.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-card-foreground">
                          {(agent.successRate * 100).toFixed(1)}%
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${
                              agent.successRate >= 0.95 ? 'bg-green-500' :
                              agent.successRate >= 0.85 ? 'bg-blue-500' :
                              agent.successRate >= 0.75 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${agent.successRate * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                    {agent.executionTime.toFixed(0)}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPerformanceColor(agent.successRate)}`}>
                      {agent.successRate >= 0.95 ? 'Excellent' :
                       agent.successRate >= 0.85 ? 'Good' :
                       agent.successRate >= 0.75 ? 'Fair' : 'Poor'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary hover:text-primary/80 flex items-center space-x-1">
                      <EyeIcon className="w-4 h-4" />
                      <span>View Details</span>
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};
import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  ClockIcon,
  ServerIcon
} from '@heroicons/react/24/outline';

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

interface SystemHealthCardProps {
  health?: SystemHealth;
  className?: string;
}

export const SystemHealthCard: React.FC<SystemHealthCardProps> = ({ health, className = '' }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'critical':
      case 'offline':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
      case 'offline':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const defaultHealth: SystemHealth = {
    status: 'healthy',
    uptime: '99.9%',
    services: [
      { name: 'NLP Gateway', status: 'online', responseTime: 45, errorRate: 0.1 },
      { name: 'QLAFS Fingerprint', status: 'online', responseTime: 32, errorRate: 0.0 },
      { name: 'Agent Orchestrator', status: 'online', responseTime: 28, errorRate: 0.2 },
      { name: 'Metrics Collector', status: 'online', responseTime: 15, errorRate: 0.0 }
    ],
    lastUpdated: new Date().toISOString()
  };

  const currentHealth = health || defaultHealth;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-lg border p-6 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-card-foreground flex items-center">
          <ServerIcon className="w-5 h-5 mr-2" />
          System Health
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(currentHealth.status)}`}>
          <div className="flex items-center space-x-2">
            {getStatusIcon(currentHealth.status)}
            <span className="capitalize">{currentHealth.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{currentHealth.uptime}</div>
          <div className="text-sm text-muted-foreground">Uptime</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{currentHealth.services.filter(s => s.status === 'online').length}</div>
          <div className="text-sm text-muted-foreground">Services Online</div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-card-foreground">Service Status</h4>
        {currentHealth.services.map((service, index) => (
          <motion.div
            key={service.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              {getStatusIcon(service.status)}
              <span className="font-medium text-card-foreground">{service.name}</span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{service.responseTime}ms</span>
              <span className={service.errorRate > 0.1 ? 'text-red-500' : 'text-green-600'}>
                {service.errorRate.toFixed(1)}% errors
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 text-xs text-muted-foreground text-center">
        Last updated: {new Date(currentHealth.lastUpdated).toLocaleString()}
      </div>
    </motion.div>
  );
};
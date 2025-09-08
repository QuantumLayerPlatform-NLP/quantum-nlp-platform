import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  XCircleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  source?: string;
}

interface AlertPanelProps {
  incidents: number;
  className?: string;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ incidents, className = '' }) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  // Generate mock alerts
  const mockAlerts: Alert[] = [
    {
      id: 'alert-1',
      type: 'error',
      severity: 'high',
      title: 'High Error Rate Detected',
      message: 'NLP Gateway experiencing 5.2% error rate in the last 15 minutes',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      acknowledged: false,
      source: 'NLP Gateway'
    },
    {
      id: 'alert-2',
      type: 'warning',
      severity: 'medium',
      title: 'QLAFS Consensus Timeout',
      message: 'Agent consensus verification taking longer than expected (>500ms)',
      timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      acknowledged: false,
      source: 'QLAFS Consensus'
    },
    {
      id: 'alert-3',
      type: 'warning',
      severity: 'medium',
      title: 'Cost Threshold Approaching',
      message: 'Daily cost is 85% of allocated budget ($89.42/$105.00)',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      acknowledged: false,
      source: 'Cost Monitor'
    },
    {
      id: 'alert-4',
      type: 'info',
      severity: 'low',
      title: 'Agent Performance Optimization',
      message: 'Agent-7 could benefit from prompt optimization (current success rate: 84.2%)',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      acknowledged: true,
      source: 'Performance Monitor'
    },
    {
      id: 'alert-5',
      type: 'success',
      severity: 'low',
      title: 'Security Scan Complete',
      message: 'Weekly vulnerability scan completed successfully. No issues found.',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      acknowledged: false,
      source: 'Security Scanner'
    }
  ];

  const getAlertIcon = (type: string, severity: string) => {
    const iconClass = "w-5 h-5";
    
    switch (type) {
      case 'error':
        return <XCircleIcon className={`${iconClass} text-red-500`} />;
      case 'warning':
        return <ExclamationTriangleIcon className={`${iconClass} text-yellow-500`} />;
      case 'info':
        return <InformationCircleIcon className={`${iconClass} text-blue-500`} />;
      case 'success':
        return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
      default:
        return <InformationCircleIcon className={`${iconClass} text-gray-500`} />;
    }
  };

  const getAlertColor = (type: string, severity: string) => {
    const isAcknowledged = acknowledgedAlerts.size > 0;
    const opacity = isAcknowledged ? 'opacity-60' : '';
    
    switch (type) {
      case 'error':
        return `bg-red-50 border-red-200 ${opacity}`;
      case 'warning':
        return `bg-yellow-50 border-yellow-200 ${opacity}`;
      case 'info':
        return `bg-blue-50 border-blue-200 ${opacity}`;
      case 'success':
        return `bg-green-50 border-green-200 ${opacity}`;
      default:
        return `bg-gray-50 border-gray-200 ${opacity}`;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const badges = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    
    return badges[severity as keyof typeof badges] || badges.low;
  };

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedAlerts(prev => new Set([...prev, alertId]));
  };

  const filteredAlerts = mockAlerts.filter(alert => 
    selectedSeverity === 'all' || alert.severity === selectedSeverity
  );

  const unacknowledgedCount = filteredAlerts.filter(alert => 
    !alert.acknowledged && !acknowledgedAlerts.has(alert.id)
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-lg border ${className}`}
    >
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center">
            <ShieldExclamationIcon className="w-5 h-5 mr-2" />
            Security & Alerts
          </h3>
          {unacknowledgedCount > 0 && (
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-red-300">
              {unacknowledgedCount} unacknowledged
            </span>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {['all', 'critical', 'high', 'medium', 'low'].map((severity) => (
            <button
              key={severity}
              onClick={() => setSelectedSeverity(severity)}
              className={`px-3 py-1 text-xs font-medium rounded-md border ${
                selectedSeverity === severity
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        <AnimatePresence>
          {filteredAlerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 border-b border-border last:border-b-0 ${getAlertColor(alert.type, alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="mt-0.5">
                    {getAlertIcon(alert.type, alert.severity)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-card-foreground truncate">
                        {alert.title}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getSeverityBadge(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      {alert.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{alert.source}</span>
                        <span>•</span>
                        <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {!alert.acknowledged && !acknowledgedAlerts.has(alert.id) && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button className="text-gray-400 hover:text-gray-600">
                    <EyeIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredAlerts.length === 0 && (
        <div className="p-8 text-center">
          <CheckCircleIcon className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <p className="text-sm text-muted-foreground">No alerts for selected severity level</p>
        </div>
      )}

      {/* Security Incidents Summary */}
      <div className="p-4 bg-muted/20 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Security incidents this month:</span>
          <span className="font-medium text-card-foreground">{incidents}</span>
        </div>
      </div>
    </motion.div>
  );
};
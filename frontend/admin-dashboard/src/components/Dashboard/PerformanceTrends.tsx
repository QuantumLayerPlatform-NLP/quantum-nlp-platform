import React from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

interface ThroughputData {
  timestamp: string;
  requests: number;
  latency: number;
}

interface PerformanceTrendsProps {
  data: ThroughputData[];
  className?: string;
}

export const PerformanceTrends: React.FC<PerformanceTrendsProps> = ({ data, className = '' }) => {
  // Generate mock data if none provided
  const mockData = Array.from({ length: 24 }, (_, i) => {
    const timestamp = new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString();
    return {
      timestamp,
      requests: Math.floor(Math.random() * 1000) + 500,
      latency: Math.floor(Math.random() * 100) + 50
    };
  });

  const chartData = data.length > 0 ? data : mockData;
  
  // Calculate trends
  const currentRequests = chartData[chartData.length - 1]?.requests || 0;
  const previousRequests = chartData[chartData.length - 2]?.requests || 0;
  const requestsTrend = currentRequests - previousRequests;
  
  const currentLatency = chartData[chartData.length - 1]?.latency || 0;
  const previousLatency = chartData[chartData.length - 2]?.latency || 0;
  const latencyTrend = currentLatency - previousLatency;

  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-lg border p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-card-foreground">Performance Trends</h3>
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              {requestsTrend >= 0 ? (
                <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
              )}
              <span className="font-medium">Requests</span>
            </div>
            <span className={requestsTrend >= 0 ? 'text-green-600' : 'text-red-600'}>
              {requestsTrend >= 0 ? '+' : ''}{requestsTrend}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              {latencyTrend <= 0 ? (
                <ArrowTrendingDownIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowTrendingUpIcon className="w-4 h-4 text-red-500" />
              )}
              <span className="font-medium">Latency</span>
            </div>
            <span className={latencyTrend <= 0 ? 'text-green-600' : 'text-red-600'}>
              {latencyTrend >= 0 ? '+' : ''}{latencyTrend}ms
            </span>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis 
              yAxisId="requests"
              orientation="left"
              stroke="#3b82f6"
              fontSize={12}
            />
            <YAxis 
              yAxisId="latency"
              orientation="right"
              stroke="#ef4444"
              fontSize={12}
            />
            <Tooltip 
              formatter={(value: any, name: string) => {
                if (name === 'requests') {
                  return [value.toLocaleString(), 'Requests/s'];
                }
                return [`${value}ms`, 'Latency'];
              }}
              labelFormatter={(label) => new Date(label).toLocaleString()}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            
            {/* Reference line for target latency */}
            <ReferenceLine yAxisId="latency" y={100} stroke="#f59e0b" strokeDasharray="5 5" />
            
            <Area
              yAxisId="requests"
              type="monotone"
              dataKey="requests"
              fill="url(#requestsGradient)"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
            />
            
            <Line
              yAxisId="latency"
              type="monotone"
              dataKey="latency"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: '#ef4444', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: '#ef4444' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-lg font-bold text-blue-600">
            {(chartData.reduce((sum, point) => sum + point.requests, 0) / chartData.length).toFixed(0)}
          </div>
          <div className="text-xs text-blue-600">Avg Requests/s</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-lg font-bold text-red-600">
            {(chartData.reduce((sum, point) => sum + point.latency, 0) / chartData.length).toFixed(0)}ms
          </div>
          <div className="text-xs text-red-600">Avg Latency</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-lg font-bold text-green-600">
            {Math.max(...chartData.map(point => point.requests)).toLocaleString()}
          </div>
          <div className="text-xs text-green-600">Peak Requests/s</div>
        </div>
      </div>
    </motion.div>
  );
};
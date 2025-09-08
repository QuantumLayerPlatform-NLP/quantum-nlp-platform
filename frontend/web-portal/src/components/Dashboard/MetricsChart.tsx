import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion } from 'framer-motion';

interface DataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

interface MetricsChartProps {
  data: DataPoint[];
  title: string;
  color?: string;
  type?: 'line' | 'area';
  height?: number;
  className?: string;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  data,
  title,
  color = '#3b82f6',
  type = 'area',
  height = 300,
  className = ''
}) => {
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTooltip = (value: any, name: string) => {
    if (typeof value === 'number') {
      return [value.toLocaleString(), title];
    }
    return [value, name];
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-card rounded-lg border p-6 ${className}`}
    >
      <h3 className="text-lg font-semibold text-card-foreground mb-4">{title}</h3>
      
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          {type === 'area' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
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
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => new Date(label).toLocaleString()}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
                fillOpacity={1}
              />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => new Date(label).toLocaleString()}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: color }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
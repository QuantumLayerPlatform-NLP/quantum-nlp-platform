import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { motion } from 'framer-motion';
import { CurrencyDollarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

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

interface CostAnalyticsProps {
  costMetrics?: CostMetrics;
  timeRange: '1h' | '6h' | '24h' | '7d';
}

export const CostAnalytics: React.FC<CostAnalyticsProps> = ({ costMetrics, timeRange }) => {
  // Generate mock data if none provided
  const mockCostMetrics: CostMetrics = {
    totalCost: 1247.83,
    dailyCost: 89.42,
    monthlyCost: 2684.51,
    costByProvider: [
      { provider: 'Azure OpenAI', cost: 524.12, percentage: 42 },
      { provider: 'AWS Bedrock', cost: 398.67, percentage: 32 },
      { provider: 'Infrastructure', cost: 199.34, percentage: 16 },
      { provider: 'Storage', cost: 125.70, percentage: 10 }
    ],
    costTrend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString(),
      cost: 70 + Math.random() * 40
    }))
  };

  const data = costMetrics || mockCostMetrics;
  
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  
  const calculateTrend = () => {
    if (data.costTrend.length < 2) return 0;
    const recent = data.costTrend.slice(-7).reduce((sum, item) => sum + item.cost, 0) / 7;
    const previous = data.costTrend.slice(-14, -7).reduce((sum, item) => sum + item.cost, 0) / 7;
    return ((recent - previous) / previous) * 100;
  };

  const trend = calculateTrend();

  return (
    <div className="space-y-6">
      {/* Cost Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg border p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Daily Cost</p>
              <p className="text-2xl font-bold text-card-foreground">{formatCurrency(data.dailyCost)}</p>
              <div className="flex items-center mt-1">
                {trend >= 0 ? (
                  <ArrowTrendingUpIcon className="w-4 h-4 text-red-500 mr-1" />
                ) : (
                  <ArrowTrendingDownIcon className="w-4 h-4 text-green-500 mr-1" />
                )}
                <span className={`text-sm ${trend >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {Math.abs(trend).toFixed(1)}% vs last week
                </span>
              </div>
            </div>
            <div className="p-3 rounded-full bg-blue-50">
              <CurrencyDollarIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg border p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Monthly Cost</p>
              <p className="text-2xl font-bold text-card-foreground">{formatCurrency(data.monthlyCost)}</p>
              <p className="text-sm text-muted-foreground mt-1">Projected</p>
            </div>
            <div className="p-3 rounded-full bg-green-50">
              <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-lg border p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Spend</p>
              <p className="text-2xl font-bold text-card-foreground">{formatCurrency(data.totalCost)}</p>
              <p className="text-sm text-muted-foreground mt-1">This period</p>
            </div>
            <div className="p-3 rounded-full bg-purple-50">
              <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Provider */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-lg border p-6"
        >
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Cost by Provider</h3>
          
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.costByProvider}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="cost"
                >
                  {data.costByProvider.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 mt-4">
            {data.costByProvider.map((provider, index) => (
              <div key={provider.provider} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: colors[index % colors.length] }}
                  ></div>
                  <span className="text-sm text-muted-foreground">{provider.provider}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-card-foreground">
                    {formatCurrency(provider.cost)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {provider.percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cost Trend */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-lg border p-6"
        >
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Cost Trend</h3>
          
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data.costTrend}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  stroke="#6b7280"
                  fontSize={12}
                />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(value), 'Daily Cost']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Cost Optimization Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-card rounded-lg border p-6"
      >
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Cost Optimization Recommendations</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-blue-800 mb-2">Model Usage</div>
            <div className="text-xs text-blue-600">
              Consider optimizing prompt lengths to reduce token usage by ~15%
            </div>
            <div className="text-xs text-blue-800 font-medium mt-1">
              Potential savings: $18.50/day
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm font-medium text-green-800 mb-2">Infrastructure</div>
            <div className="text-xs text-green-600">
              Auto-scaling optimization could reduce idle compute costs
            </div>
            <div className="text-xs text-green-800 font-medium mt-1">
              Potential savings: $12.30/day
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-sm font-medium text-yellow-800 mb-2">Storage</div>
            <div className="text-xs text-yellow-600">
              Archive old logs and metrics data older than 90 days
            </div>
            <div className="text-xs text-yellow-800 font-medium mt-1">
              Potential savings: $8.20/day
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
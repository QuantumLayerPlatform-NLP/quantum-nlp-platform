import React from 'react';

interface DashboardProps {
  userId: string;
  organizationId?: string;
  metrics?: any;
  realtimeData?: any;
}

export const Dashboard: React.FC<DashboardProps> = ({
  userId,
  organizationId,
  metrics,
  realtimeData
}) => {
  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>Dashboard</h3>
      <p>User ID: {userId}</p>
      <p>Organization: {organizationId || 'Default'}</p>
      <p>Status: Dashboard component loaded successfully</p>
      {realtimeData && (
        <p>Real-time data connected: ✅</p>
      )}
      {metrics && (
        <p>Metrics loaded: ✅</p>
      )}
    </div>
  );
};
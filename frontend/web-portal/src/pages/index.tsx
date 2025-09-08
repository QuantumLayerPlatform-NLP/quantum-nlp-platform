import React from 'react';
import Head from 'next/head';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { Dashboard } from '../components/Dashboard/Dashboard';
import { QlafsVisualizer } from '../components/QlafsVisualizer/QlafsVisualizer';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';

const HomePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: realtimeData, connected } = useWebSocket('/ws/metrics');
  const {
    data: metrics,
    loading: metricsLoading,
    error: metricsError,
    refetch
  } = useDashboardMetrics();

  if (authLoading || metricsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="warning">
          Please log in to access the dashboard.
        </Alert>
      </Container>
    );
  }

  if (metricsError) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error" action={
          <button onClick={() => refetch()}>Retry</button>
        }>
          Failed to load dashboard metrics: {metricsError.message}
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <Head>
        <title>Quantum NLP Platform - Dashboard</title>
        <meta name="description" content="Enterprise NLP platform with QLAFS verification" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box mb={3}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome back, {user.name}
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            Quantum NLP Platform Dashboard
          </Typography>
          {!connected && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Real-time connection lost. Data may not be up to date.
            </Alert>
          )}
        </Box>

        <Grid container spacing={3}>
          {/* Dashboard Overview */}
          <Grid item xs={12}>
            <Dashboard
              userId={user.id}
              organizationId={user.organizationId}
              metrics={metrics}
              realtimeData={realtimeData}
            />
          </Grid>

          {/* QLAFS Visualization */}
          <Grid item xs={12} lg={8}>
            <Card sx={{ height: 500 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Agent Lineage & Trust Network
                </Typography>
                <QlafsVisualizer
                  agentId={metrics?.selectedAgentId}
                  showLineage={true}
                  showTrustNetwork={true}
                  interactive={true}
                  height={400}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
};

export default HomePage;
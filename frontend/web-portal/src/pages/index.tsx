import React from 'react'
import Head from 'next/head'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '../components/Dashboard/Dashboard'
import { QlafsVisualizer } from '../components/QlafsVisualizer/QlafsVisualizer'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket } from '../hooks/useWebSocket'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'
import '../styles/globals.css'

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

const HomePageContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth()
  const { data: realtimeData, connected } = useWebSocket('/ws/metrics')
  const {
    data: metrics,
    loading: metricsLoading,
    error: metricsError,
    actions: { refetch }
  } = useDashboardMetrics()

  if (authLoading || metricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-pulse-glow">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md p-6 bg-card rounded-lg border shadow-lg">
          <div className="flex items-center space-x-2 text-amber-600 mb-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Authentication Required</span>
          </div>
          <p className="text-muted-foreground">
            Please log in to access the Quantum NLP Platform dashboard.
          </p>
        </div>
      </div>
    )
  }

  if (metricsError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md p-6 bg-card rounded-lg border shadow-lg">
          <div className="flex items-center space-x-2 text-destructive mb-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Failed to Load Dashboard</span>
          </div>
          <p className="text-muted-foreground mb-4">
            {metricsError?.message || 'Unable to load dashboard metrics'}
          </p>
          <button 
            onClick={() => refetch()}
            className="w-full px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Quantum NLP Platform - AI-Powered Enterprise Dashboard</title>
        <meta name="description" content="Advanced AI and NLP processing platform with QLAFS verification, real-time analytics, and enterprise-grade security." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Quantum NLP Platform" />
        <meta property="og:description" content="Enterprise AI platform with advanced NLP capabilities" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="ai-gradient w-8 h-8 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">Q</span>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">
                    Quantum NLP Platform
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Welcome back, {user.name}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {!connected && (
                  <div className="flex items-center space-x-2 text-amber-600">
                    <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></div>
                    <span className="text-sm">Reconnecting...</span>
                  </div>
                )}
                {connected && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <span className="text-sm">Live</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <div className="space-y-6">
            {/* Dashboard Overview */}
            <div className="animate-slide-in">
              <Dashboard
                userId={user.id}
                organizationId={user.organizationId}
                metrics={metrics}
                realtimeData={realtimeData}
              />
            </div>

            {/* QLAFS Visualization */}
            <div className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
              <div className="bg-card rounded-lg border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-card-foreground">
                      Agent Trust Network & Lineage
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      QLAFS-verified agent relationships and trust scores
                    </p>
                  </div>
                  <div className="ai-glow px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    AI-Powered
                  </div>
                </div>
                
                <QlafsVisualizer
                  agentId={metrics?.selectedAgentId}
                  showLineage={true}
                  showTrustNetwork={true}
                  interactive={true}
                  height={500}
                />
              </div>
            </div>

            {/* Real-time Status Cards */}
            {realtimeData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-in" style={{ animationDelay: '0.2s' }}>
                <div className="bg-card rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Agents</p>
                      <p className="text-2xl font-bold text-card-foreground">{realtimeData.activeAgents}</p>
                    </div>
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Processing</p>
                      <p className="text-2xl font-bold text-card-foreground">{realtimeData.processingRequests}</p>
                    </div>
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">System Load</p>
                      <p className="text-2xl font-bold text-card-foreground">{Math.round(realtimeData.systemLoad * 100)}%</p>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      realtimeData.systemLoad > 0.8 ? 'bg-red-100' : realtimeData.systemLoad > 0.6 ? 'bg-amber-100' : 'bg-green-100'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        realtimeData.systemLoad > 0.8 ? 'text-red-600' : realtimeData.systemLoad > 0.6 ? 'text-amber-600' : 'text-green-600'
                      }`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                      <p className="text-2xl font-bold text-card-foreground">{(realtimeData.errorRate * 100).toFixed(2)}%</p>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      realtimeData.errorRate > 0.05 ? 'bg-red-100' : 'bg-green-100'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        realtimeData.errorRate > 0.05 ? 'text-red-600' : 'text-green-600'
                      }`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60 mt-12">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>© 2024 Quantum NLP Platform. Enterprise AI Infrastructure.</p>
              <div className="flex items-center space-x-4">
                <span>v1.0.0</span>
                <span>•</span>
                <span>QLAFS Verified</span>
                <span>•</span>
                <span className="text-green-600">All Systems Operational</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

export default function HomePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <HomePageContent />
    </QueryClientProvider>
  )
}
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Chip,
  Switch,
  FormControlLabel,
  Slider,
  Menu,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  Fullscreen,
  Settings,
  Download,
  Refresh,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';

interface QlafsVisualizerProps {
  agentId?: string;
  showLineage?: boolean;
  showTrustNetwork?: boolean;
  interactive?: boolean;
  height?: number;
  width?: number;
}

interface AgentNode {
  id: string;
  name: string;
  type: 'agent' | 'ensemble' | 'metaprompt' | 'validator';
  trustScore: number;
  verificationStatus: 'verified' | 'pending' | 'failed' | 'unknown';
  fingerprint: string;
  createdAt: string;
  lastActive: string;
  parentId?: string;
  children?: string[];
  metadata?: {
    version: string;
    capabilities: string[];
    performance: number;
    reliability: number;
  };
  position?: { x: number; y: number };
  fx?: number;
  fy?: number;
}

interface TrustLink {
  source: string;
  target: string;
  type: 'creation' | 'verification' | 'consensus' | 'collaboration' | 'validation';
  strength: number;
  timestamp: string;
  metadata?: {
    consensusScore?: number;
    validatorCount?: number;
    evidenceHash?: string;
  };
}

interface NetworkData {
  nodes: AgentNode[];
  links: TrustLink[];
}

interface VisualizationState {
  zoom: number;
  showLabels: boolean;
  showTrustScores: boolean;
  filterByTrust: number;
  highlightedNode?: string;
  selectedNode?: AgentNode;
  linkStrengthThreshold: number;
}

const NODE_COLORS = {
  agent: '#2196F3',
  ensemble: '#4CAF50',
  metaprompt: '#FF9800',
  validator: '#9C27B0'
};

const LINK_COLORS = {
  creation: '#4CAF50',
  verification: '#2196F3',
  consensus: '#9C27B0',
  collaboration: '#FF9800',
  validation: '#F44336'
};

const TRUST_COLORS = {
  high: '#4CAF50',
  medium: '#FF9800',
  low: '#F44336',
  unknown: '#9E9E9E'
};

export const QlafsVisualizer: React.FC<QlafsVisualizerProps> = ({
  agentId,
  showLineage = true,
  showTrustNetwork = true,
  interactive = true,
  height = 400,
  width
}) => {
  const forceRef = useRef<any>();
  const [networkData, setNetworkData] = useState<NetworkData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const [visualState, setVisualState] = useState<VisualizationState>({
    zoom: 1,
    showLabels: true,
    showTrustScores: true,
    filterByTrust: 0,
    linkStrengthThreshold: 0.1
  });

  // Load network data
  const loadNetworkData = useCallback(async () => {
    if (!agentId && !showTrustNetwork) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call to fetch QLAFS network data
      const response = await fetch(`/api/v1/agents/${agentId}/network?lineage=${showLineage}&trust=${showTrustNetwork}`);
      if (!response.ok) throw new Error('Failed to load network data');
      
      const data = await response.json();
      setNetworkData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to load network data:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId, showLineage, showTrustNetwork]);

  useEffect(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  // Filter data based on visualization state
  const filteredData = React.useMemo(() => {
    const filteredNodes = networkData.nodes.filter(node => 
      node.trustScore >= visualState.filterByTrust
    );
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = networkData.links.filter(link => 
      nodeIds.has(link.source as string) && 
      nodeIds.has(link.target as string) &&
      link.strength >= visualState.linkStrengthThreshold
    );
    
    return { nodes: filteredNodes, links: filteredLinks };
  }, [networkData, visualState.filterByTrust, visualState.linkStrengthThreshold]);

  // Node rendering
  const nodeCanvasObject = useCallback((node: AgentNode, ctx: CanvasRenderingContext2D) => {
    const size = 8 + (node.trustScore * 12);
    const color = getTrustColor(node.trustScore);
    
    // Draw node
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, size, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw border for verified agents
    if (node.verificationStatus === 'verified') {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw labels if enabled
    if (visualState.showLabels && visualState.zoom > 0.5) {
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, node.x || 0, (node.y || 0) + size + 15);
    }
    
    // Draw trust score if enabled
    if (visualState.showTrustScores && visualState.zoom > 0.7) {
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        (node.trustScore * 100).toFixed(0) + '%',
        node.x || 0,
        (node.y || 0) + size + 28
      );
    }
  }, [visualState.showLabels, visualState.showTrustScores, visualState.zoom]);

  // Link rendering
  const linkCanvasObject = useCallback((link: TrustLink, ctx: CanvasRenderingContext2D) => {
    const start = link.source as any;
    const end = link.target as any;
    
    if (!start.x || !start.y || !end.x || !end.y) return;
    
    const color = LINK_COLORS[link.type] || '#999';
    const width = 1 + (link.strength * 3);
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.6 + (link.strength * 0.4);
    ctx.stroke();
    
    // Draw arrow for directional links
    if (['creation', 'validation'].includes(link.type)) {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const arrowLength = 8;
      const arrowAngle = Math.PI / 6;
      
      ctx.beginPath();
      ctx.moveTo(
        end.x - arrowLength * Math.cos(angle - arrowAngle),
        end.y - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.lineTo(end.x, end.y);
      ctx.lineTo(
        end.x - arrowLength * Math.cos(angle + arrowAngle),
        end.y - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  }, []);

  const getTrustColor = (trustScore: number) => {
    if (trustScore >= 0.8) return TRUST_COLORS.high;
    if (trustScore >= 0.6) return TRUST_COLORS.medium;
    if (trustScore >= 0.3) return TRUST_COLORS.low;
    return TRUST_COLORS.unknown;
  };

  const handleNodeClick = (node: AgentNode) => {
    if (!interactive) return;
    
    setVisualState(prev => ({
      ...prev,
      selectedNode: node,
      highlightedNode: node.id
    }));
    
    // Center on node
    if (forceRef.current) {
      forceRef.current.centerAt(node.x, node.y, 1000);
    }
  };

  const handleZoomIn = () => {
    if (forceRef.current) {
      const newZoom = Math.min(visualState.zoom * 1.5, 5);
      forceRef.current.zoom(newZoom, 400);
      setVisualState(prev => ({ ...prev, zoom: newZoom }));
    }
  };

  const handleZoomOut = () => {
    if (forceRef.current) {
      const newZoom = Math.max(visualState.zoom / 1.5, 0.1);
      forceRef.current.zoom(newZoom, 400);
      setVisualState(prev => ({ ...prev, zoom: newZoom }));
    }
  };

  const handleCenter = () => {
    if (forceRef.current) {
      forceRef.current.zoomToFit(400);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const exportNetwork = () => {
    // Export network as JSON or image
    const dataStr = JSON.stringify(networkData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qlafs-network-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    handleMenuClose();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <IconButton color="inherit" size="small" onClick={loadNetworkData}>
          <Refresh />
        </IconButton>
      }>
        Failed to load network data: {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" gap={1}>
          <Tooltip title="Zoom In">
            <IconButton onClick={handleZoomIn} size="small">
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={handleZoomOut} size="small">
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Center View">
            <IconButton onClick={handleCenter} size="small">
              <CenterFocusStrong />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={loadNetworkData} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Box display="flex" alignItems="center" gap={1}>
          <FormControlLabel
            control={
              <Switch
                checked={visualState.showLabels}
                onChange={(e) => setVisualState(prev => ({ 
                  ...prev, 
                  showLabels: e.target.checked 
                }))}
                size="small"
              />
            }
            label="Labels"
          />
          <FormControlLabel
            control={
              <Switch
                checked={visualState.showTrustScores}
                onChange={(e) => setVisualState(prev => ({ 
                  ...prev, 
                  showTrustScores: e.target.checked 
                }))}
                size="small"
              />
            }
            label="Trust Scores"
          />
          <IconButton onClick={handleMenuOpen} size="small">
            <Settings />
          </IconButton>
        </Box>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={3} mb={2} alignItems="center">
        <Box>
          <Typography variant="caption" display="block">
            Min Trust Score: {(visualState.filterByTrust * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={visualState.filterByTrust}
            onChange={(_, value) => setVisualState(prev => ({ 
              ...prev, 
              filterByTrust: value as number 
            }))}
            min={0}
            max={1}
            step={0.1}
            sx={{ width: 120 }}
            size="small"
          />
        </Box>
        <Box>
          <Typography variant="caption" display="block">
            Link Strength: {(visualState.linkStrengthThreshold * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={visualState.linkStrengthThreshold}
            onChange={(_, value) => setVisualState(prev => ({ 
              ...prev, 
              linkStrengthThreshold: value as number 
            }))}
            min={0}
            max={1}
            step={0.1}
            sx={{ width: 120 }}
            size="small"
          />
        </Box>
      </Box>

      {/* Network Visualization */}
      <Box 
        sx={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: 1,
          overflow: 'hidden'
        }}
      >
        <ForceGraph2D
          ref={forceRef}
          graphData={filteredData}
          width={width}
          height={height}
          nodeCanvasObject={nodeCanvasObject}
          linkCanvasObject={linkCanvasObject}
          onNodeClick={handleNodeClick}
          onNodeHover={(node) => {
            if (interactive && node) {
              setVisualState(prev => ({ ...prev, highlightedNode: node.id }));
            }
          }}
          cooldownTicks={100}
          d3AlphaDecay={0.0228}
          d3VelocityDecay={0.4}
          enableZoomInteraction={interactive}
          enablePanInteraction={interactive}
          enablePointerInteraction={interactive}
        />
      </Box>

      {/* Legend */}
      <Box mt={2}>
        <Typography variant="subtitle2" gutterBottom>Legend</Typography>
        <Box display="flex" flexWrap="wrap" gap={1}>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <Chip
              key={type}
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              sx={{ bgcolor: color, color: 'white' }}
              size="small"
            />
          ))}
        </Box>
      </Box>

      {/* Node Details */}
      {visualState.selectedNode && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {visualState.selectedNode.name}
            </Typography>
            <Box display="flex" gap={1} mb={2}>
              <Chip 
                label={visualState.selectedNode.type}
                color="primary"
                size="small"
              />
              <Chip 
                label={visualState.selectedNode.verificationStatus}
                color={visualState.selectedNode.verificationStatus === 'verified' ? 'success' : 'default'}
                size="small"
              />
              <Chip 
                label={`Trust: ${(visualState.selectedNode.trustScore * 100).toFixed(1)}%`}
                color={visualState.selectedNode.trustScore >= 0.8 ? 'success' : 
                       visualState.selectedNode.trustScore >= 0.6 ? 'warning' : 'error'}
                size="small"
              />
            </Box>
            <Typography variant="body2" color="textSecondary">
              ID: {visualState.selectedNode.id}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Fingerprint: {visualState.selectedNode.fingerprint.slice(0, 16)}...
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Created: {new Date(visualState.selectedNode.createdAt).toLocaleDateString()}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Settings Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={exportNetwork}>
          <Download sx={{ mr: 1 }} />
          Export Network
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Fullscreen sx={{ mr: 1 }} />
          Fullscreen
        </MenuItem>
      </Menu>
    </Box>
  );
};
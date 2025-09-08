import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  CpuChipIcon,
  LinkIcon,
  EyeIcon,
  Cog6ToothIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface QlafsNode {
  id: string;
  name: string;
  type: 'agent' | 'fingerprint' | 'consensus' | 'transparency';
  trustScore: number;
  status: 'verified' | 'pending' | 'failed';
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface QlafsLink {
  source: string;
  target: string;
  type: 'trust' | 'lineage' | 'consensus';
  weight: number;
  verified: boolean;
}

interface QlafsVisualizerProps {
  agentId?: string;
  showLineage?: boolean;
  showTrustNetwork?: boolean;
  interactive?: boolean;
  height?: number;
  width?: number;
}

export const QlafsVisualizer: React.FC<QlafsVisualizerProps> = ({
  agentId,
  showLineage = true,
  showTrustNetwork = true,
  interactive = true,
  height = 500,
  width
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<QlafsNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<QlafsNode | null>(null);

  // Generate mock QLAFS network data
  const generateNetworkData = () => {
    const nodes: QlafsNode[] = [
      // Agents
      { id: 'agent-1', name: 'NLP Processor', type: 'agent', trustScore: 0.95, status: 'verified' },
      { id: 'agent-2', name: 'Intent Classifier', type: 'agent', trustScore: 0.87, status: 'verified' },
      { id: 'agent-3', name: 'Response Generator', type: 'agent', trustScore: 0.92, status: 'verified' },
      { id: 'agent-4', name: 'Sentiment Analyzer', type: 'agent', trustScore: 0.78, status: 'pending' },
      { id: 'agent-5', name: 'Entity Extractor', type: 'agent', trustScore: 0.91, status: 'verified' },
      
      // QLAFS Components
      { id: 'fingerprint-1', name: 'Static Fingerprint', type: 'fingerprint', trustScore: 0.99, status: 'verified' },
      { id: 'fingerprint-2', name: 'Behavioral Pattern', type: 'fingerprint', trustScore: 0.96, status: 'verified' },
      { id: 'consensus-1', name: 'Byzantine Consensus', type: 'consensus', trustScore: 0.98, status: 'verified' },
      { id: 'transparency-1', name: 'Audit Log', type: 'transparency', trustScore: 1.0, status: 'verified' }
    ];

    const links: QlafsLink[] = [
      // Trust relationships
      { source: 'agent-1', target: 'agent-2', type: 'trust', weight: 0.9, verified: true },
      { source: 'agent-2', target: 'agent-3', type: 'trust', weight: 0.85, verified: true },
      { source: 'agent-1', target: 'agent-5', type: 'trust', weight: 0.88, verified: true },
      
      // Lineage relationships
      { source: 'agent-1', target: 'agent-3', type: 'lineage', weight: 0.92, verified: true },
      { source: 'agent-4', target: 'agent-2', type: 'lineage', weight: 0.75, verified: false },
      
      // QLAFS verification links
      { source: 'fingerprint-1', target: 'agent-1', type: 'consensus', weight: 0.95, verified: true },
      { source: 'fingerprint-1', target: 'agent-2', type: 'consensus', weight: 0.87, verified: true },
      { source: 'fingerprint-2', target: 'agent-3', type: 'consensus', weight: 0.92, verified: true },
      { source: 'consensus-1', target: 'fingerprint-1', type: 'consensus', weight: 0.98, verified: true },
      { source: 'consensus-1', target: 'fingerprint-2', type: 'consensus', weight: 0.96, verified: true },
      { source: 'transparency-1', target: 'consensus-1', type: 'consensus', weight: 1.0, verified: true }
    ];

    return { nodes, links };
  };

  const getNodeColor = (node: QlafsNode) => {
    if (node.status === 'failed') return '#ef4444';
    if (node.status === 'pending') return '#f59e0b';
    
    switch (node.type) {
      case 'agent':
        return node.trustScore >= 0.9 ? '#10b981' : '#3b82f6';
      case 'fingerprint':
        return '#8b5cf6';
      case 'consensus':
        return '#06b6d4';
      case 'transparency':
        return '#84cc16';
      default:
        return '#6b7280';
    }
  };

  const getLinkColor = (link: QlafsLink) => {
    if (!link.verified) return '#ef4444';
    
    switch (link.type) {
      case 'trust':
        return '#10b981';
      case 'lineage':
        return '#3b82f6';
      case 'consensus':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const svgWidth = width || containerRect.width;
    const svgHeight = height;

    const { nodes, links } = generateNetworkData();

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", svgWidth)
      .attr("height", svgHeight);

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    if (interactive) {
      svg.call(zoom);
    }

    const g = svg.append("g");

    // Create force simulation
    const simulation = d3.forceSimulation<QlafsNode>(nodes)
      .force("link", d3.forceLink<QlafsNode, QlafsLink>(links)
        .id(d => d.id)
        .distance(100)
        .strength(0.1))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Create arrow markers for directed edges
    svg.append("defs")
      .selectAll("marker")
      .data(['trust', 'lineage', 'consensus'])
      .enter()
      .append("marker")
      .attr("id", d => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", d => {
        switch (d) {
          case 'trust': return '#10b981';
          case 'lineage': return '#3b82f6';
          case 'consensus': return '#8b5cf6';
          default: return '#6b7280';
        }
      });

    // Create links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", d => getLinkColor(d))
      .attr("stroke-width", d => Math.sqrt(d.weight * 5))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-dasharray", d => d.verified ? "none" : "5,5")
      .attr("marker-end", d => `url(#arrow-${d.type})`);

    // Create nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node");

    // Add circles for nodes
    node.append("circle")
      .attr("r", d => d.type === 'agent' ? 20 : 15)
      .attr("fill", d => getNodeColor(d))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", interactive ? "pointer" : "default");

    // Add icons to nodes
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "white")
      .attr("font-size", "12px")
      .text(d => {
        switch (d.type) {
          case 'agent': return '🤖';
          case 'fingerprint': return '🔍';
          case 'consensus': return '⚖️';
          case 'transparency': return '📝';
          default: return '●';
        }
      });

    // Add labels
    node.append("text")
      .attr("dx", 25)
      .attr("dy", 5)
      .attr("font-size", "10px")
      .attr("fill", "#374151")
      .text(d => d.name);

    // Add trust score labels
    node.append("text")
      .attr("dx", 25)
      .attr("dy", -5)
      .attr("font-size", "8px")
      .attr("fill", "#6b7280")
      .text(d => `Trust: ${(d.trustScore * 100).toFixed(0)}%`);

    if (interactive) {
      // Add drag behavior
      const drag = d3.drag<SVGGElement, QlafsNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });

      node.call(drag);

      // Add hover and click interactions
      node
        .on("mouseenter", (event, d) => {
          setHoveredNode(d);
          // Highlight connected nodes
          const connectedNodeIds = new Set([d.id]);
          links.forEach(link => {
            if (link.source === d.id) connectedNodeIds.add(link.target);
            if (link.target === d.id) connectedNodeIds.add(link.source);
          });
          
          node.style("opacity", n => connectedNodeIds.has(n.id) ? 1 : 0.3);
          link.style("opacity", l => 
            l.source === d.id || l.target === d.id ? 1 : 0.1
          );
        })
        .on("mouseleave", () => {
          setHoveredNode(null);
          node.style("opacity", 1);
          link.style("opacity", 0.6);
        })
        .on("click", (event, d) => {
          setSelectedNode(d);
        });
    }

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [agentId, showLineage, showTrustNetwork, interactive, height, width]);

  return (
    <div className="relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-md p-3 space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="show-lineage"
            checked={showLineage}
            onChange={() => {}}
            className="rounded"
          />
          <label htmlFor="show-lineage" className="text-xs text-gray-600">
            Show Lineage
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="show-trust"
            checked={showTrustNetwork}
            onChange={() => {}}
            className="rounded"
          />
          <label htmlFor="show-trust" className="text-xs text-gray-600">
            Trust Network
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-md p-3">
        <div className="text-xs font-medium text-gray-900 mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">High Trust Agent</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">Standard Agent</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-gray-600">Fingerprint</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
            <span className="text-gray-600">Consensus</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-lime-500"></div>
            <span className="text-gray-600">Transparency</span>
          </div>
        </div>
      </div>

      {/* Main Visualization */}
      <div 
        ref={containerRef}
        className="w-full bg-gray-50 rounded-lg border overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: 'radial-gradient(ellipse at center, #f9fafb 0%, #f3f4f6 100%)' }}
        />
      </div>

      {/* Node Details Panel */}
      {(selectedNode || hoveredNode) && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 min-w-64 max-w-80"
        >
          <div className="flex items-center space-x-3 mb-3">
            <div 
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: getNodeColor(selectedNode || hoveredNode!) }}
            />
            <div>
              <div className="font-medium text-gray-900">
                {(selectedNode || hoveredNode)!.name}
              </div>
              <div className="text-xs text-gray-500 capitalize">
                {(selectedNode || hoveredNode)!.type}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Trust Score:</span>
              <span className="font-medium">
                {((selectedNode || hoveredNode)!.trustScore * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium capitalize ${
                (selectedNode || hoveredNode)!.status === 'verified' ? 'text-green-600' :
                (selectedNode || hoveredNode)!.status === 'pending' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {(selectedNode || hoveredNode)!.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ID:</span>
              <span className="font-mono text-xs">
                {(selectedNode || hoveredNode)!.id}
              </span>
            </div>
          </div>

          {selectedNode && (
            <div className="mt-3 pt-3 border-t">
              <button
                onClick={() => setSelectedNode(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close Details
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Network Stats */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-lg font-bold text-green-600">8</div>
          <div className="text-xs text-green-600">Verified Agents</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-lg font-bold text-blue-600">94.2%</div>
          <div className="text-xs text-blue-600">Network Trust</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-lg font-bold text-purple-600">12</div>
          <div className="text-xs text-purple-600">Active Connections</div>
        </div>
        <div className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-200">
          <div className="text-lg font-bold text-cyan-600">100%</div>
          <div className="text-xs text-cyan-600">Consensus Rate</div>
        </div>
      </div>
    </div>
  );
};
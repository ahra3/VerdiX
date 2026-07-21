import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';

export async function initFailureAtlas() {
    console.log("Initializing Failure Atlas...");
    const container = document.getElementById('3d-graph-container');
    if (!container) return;

    try {
        const res = await fetch('./data/root_cause_taxonomy.json');
        const taxonomy = await res.json();
        
        // Transform taxonomy into graph data
        const nodes = [];
        const links = [];
        
        // Center node
        nodes.push({ id: 'HDFS', name: 'HDFS Cluster', group: 'core', val: 10, color: '#f0f4f8' });
        
        // Failure Modes
        const modes = Object.keys(taxonomy.failure_modes);
        modes.forEach(mode => {
            const modeData = taxonomy.failure_modes[mode];
            nodes.push({
                id: mode,
                name: mode,
                group: 'mode',
                val: 6,
                color: getModeColor(mode),
                desc: modeData.description,
                remediation: modeData.remediation?.action || 'N/A'
            });
            links.push({ source: 'HDFS', target: mode });
            
            // Key Events for this mode
            if (modeData.key_events) {
                modeData.key_events.forEach(evt => {
                    // Only add event node if it doesn't exist
                    if (!nodes.find(n => n.id === evt)) {
                        nodes.push({
                            id: evt,
                            name: evt,
                            group: 'event',
                            val: 3,
                            color: '#8b9bb4',
                            desc: taxonomy.event_templates[evt] || 'Unknown event template'
                        });
                    }
                    links.push({ source: mode, target: evt });
                });
            }
        });

        const graphData = { nodes, links };
        const overlay = document.getElementById('atlas-overlay');
        const titleEl = document.getElementById('atlas-title');
        const descEl = document.getElementById('atlas-desc');
        const metaEl = document.getElementById('atlas-meta');

        // Initialize 3D Force Graph
        const Graph = ForceGraph3D()
            (container)
            .graphData(graphData)
            .nodeAutoColorBy('group')
            .nodeRelSize(4)
            .nodeVal('val')
            .nodeLabel('name')
            .nodeColor(node => node.color)
            .linkColor(() => 'rgba(255,255,255,0.2)')
            .backgroundColor('rgba(0,0,0,0)')
            .onNodeHover(node => {
                if (node) {
                    overlay.classList.add('active');
                    titleEl.textContent = node.name;
                    titleEl.style.color = node.color;
                    descEl.textContent = node.desc || '';
                    
                    if (node.group === 'mode') {
                        metaEl.innerHTML = `<div>Remediation: <span>${node.remediation}</span></div>`;
                    } else if (node.group === 'event') {
                        metaEl.innerHTML = `<div>Type: <span>Log Event Template</span></div>`;
                    } else {
                        metaEl.innerHTML = '';
                    }
                } else {
                    overlay.classList.remove('active');
                }
            })
            .onNodeClick(node => {
                // Aim at node from outside it
                const distance = 40;
                const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
                
                Graph.cameraPosition(
                    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
                    node, // lookAt ({ x, y, z })
                    3000  // ms transition duration
                );
            });

        // Add gentle rotation
        let angle = 0;
        setInterval(() => {
            angle += Math.PI / 800;
            Graph.cameraPosition({
                x: 80 * Math.cos(angle),
                z: 80 * Math.sin(angle)
            });
        }, 30);

        // Resize handler
        window.addEventListener('resize', () => {
            Graph.width(container.clientWidth);
            Graph.height(container.clientHeight);
        });

    } catch (err) {
        console.error("Failed to load taxonomy for Atlas:", err);
    }
}

function getModeColor(mode) {
    const colors = {
        'WRITE_PATH_FAILURE': '#ef4444',
        'EMPTY_PACKET_LOOP': '#f59e0b',
        'SERVE_FAILURE': '#3b82f6',
        'METADATA_INCONSISTENCY': '#eab308',
        'REPLICATION_FAILURE': '#a855f7',
        'BLOCK_LIFECYCLE_ERROR': '#ec4899',
        'INCOMPLETE_PIPELINE': '#991b1b',
        'SILENT_RECOVERY': '#10b981'
    };
    return colors[mode] || '#ffffff';
}

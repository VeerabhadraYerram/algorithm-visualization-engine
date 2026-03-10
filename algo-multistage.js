/**
 * algo-multistage.js
 * Multistage Graph Shortest Path (DP) Visualization Plugin for Labyrinth.
 * Nodes are laid out left-to-right in stage columns; edges are directed (arrows).
 */

(function () {
    'use strict';

    if (!window.Labyrinth) {
        console.error("Labyrinth core not found. algo-multistage.js must be loaded after algo-core.js");
        return;
    }

    const { COLORS, drawNode, drawLine, State } = window.Labyrinth;

    // ── Stage-based color palette ────────────────────────────────────────────
    const STAGE_COLORS = [
        '#e3f2fd', // Stage 1 – light blue
        '#f3e5f5', // Stage 2 – light purple
        '#e8f5e9', // Stage 3 – light green
        '#fff3e0', // Stage 4 – light orange
        '#fce4ec', // Stage 5 – light pink
        '#e0f7fa', // Stage 6 – light cyan
    ];

    const STAGE_BORDER_COLORS = [
        '#90caf9',
        '#ce93d8',
        '#a5d6a7',
        '#ffcc80',
        '#f48fb1',
        '#80deea',
    ];

    window.Labyrinth.registerAlgorithm({
        id: 'multistage',
        name: "Multistage Graph SP (DP)",
        fields: [
            { id: 'edges', label: 'All Edges [(u,v,w),...]', type: 'graph' },
            { id: 'stages', label: 'Stages Dict {node:stage}', type: 'any' },
            { id: 'cost', label: 'Cost Dict {node:cost}', type: 'any' },
            { id: 'next_node', label: 'Next-Node Dict', type: 'any' },
            { id: 'current_node', label: 'Current Node', type: 'any' },
            { id: 'current_edge', label: 'Current Edge (tup)', type: 'any' },
            { id: 'path', label: 'Shortest Path (List)', type: 'any' }
        ],

        // ── Custom stage-aware layout ────────────────────────────────────────
        layout(state, globals) {
            const edgeVar = state.mappings['edges'];
            const stagesVar = state.mappings['stages'];
            if (!edgeVar) return;

            const rawEdges = globals[edgeVar] || [];
            const stagesMap = globals[stagesVar] || {};

            const validEdges = rawEdges.filter(e => Array.isArray(e) && e.length >= 2);
            const nodes = [...new Set(validEdges.flatMap(e => [String(e[0]), String(e[1])]))];
            if (nodes.length === 0) return;

            const W = State.canvas.width || 600;
            const H = State.canvas.height || 400;

            // Group nodes by stage
            const stageGroups = {};
            let maxStage = 1;
            nodes.forEach(n => {
                const s = stagesMap[n] || stagesMap[parseInt(n)] || 1;
                if (!stageGroups[s]) stageGroups[s] = [];
                stageGroups[s].push(n);
                if (s > maxStage) maxStage = s;
            });

            const numStages = maxStage;
            const padX = 80;
            const padY = 60;
            const usableW = W - 2 * padX;
            const usableH = H - 2 * padY;

            State.nodePositions = {};

            for (let s = 1; s <= numStages; s++) {
                const group = stageGroups[s] || [];
                const x = padX + ((s - 1) / Math.max(numStages - 1, 1)) * usableW;

                group.forEach((n, i) => {
                    const totalInStage = group.length;
                    const y = padY + ((i + 1) / (totalInStage + 1)) * usableH;
                    State.nodePositions[n] = { x, y };
                });
            }

            // Store stage metadata for rendering
            this._stageGroups = stageGroups;
            this._numStages = numStages;
            this._padX = padX;
        },

        // ── Render ───────────────────────────────────────────────────────────
        render(ctx, state, globals) {
            const edgeVar = state.mappings['edges'];
            if (!edgeVar) return;

            // Run custom layout if node positions are empty or stages changed
            const stagesVar = state.mappings['stages'];
            const stagesMap = globals[stagesVar] || {};
            if (Object.keys(state.nodePositions).length === 0 || this._needsRelayout) {
                this.layout(state, globals);
                this._needsRelayout = false;
            }

            // Also relayout if edges mapping changed
            if (this._lastEdgeVar !== edgeVar || this._lastStagesVar !== stagesVar) {
                this.layout(state, globals);
                this._lastEdgeVar = edgeVar;
                this._lastStagesVar = stagesVar;
            }

            const allEdgesRaw = globals[edgeVar] || [];
            const costState = globals[state.mappings['cost']] || {};
            const nextNodeMap = globals[state.mappings['next_node']] || {};
            const currentNode = globals[state.mappings['current_node']];
            const currentEdge = globals[state.mappings['current_edge']];
            const pathState = globals[state.mappings['path']] || [];

            const W = State.canvas.width || 600;
            const H = State.canvas.height || 400;

            // ── 0. Draw stage background columns ─────────────────────────────
            const numStages = this._numStages || 1;
            const padX = this._padX || 80;
            const colW = (W - 2 * padX) / Math.max(numStages, 1) + (padX * 2 / numStages);

            for (let s = 1; s <= numStages; s++) {
                const colIdx = (s - 1) % STAGE_COLORS.length;
                const x = (s - 1) * (W / numStages);
                const w = W / numStages;

                ctx.fillStyle = STAGE_COLORS[colIdx];
                ctx.globalAlpha = 0.35;
                ctx.fillRect(x, 0, w, H);
                ctx.globalAlpha = 1.0;

                // Stage divider
                if (s < numStages) {
                    ctx.strokeStyle = STAGE_BORDER_COLORS[colIdx];
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(x + w, 0);
                    ctx.lineTo(x + w, H);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Stage label
                ctx.fillStyle = '#555';
                ctx.font = 'bold 12px Segoe UI, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Stage ${s}`, x + w / 2, 20);
            }

            // ── Build path edge set ──────────────────────────────────────────
            const pathEdgeSet = new Set();
            if (Array.isArray(pathState) && pathState.length > 1) {
                for (let i = 0; i < pathState.length - 1; i++) {
                    pathEdgeSet.add(dirEdgeKey(pathState[i], pathState[i + 1]));
                }
            }

            // ── Current edge key ─────────────────────────────────────────────
            const currKey = (Array.isArray(currentEdge) && currentEdge.length >= 2)
                ? dirEdgeKey(currentEdge[0], currentEdge[1])
                : null;

            // ── Build next_node edge set (settled DP decisions) ──────────────
            const dpEdgeSet = new Set();
            Object.entries(nextNodeMap).forEach(([node, next]) => {
                if (next !== null && next !== undefined) {
                    dpEdgeSet.add(dirEdgeKey(node, next));
                }
            });

            // ── 1. Draw all edges (directed arrows) ─────────────────────────
            allEdgesRaw.forEach(e => {
                if (!Array.isArray(e) || e.length < 2) return;
                const u = String(e[0]), v = String(e[1]), w = e[2];
                const p1 = state.nodePositions[u], p2 = state.nodePositions[v];
                if (!p1 || !p2) return;

                const key = dirEdgeKey(u, v);

                let color = COLORS.edgeNone;
                let width = 1.5;

                if (key === currKey) {
                    color = COLORS.edgeCurr || '#ff9800';
                    width = 4;
                } else if (pathEdgeSet.has(key)) {
                    color = '#1565c0'; // Bold blue for final shortest path
                    width = 4;
                } else if (dpEdgeSet.has(key)) {
                    color = COLORS.edgeAccept || '#2ecc71';
                    width = 3;
                }

                drawArrow(ctx, p1, p2, color, width, String(w));
            });

            // ── 2. Draw nodes ────────────────────────────────────────────────
            // Determine which nodes are "finalized" (have a finite cost)
            const pathNodeSet = new Set((pathState || []).map(String));

            Object.entries(state.nodePositions).forEach(([id, pos]) => {
                let fill = COLORS.nodeFill;
                let stroke = COLORS.nodeStroke;

                if (String(currentNode) === id) {
                    stroke = COLORS.edgeCurr || '#ff9800';
                    fill = '#ffe0b2';
                } else if (pathNodeSet.has(id) && pathState.length > 1) {
                    stroke = '#1565c0';
                    fill = '#bbdefb';
                } else if (costState[id] !== undefined && costState[id] !== null
                    && (typeof costState[id] !== 'number' || costState[id] < 99999)) {
                    stroke = COLORS.edgeAccept || '#2ecc71';
                    fill = '#c8e6c9';
                }

                drawNode(pos, id, stroke, fill);

                // ── 3. Draw cost labels above nodes ──────────────────────────
                let c = costState[id];
                if (c === undefined || c === null) {
                    c = '∞';
                } else if (typeof c === 'number' && c > 99999) {
                    c = '∞';
                }

                ctx.fillStyle = '#d32f2f';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`cost=${c}`, pos.x, pos.y - 25);

                // Draw next-node pointer below
                const nxt = nextNodeMap[id];
                if (nxt !== null && nxt !== undefined) {
                    ctx.fillStyle = '#666';
                    ctx.font = '10px sans-serif';
                    ctx.fillText(`→ ${nxt}`, pos.x, pos.y + 32);
                }
            });

            // ── 4. Update description ────────────────────────────────────────
            const desc = document.getElementById('aviz-description');
            if (desc) {
                if (currentEdge && Array.isArray(currentEdge) && currentEdge.length >= 3) {
                    const stg = stagesMap[currentNode] || stagesMap[String(currentNode)] || '?';
                    desc.innerHTML = `<b>Stage ${stg}</b> — Checking edge <b>(${currentEdge[0]} → ${currentEdge[1]})</b> with weight ${currentEdge[2]}. ` +
                        `Candidate cost = ${currentEdge[2]} + cost[${currentEdge[1]}] = <b>${currentEdge[2] + (costState[String(currentEdge[1])] || 0)}</b>`;
                } else if (currentNode !== null && currentNode !== undefined) {
                    const stg = stagesMap[currentNode] || stagesMap[String(currentNode)] || '?';
                    desc.innerHTML = `Processing node <b>${currentNode}</b> in Stage <b>${stg}</b>. Current cost: <b>${costState[String(currentNode)] || '∞'}</b>`;
                } else if (pathState && pathState.length > 1) {
                    desc.innerHTML = `✅ <b>Shortest path found:</b> ${pathState.join(' → ')} with cost <b>${costState['1'] || costState[1] || '?'}</b>`;
                } else {
                    desc.innerHTML = `Multistage Graph Shortest Path (DP). Map your variables above to begin.`;
                }
            }
        }
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Directed edge key (order matters) */
    function dirEdgeKey(u, v) {
        return String(u) + '--->' + String(v);
    }

    /** Draw a line with an arrowhead at p2 */
    function drawArrow(ctx, p1, p2, color, width, label) {
        const nodeRadius = 20;
        const headLen = 12;

        // Shorten the line so it stops at the node boundary
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const ux = dx / dist;
        const uy = dy / dist;

        // Start from edge of source node, end at edge of target node
        const x1 = p1.x + ux * nodeRadius;
        const y1 = p1.y + uy * nodeRadius;
        const x2 = p2.x - ux * nodeRadius;
        const y2 = p2.y - uy * nodeRadius;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - headLen * Math.cos(angle - Math.PI / 6),
            y2 - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            x2 - headLen * Math.cos(angle + Math.PI / 6),
            y2 - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Draw weight label
        if (label && label !== 'undefined') {
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;

            // Offset label perpendicular to edge to avoid overlap
            const perpX = -uy * 14;
            const perpY = ux * 14;
            const lx = mx + perpX;
            const ly = my + perpY;

            const tw = ctx.measureText(label).width + 8;
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(lx - tw / 2, ly - 9, tw, 18);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(lx - tw / 2, ly - 9, tw, 18);
            ctx.fillStyle = '#555';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, lx, ly);
        }
    }

})();

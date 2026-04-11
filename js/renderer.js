/**
 * ============================================================
 *  State Diagram Renderer
 *  Draws PDA states (circles) and transitions (arrows)
 *  on an HTML5 <canvas> element.
 * ============================================================
 */

class StateDiagramRenderer {

    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // PDA data
        this.states = [];
        this.transitions = [];
        this.startState = '';
        this.acceptStates = [];

        // Layout
        this.positions = {};   // state name → {x, y}
        this.baseRadius = 28;   // default radius, auto-scaled for many states
        this.stateRadius = 28;

        // Highlight state (for animation)
        this.activeState = null;
        this.activeTransition = null; // {from, to}
        this.isRejected = false; // red highlight mode

        // Drag state
        this.draggedState = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.hoveredState = null;

        // Handle high-DPI screens
        this.dpr = window.devicePixelRatio || 1;
        this._resizeBound = this.resize.bind(this);
        window.addEventListener('resize', this._resizeBound);

        this._initEvents();

        // Observe theme changes and redraw
        this._themeObserver = new MutationObserver(() => this.draw());
        this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    /** Returns true if the current theme is dark. */
    _isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    /** Returns theme-appropriate color palette (neutral grayscale). */
    _colors() {
        const dark = this._isDark();
        return {
            emptyText:    dark ? '#555' : '#9ca3af',
            stateFill:    dark ? 'rgba(30,30,30,0.95)' : 'rgba(249,250,251,0.95)',
            stateStroke:  dark ? '#555' : '#9ca3af',
            stateLabel:   dark ? '#ccc' : '#374151',
            activeLabel:  dark ? '#fff' : '#111',
            lineColor:    dark ? '#555' : '#9ca3af',
            activeLine:   dark ? '#fff' : '#111',
            activeGlow:   dark ? '#fff' : '#111',
            activeHl:     dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            activeStroke: dark ? '#fff' : '#111',
            shadowColor:  dark ? '#fff' : '#111',
            startArrow:   dark ? '#ccc' : '#374151',
            rejectFill:   dark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
            rejectStroke: '#ef4444',
            labelBg:      dark ? 'rgba(20,20,20,0.9)' : 'rgba(249,250,251,0.95)',
            labelBgActive:dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            labelText:    dark ? '#aaa' : '#6b7280',
            labelActive:  dark ? '#fff' : '#111',
        };
    }

    // ── Public API ───────────────────────────────────────────

    /** Load PDA structure and redraw. */
    configure(states, transitions, startState, acceptStates) {
        this.states = states;
        this.transitions = transitions;
        this.startState = startState;
        this.acceptStates = acceptStates;
        this.activeState = null;
        this.activeTransition = null;
        this.layout();
        this.draw();
    }

    /** Highlight a state (and optional transition). Call draw() after. */
    highlight(state, transition) {
        this.activeState = state || null;
        this.activeTransition = transition || null;
        this.isRejected = false;
        this.draw();
    }

    /** Highlight a state in RED to show rejection. */
    highlightRejected(state) {
        this.activeState = state || null;
        this.activeTransition = null;
        this.isRejected = true;
        this.draw();
    }

    /** Clear all highlights. */
    clearHighlights() {
        this.activeState = null;
        this.activeTransition = null;
        this.isRejected = false;
        this.draw();
    }

    /** Fit canvas to its container. */
    resize() {
        const container = this.canvas.parentElement;
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.layout();
        this.draw();
    }

    // ── Layout ───────────────────────────────────────────────

    /**
     * Place states evenly around a circle.
     * Auto-scales the state radius and layout radius so that
     * any number of states can be displayed without overlapping.
     */
    layout() {
        const w = this.canvas.clientWidth || 400;
        const h = this.canvas.clientHeight || 300;
        const cx = w / 2;
        const cy = h / 2;
        const n = this.states.length;

        if (n === 0) return;

        // ── Auto-scale state radius for many states ──────────
        // For ≤4 states keep the default 28px.
        // For more, shrink so circles don't overlap on the ring.
        if (n <= 4) {
            this.stateRadius = this.baseRadius;
        } else if (n <= 8) {
            this.stateRadius = Math.max(20, this.baseRadius - (n - 4) * 2);
        } else {
            this.stateRadius = Math.max(14, this.baseRadius - 8 - (n - 8));
        }

        // ── Layout radius: make the ring as large as possible ─
        // Leave padding = stateRadius + space for labels
        const padding = this.stateRadius + 40;
        const maxR = Math.min(cx, cy) - padding;

        // For the ring to avoid overlap, the arc between
        // adjacent states must be ≥ 2.5× the state radius.
        const minRingR = (n * this.stateRadius * 2.5) / (2 * Math.PI);
        const ringR = Math.max(minRingR, Math.min(maxR, Math.min(cx, cy) * 0.55));

        if (n === 1) {
            this.positions[this.states[0]] = { x: cx, y: cy };
            return;
        }

        // Special case: 2 states → horizontal layout
        if (n === 2) {
            const spread = Math.min(ringR, (w - padding * 2) / 2);
            this.positions[this.states[0]] = { x: cx - spread, y: cy };
            this.positions[this.states[1]] = { x: cx + spread, y: cy };
            return;
        }

        // General case: distribute around a circle
        this.states.forEach((s, i) => {
            const angle = (2 * Math.PI * i / n) - Math.PI / 2;
            this.positions[s] = {
                x: cx + ringR * Math.cos(angle),
                y: cy + ringR * Math.sin(angle),
            };
        });
    }

    // ── Drawing ──────────────────────────────────────────────

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);

        if (this.states.length === 0) {
            ctx.fillStyle = this._colors().emptyText;
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Load a PDA to see the state diagram', w / 2, h / 2);
            return;
        }

        // Group transitions by (from, to) for combined labels
        const grouped = this._groupTransitions();

        // Pass 1: Draw arrow lines + arrowheads (below states)
        for (const key of Object.keys(grouped)) {
            const { from, to, labels } = grouped[key];
            this._drawTransitionLine(from, to, labels);
        }

        // Draw start arrow
        this._drawStartArrow();

        // Pass 2: Draw each state (on top of arrows)
        for (const s of this.states) {
            this._drawState(s);
        }

        // Pass 3: Draw labels on top of everything
        for (const key of Object.keys(grouped)) {
            const { from, to, labels } = grouped[key];
            this._drawTransitionLabel(from, to, labels);
        }
    }

    // ── State circle ─────────────────────────────────────────

    _drawState(name) {
        const ctx = this.ctx;
        const pos = this.positions[name];
        if (!pos) return;

        const r = this.stateRadius;
        const isAccept = this.acceptStates.includes(name);
        const isActive = this.activeState === name;
        const isRejState = isActive && this.isRejected;

        ctx.save();

        const c = this._colors();
        // Glow for active state (purple = normal, red = rejected)
        if (isActive) {
            ctx.shadowBlur = 22;
            ctx.shadowColor = isRejState ? c.rejectStroke : c.shadowColor;
        }

        // Outer circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        if (isRejState) {
            ctx.fillStyle = c.rejectFill;
            ctx.strokeStyle = c.rejectStroke;
        } else if (isActive) {
            ctx.fillStyle = c.activeHl;
            ctx.strokeStyle = c.activeStroke;
        } else {
            ctx.fillStyle = c.stateFill;
            ctx.strokeStyle = c.stateStroke;
        }
        ctx.lineWidth = isActive ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Double circle for accept state
        if (isAccept) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r - 5, 0, Math.PI * 2);
            ctx.strokeStyle = isRejState ? c.rejectStroke : (isActive ? c.activeStroke : c.stateStroke);
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        ctx.restore();

        // Label — auto-size font to fit inside the circle
        ctx.fillStyle = isActive ? c.activeLabel : c.stateLabel;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Pick a font size that fits the state name inside the circle
        let fontSize = r > 24 ? 13 : (r > 18 ? 11 : 9);
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        // Shrink further if the label is wider than the circle
        let tw = ctx.measureText(name).width;
        while (tw > r * 1.6 && fontSize > 7) {
            fontSize--;
            ctx.font = `600 ${fontSize}px Inter, sans-serif`;
            tw = ctx.measureText(name).width;
        }
        ctx.fillText(name, pos.x, pos.y);
    }

    // ── Start arrow ──────────────────────────────────────────

    _drawStartArrow() {
        const pos = this.positions[this.startState];
        if (!pos) return;
        const ctx = this.ctx;
        const r = this.stateRadius;

        const startX = pos.x - r - 32;
        const endX = pos.x - r - 2;
        const y = pos.y;

        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        const c = this._colors();
        ctx.strokeStyle = c.startArrow;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        this._arrowHead(endX, y, 0, c.startArrow);
    }

    // ── Transitions (arrows between / self-loop) ─────────────

    _groupTransitions() {
        const map = {};
        for (const t of this.transitions) {
            const key = t.from + '→' + t.to;
            if (!map[key]) {
                map[key] = { from: t.from, to: t.to, labels: [] };
            }
            const pushLabel = t.stackPush === 'ε' ? 'ε' : t.stackPush;
            map[key].labels.push(`${t.input}, ${t.stackPop} / ${pushLabel}`);
        }
        return map;
    }

    // ── Shared: compute transition geometry ─────────────────
    _transitionGeometry(from, to) {
        const p1 = this.positions[from];
        const p2 = this.positions[to];
        if (!p1 || !p2) return null;

        const isActive = this.activeTransition &&
            this.activeTransition.from === from &&
            this.activeTransition.to === to;

        const reverseExists = this.transitions.some(
            t => t.from === to && t.to === from
        );

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const r = this.stateRadius;

        const curveAmount = reverseExists ? 40 : 0;
        const nx = -Math.sin(angle) * curveAmount;
        const ny = Math.cos(angle) * curveAmount;

        const sx = p1.x + r * Math.cos(angle) + nx * 0.3;
        const sy = p1.y + r * Math.sin(angle) + ny * 0.3;
        const ex = p2.x - r * Math.cos(angle) + nx * 0.3;
        const ey = p2.y - r * Math.sin(angle) + ny * 0.3;

        const cpx = (sx + ex) / 2 + nx;
        const cpy = (sy + ey) / 2 + ny;

        return { p1, p2, isActive, reverseExists, angle, r, sx, sy, ex, ey, cpx, cpy };
    }

    // Pass 1: Draw arrow line + arrowhead only
    _drawTransitionLine(from, to, labels) {
        if (from === to) {
            this._drawSelfLoopLine(from, labels);
            return;
        }

        const g = this._transitionGeometry(from, to);
        if (!g) return;

        const ctx = this.ctx;
        const c = this._colors();
        const color = g.isActive ? c.activeLine : c.lineColor;
        const lw = g.isActive ? 2.2 : 1.3;

        ctx.save();
        if (g.isActive) { ctx.shadowBlur = 8; ctx.shadowColor = c.activeGlow; }

        ctx.beginPath();
        ctx.moveTo(g.sx, g.sy);
        ctx.quadraticCurveTo(g.cpx, g.cpy, g.ex, g.ey);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();

        // Arrowhead
        const t = 0.98;
        const tangentX = 2 * (1 - t) * (g.cpx - g.sx) + 2 * t * (g.ex - g.cpx);
        const tangentY = 2 * (1 - t) * (g.cpy - g.sy) + 2 * t * (g.ey - g.cpy);
        const endAngle = Math.atan2(tangentY, tangentX);
        this._arrowHead(g.ex, g.ey, endAngle, color);
    }

    // Pass 3: Draw label only (on top of everything)
    _drawTransitionLabel(from, to, labels) {
        if (from === to) {
            this._drawSelfLoopLabel(from, labels);
            return;
        }

        const g = this._transitionGeometry(from, to);
        if (!g) return;

        // Base offset - dynamically increased to physically clear long label background boxes
        const labelOffsetDist = g.reverseExists ? 22 : 38;
        
        let perpX = -Math.sin(g.angle) * labelOffsetDist;
        let perpY = Math.cos(g.angle) * labelOffsetDist;

        // For straight lines, ensure the label is pushed ABOVE the line.
        // If the normal vector points DOWN (perpY > 0), flip it 180 degrees.
        if (!g.reverseExists && perpY > 0.01) {
            perpX = -perpX;
            perpY = -perpY;
        }

        const labelX = g.cpx + perpX;
        const labelY = g.cpy + perpY;
        this._drawLabel(labels, labelX, labelY, g.isActive);
    }

    // ── Self-loop (line pass) ────────────────────────────────

    _drawSelfLoopLine(state, labels) {
        const ctx = this.ctx;
        const pos = this.positions[state];
        if (!pos) return;

        const isActive = this.activeTransition &&
            this.activeTransition.from === state &&
            this.activeTransition.to === state;

        const r = this.stateRadius;
        const loopR = 18;
        const cx = pos.x;
        const cy = pos.y - r - loopR + 2;

        const c = this._colors();
        const color = isActive ? c.activeLine : c.lineColor;
        const lw = isActive ? 2.2 : 1.3;

        ctx.save();
        if (isActive) { ctx.shadowBlur = 8; ctx.shadowColor = c.activeGlow; }

        ctx.beginPath();
        ctx.arc(cx, cy, loopR, 0.3, Math.PI * 2 - 0.3);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();

        // Arrowhead
        const endAngle = Math.PI * 2 - 0.3;
        const ax = cx + loopR * Math.cos(endAngle);
        const ay = cy + loopR * Math.sin(endAngle);
        this._arrowHead(ax, ay, endAngle + Math.PI / 2.5, color);
    }

    // ── Self-loop (label pass) ───────────────────────────────

    _drawSelfLoopLabel(state, labels) {
        const pos = this.positions[state];
        if (!pos) return;

        const isActive = this.activeTransition &&
            this.activeTransition.from === state &&
            this.activeTransition.to === state;

        const r = this.stateRadius;
        const loopR = 18;
        const cx = pos.x;
        const cy = pos.y - r - loopR + 2;

        const topOfLoop = cy - loopR;
        const labelGap = 16;
        const totalHeight = labels.length * labelGap;
        const startY = topOfLoop - 10 - totalHeight + labelGap;

        labels.forEach((label, i) => {
            const ly = startY + i * labelGap;
            this._drawSingleLabel(label, cx, ly, isActive);
        });
    }

    // ── Arrow head ───────────────────────────────────────────

    _arrowHead(x, y, angle, color) {
        const ctx = this.ctx;
        const size = 9;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size / 2.2);
        ctx.lineTo(-size, size / 2.2);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    // ── Single label with background ─────────────────────────

    _drawSingleLabel(label, x, y, isActive) {
        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `500 10px 'JetBrains Mono', monospace`;

        const tw = ctx.measureText(label).width + 10;
        const th = 15;
        const c = this._colors();

        // Background pill with higher opacity for readability
        ctx.fillStyle = isActive ? c.labelBgActive : c.labelBg;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - tw / 2, y - th / 2, tw, th, 4);
        } else {
            ctx.rect(x - tw / 2, y - th / 2, tw, th);
        }
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Subtle border for pill
        ctx.strokeStyle = isActive ? (this._isDark() ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)') : 'transparent';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Text
        ctx.fillStyle = isActive ? c.labelActive : c.labelText;
        ctx.fillText(label, x, y);
    }

    // ── Label group for transition (multi-label) ─────────────

    _drawLabel(labels, x, y, isActive) {
        const labelGap = 16;
        const totalHeight = labels.length * labelGap;
        const startY = y - totalHeight / 2 + labelGap / 2;

        labels.forEach((label, i) => {
            const ly = startY + i * labelGap;
            this._drawSingleLabel(label, x, ly, isActive);
        });
    }

    // ── Mouse Events for Dragging ────────────────────────────

    _initEvents() {
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this._onMouseUp());
        this.canvas.addEventListener('mouseleave', () => this._onMouseUp());
    }

    _getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * this.dpr,
            y: (e.clientY - rect.top) * this.dpr
        };
    }

    _getStateAt(x, y) {
        for (const state of this.states) {
            const pos = this.positions[state];
            if (!pos) continue;
            const dx = x - pos.x;
            const dy = y - pos.y;
            // Give a slightly larger hit area for easier grabbing
            if (dx * dx + dy * dy <= (this.stateRadius + 5) * (this.stateRadius + 5)) {
                return state;
            }
        }
        return null;
    }

    _onMouseDown(e) {
        const pos = this._getMousePos(e);
        const state = this._getStateAt(pos.x, pos.y);
        if (state) {
            this.draggedState = state;
            this.dragOffsetX = pos.x - this.positions[state].x;
            this.dragOffsetY = pos.y - this.positions[state].y;
            this.canvas.style.cursor = 'grabbing';
            // Optional: Draw once to show immediate interaction
            this.draw();
        }
    }

    _onMouseMove(e) {
        const pos = this._getMousePos(e);
        if (this.draggedState) {
            this.positions[this.draggedState].x = pos.x - this.dragOffsetX;
            this.positions[this.draggedState].y = pos.y - this.dragOffsetY;
            this.draw();
        } else {
            const state = this._getStateAt(pos.x, pos.y);
            if (state !== this.hoveredState) {
                this.hoveredState = state;
                this.canvas.style.cursor = state ? 'grab' : 'default';
            }
        }
    }

    _onMouseUp() {
        if (this.draggedState) {
            this.draggedState = null;
            this.canvas.style.cursor = this.hoveredState ? 'grab' : 'default';
        }
    }
}

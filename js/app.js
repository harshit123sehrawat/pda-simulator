/**
 * ============================================================
 *  App Controller  (v5 — GeoGebra-style, collapsible sidebar)
 * ============================================================
 *
 *  Modules:
 *    1.  DOM refs
 *    2.  Engine & Renderer
 *    3.  Simulation state
 *    4.  Stack colours
 *    5.  Build PDA from form
 *    6.  Preset examples
 *    7.  Input position visualizer
 *    8.  Active transition display
 *    9.  Simulation control (Run / Step / Reset)
 *    10. Display a single step
 *    11. Stack animations
 *    12. Trace table
 *    13. UI helpers (status, speed, result)
 *    14. Sidebar toggle + resize
 *    15. Trace panel toggle + resize + fullscreen
 *    16. Event listeners
 *    17. Initialise
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // Initialise Lucide icons
    if (window.lucide) lucide.createIcons();

    console.log('[PDA] DOM ready — initialising…');

    // ═══════════════════════════════════════════════════════════
    //  1. DOM REFERENCES
    // ═══════════════════════════════════════════════════════════

    function $(id) {
        var el = document.getElementById(id);
        if (!el) console.warn('[PDA] Missing #' + id);
        return el;
    }

    var dom = {
        // Toolbar
        exampleSelect: $('example-select'),
        inputString: $('input-string'),
        btnRun: $('btn-run'),
        btnStep: $('btn-step'),
        btnReset: $('btn-reset'),
        speedSlider: $('speed-slider'),
        speedLabel: $('speed-label'),

        // Sidebar
        sidebar: $('sidebar'),
        sidebarHandle: $('sidebar-handle'),
        btnSidebarToggle: $('btn-sidebar-toggle'),
        btnSidebarClose: $('btn-sidebar-close'),
        statesInput: $('states-input'),
        inputAlphabet: $('input-alphabet'),
        stackAlphabet: $('stack-alphabet'),
        initialStack: $('initial-stack-symbol'),
        startState: $('start-state'),
        acceptStates: $('accept-states'),
        transitionsInput: $('transitions-input'),
        btnEpsilon: $('btn-insert-epsilon'),

        // Rail & Generator
        btnTabAutomata: $('btn-tab-automata'),
        btnTabConfig: $('btn-tab-config'),
        paneAutomata: $('pane-automata'),
        paneConfig: $('pane-config'),
        sidebarTitle: $('sidebar-title'),
        langInput: $('lang-input'),
        btnGeneratePda: $('btn-generate-pda'),
        genReport: $('gen-report'),
        genBadges: $('gen-badges'),
        genDecision: $('gen-decision'),
        genReason: $('gen-reason'),
        genExamples: $('gen-examples'),
        genExAcc: $('gen-ex-acc'),
        genExRej: $('gen-ex-rej'),
        genValidation: $('gen-validation'),
        genValResults: $('gen-val-results'),
        pdaModeToggle: $('pda-mode-toggle'),

        // Canvas area
        canvasArea: $('canvas-area'),
        viewport: $('viewport'),
        stateDiagram: $('state-diagram'),
        btnZoomIn: $('btn-zoom-in'),
        btnZoomOut: $('btn-zoom-out'),
        btnZoomReset: $('btn-zoom-reset'),

        // Stack panel overlay
        simStatus: $('sim-status'),
        currentState: $('current-state'),
        remainingInput: $('remaining-input'),
        stackVisual: $('stack-visual'),

        // Floating overlays
        inputPosition: $('input-position'),
        inputPosChars: $('input-pos-chars'),
        activeTransition: $('active-transition'),
        activeTransText: $('active-trans-text'),
        resultBanner: $('result-banner'),

        // Trace panel
        tracePanel: $('trace-panel'),
        traceHandle: $('trace-handle'),
        traceHeader: $('trace-header'),
        traceChevron: $('trace-chevron'),
        traceStepCount: $('trace-step-count'),
        btnTraceFullscreen: $('btn-trace-fullscreen'),
        traceBody: $('trace-body'),
        tracePlaceholder: $('trace-placeholder'),

        // Trace fullscreen overlay
        traceOverlay: $('trace-overlay'),
        btnTraceClose: $('btn-trace-close'),
        traceBodyFull: $('trace-body-full'),
    };

    // ═══════════════════════════════════════════════════════════
    //  2. ENGINE & RENDERER
    // ═══════════════════════════════════════════════════════════

    var engine = new PDAEngine();
    var renderer = new StateDiagramRenderer($('state-diagram'));

    // ═══════════════════════════════════════════════════════════
    //  3. SIMULATION STATE
    // ═══════════════════════════════════════════════════════════

    var trace = [];
    var stepIndex = -1;
    var animTimer = null;
    var isRunning = false;
    var lastResult = null;
    var fullInputString = '';

    // ═══════════════════════════════════════════════════════════
    //  4. STACK COLOUR MAPPING
    // ═══════════════════════════════════════════════════════════

    var symbolColors = {};
    var neutralPalette = ['#374151', '#6b7280', '#4b5563', '#1f2937', '#9ca3af', '#111827', '#52525b', '#71717a', '#3f3f46', '#a1a1aa'];
    var hueIdx = 0;

    function colorFor(sym) {
        if (!symbolColors[sym]) {
            symbolColors[sym] = neutralPalette[hueIdx % neutralPalette.length];
            hueIdx++;
        }
        return symbolColors[sym];
    }

    // ═══════════════════════════════════════════════════════════
    //  5. BUILD PDA FROM FORM
    // ═══════════════════════════════════════════════════════════

    function csv(str) {
        return str.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function buildPDA() {
        var parsed = PDAEngine.parseTransitions(dom.transitionsInput.value);
        var config = {
            states: csv(dom.statesInput.value),
            inputAlphabet: csv(dom.inputAlphabet.value),
            stackAlphabet: csv(dom.stackAlphabet.value),
            initialStackSymbol: dom.initialStack.value.trim() || 'Z',
            startState: dom.startState.value.trim(),
            acceptStates: csv(dom.acceptStates.value),
            transitions: parsed,
        };
        engine.configure(config);
        renderer.configure(config.states, config.transitions,
            config.startState, config.acceptStates);
        return config;
    }

    // ═══════════════════════════════════════════════════════════
    //  6. PRESET EXAMPLES
    // ═══════════════════════════════════════════════════════════

    function loadExample(key) {
        var ex = PDAEngine.getExamples()[key];
        if (!ex) return;
        dom.statesInput.value = ex.states.join(', ');
        dom.inputAlphabet.value = ex.inputAlphabet.join(', ');
        dom.stackAlphabet.value = ex.stackAlphabet.join(', ');
        dom.initialStack.value = ex.initialStackSymbol;
        dom.startState.value = ex.startState;
        dom.acceptStates.value = ex.acceptStates.join(', ');
        dom.inputString.value = ex.sampleInputs ? ex.sampleInputs[0] : '';
        dom.transitionsInput.value = ex.transitions.map(function (t) {
            return t.from + ', ' + t.input + ', ' + t.stackPop +
                ' -> ' + t.to + ', ' + t.stackPush;
        }).join('\n');
        resetSimulation();
        buildPDA();
    }

    // ═══════════════════════════════════════════════════════════
    //  7. INPUT POSITION VISUALIZER
    // ═══════════════════════════════════════════════════════════

    function buildInputVisualizer(str) {
        fullInputString = str;
        dom.inputPosChars.innerHTML = '';
        if (!str || !str.length) {
            dom.inputPosition.classList.add('hidden');
            return;
        }
        dom.inputPosition.classList.remove('hidden');
        for (var i = 0; i < str.length; i++) {
            var el = document.createElement('span');
            el.className = 'input-char remaining';
            el.textContent = str[i];
            dom.inputPosChars.appendChild(el);
        }
    }

    function updateInputVisualizer(consumed, readChar) {
        var chars = dom.inputPosChars.querySelectorAll('.input-char');
        for (var i = 0; i < chars.length; i++) {
            chars[i].className = 'input-char ' + (
                i < consumed
                    ? 'consumed'
                    : i === consumed && readChar !== 'ε' && readChar !== '-'
                        ? 'current'
                        : 'remaining'
            );
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  8. ACTIVE TRANSITION DISPLAY
    // ═══════════════════════════════════════════════════════════

    function showActiveTransition(step) {
        if (!step || step.type === 'initial') {
            dom.activeTransition.classList.add('hidden');
            return;
        }
        dom.activeTransition.classList.remove('hidden');
        dom.activeTransText.textContent =
            'δ(' + step.from + ', ' + step.input + ', ' + step.stackPop +
            ') → (' + step.to + ', ' + step.stackPush + ')';
    }

    function hideActiveTransition() {
        dom.activeTransition.classList.add('hidden');
    }

    // ═══════════════════════════════════════════════════════════
    //  9. SIMULATION CONTROL
    // ═══════════════════════════════════════════════════════════

    function startRun() {
        resetSimulation();
        buildPDA();
        var v = engine.validate();
        if (!v.valid) { showResult(false, 'Invalid PDA: ' + v.errors.join(' ')); return; }

        var str = dom.inputString.value;
        var result = engine.run(str);
        lastResult = result;
        trace = result.trace;
        stepIndex = 0;
        isRunning = true;

        buildInputVisualizer(str);
        setStatus('running');
        expandTrace();               // auto-expand trace during run
        dom.btnStep.disabled = true;
        dom.btnRun.disabled = true;
        showStep(0);

        var speed = getSpeedMs();
        animTimer = setInterval(function () {
            if (stepIndex < trace.length - 1) {
                stepIndex++;
                showStep(stepIndex);
            } else {
                stopAnim();
                finishSimulation(result);
            }
        }, speed);
    }

    function stepOnce() {
        if (trace.length === 0) {
            resetSimulation();
            buildPDA();
            var v = engine.validate();
            if (!v.valid) { showResult(false, 'Invalid: ' + v.errors.join(' ')); return; }

            var str = dom.inputString.value;
            var result = engine.run(str);
            lastResult = result;
            trace = result.trace;
            stepIndex = 0;
            isRunning = true;
            buildInputVisualizer(str);
            setStatus('running');
            expandTrace();
            showStep(0);
            if (trace.length <= 1) finishSimulation(result);
            return;
        }
        stopAnim();
        dom.btnRun.disabled = false;
        if (stepIndex < trace.length - 1) {
            stepIndex++;
            showStep(stepIndex);
            if (stepIndex >= trace.length - 1) {
                finishSimulation(lastResult || { accepted: false, message: 'String rejected.' });
            }
        }
    }

    function resetSimulation() {
        stopAnim();
        if (popTimer) { clearTimeout(popTimer); popTimer = null; }
        trace = []; stepIndex = -1;
        isRunning = false; lastResult = null;
        previousStack = null; hueIdx = 0;
        Object.keys(symbolColors).forEach(function (k) { delete symbolColors[k]; });

        setStatus('ready');
        dom.currentState.textContent = '—';
        dom.remainingInput.textContent = '—';
        dom.stackVisual.innerHTML = '<div class="stack-empty-msg">Empty</div>';
        dom.traceBody.innerHTML = '';
        dom.traceBodyFull.innerHTML = '';
        dom.tracePlaceholder.style.display = '';
        dom.traceStepCount.textContent = '';
        hideResult();
        hideActiveTransition();
        renderer.clearHighlights();

        dom.btnStep.disabled = false;
        dom.btnRun.disabled = false;
        dom.inputPosition.classList.add('hidden');
        dom.inputPosChars.innerHTML = '';
        dom.canvasArea.classList.remove('reject-flash', 'reject-shake');
        dom.stackVisual.classList.remove('reject-shake');
    }

    function stopAnim() {
        if (animTimer) { clearInterval(animTimer); animTimer = null; }
        dom.btnStep.disabled = false;
        dom.btnRun.disabled = false;
    }

    function finishSimulation(result) {
        stopAnim();
        isRunning = false;
        showResult(result.accepted, result.message);
        setStatus(result.accepted ? 'done-accept' : 'done-reject');
        if (!result.accepted) {
            dom.canvasArea.classList.remove('reject-flash', 'reject-shake');
            void dom.canvasArea.offsetWidth;
            dom.canvasArea.classList.add('reject-flash', 'reject-shake');
            dom.stackVisual.classList.remove('reject-shake');
            void dom.stackVisual.offsetWidth;
            dom.stackVisual.classList.add('reject-shake');
            var last = trace[trace.length - 1];
            if (last) renderer.highlightRejected(last.state);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  10. DISPLAY A SINGLE STEP
    // ═══════════════════════════════════════════════════════════

    var previousStack = null;
    var popTimer = null;

    function showStep(idx) {
        var step = trace[idx];
        if (!step) return;

        dom.currentState.textContent = step.state;
        dom.remainingInput.textContent = step.remaining || 'ε';

        if (step.transition) renderer.highlight(step.state, { from: step.from, to: step.to });
        else renderer.highlight(step.state, null);

        var consumed = fullInputString.length - (step.remaining ? step.remaining.length : 0);
        updateInputVisualizer(consumed, step.input);
        showActiveTransition(step);

        if (popTimer) { clearTimeout(popTimer); popTimer = null; }
        var hasPop = step.stackPop && step.stackPop !== '-';
        var hasPush = step.stackPush && step.stackPush !== '-' && step.stackPush !== 'ε';
        var pushN = hasPush ? step.stackPush.length : 0;

        if (hasPop && previousStack && previousStack.length > 0) {
            animatePopItem();
            popTimer = setTimeout(function () {
                rebuildStack(step.stack, pushN);
                previousStack = step.stack.slice();
                popTimer = null;
            }, 280);
        } else {
            rebuildStack(step.stack, step.type === 'initial' ? -1 : pushN);
            previousStack = step.stack.slice();
        }

        addTraceRow(step);
        dom.tracePlaceholder.style.display = 'none';
        dom.traceStepCount.textContent = 'Step ' + step.step + '/' + (trace.length - 1);
    }

    // ═══════════════════════════════════════════════════════════
    //  11. STACK ANIMATIONS
    // ═══════════════════════════════════════════════════════════

    function animatePopItem() {
        var top = dom.stackVisual.querySelector('.stack-item');
        if (top) top.classList.add('popping');
    }

    function rebuildStack(stack, pushN) {
        dom.stackVisual.innerHTML = '';
        if (!stack || !stack.length) {
            dom.stackVisual.innerHTML = '<div class="stack-empty-msg">Empty</div>';
            return;
        }
        stack.forEach(function (sym, i) {
            var el = document.createElement('div');
            el.className = 'stack-item';
            el.style.setProperty('--item-color', colorFor(sym));
            el.textContent = sym;
            if (pushN === -1) {
                el.classList.add('pushing');
                el.style.setProperty('--push-delay', (i * 50) + 'ms');
            } else if (i < pushN) {
                el.classList.add('pushing');
                el.style.setProperty('--push-delay', (i * 70) + 'ms');
            } else {
                el.classList.add('static');
            }
            dom.stackVisual.appendChild(el);
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  12. TRACE TABLE  (inline + fullscreen sync)
    // ═══════════════════════════════════════════════════════════

    function addTraceRow(step) {
        var prev = dom.traceBody.querySelector('.active-step');
        if (prev) prev.classList.remove('active-step');
        var prevF = dom.traceBodyFull.querySelector('.active-step');
        if (prevF) prevF.classList.remove('active-step');

        var stackStr = step.stack.length ? step.stack.join(' ') : 'ε';
        var remaining = step.remaining || '(empty)';

        // Inline row
        var tr = document.createElement('tr');
        tr.classList.add('active-step');
        tr.innerHTML =
            '<td>' + step.step + '</td>' +
            '<td>' + step.state + '</td>' +
            '<td>' + step.input + '</td>' +
            '<td>' + step.stackPop + '</td>' +
            '<td>' + step.stackPush + '</td>' +
            '<td>' + remaining + '</td>' +
            '<td>' + stackStr + '</td>';
        dom.traceBody.appendChild(tr);
        tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Fullscreen row (clone)
        var tr2 = tr.cloneNode(true);
        dom.traceBodyFull.appendChild(tr2);
    }

    // ═══════════════════════════════════════════════════════════
    //  13. UI HELPERS
    // ═══════════════════════════════════════════════════════════

    function getSpeedMs() {
        return 1300 - parseInt(dom.speedSlider.value, 10) * 120;
    }

    function setStatus(s) {
        var b = dom.simStatus;
        b.className = 'status-badge';
        if (s === 'ready') b.textContent = 'Ready';
        else if (s === 'running') { b.textContent = 'Running…'; b.classList.add('running'); }
        else if (s === 'done-accept') { b.textContent = 'Accepted ✓'; b.classList.add('done-accept'); }
        else if (s === 'done-reject') { b.textContent = 'Rejected ✗'; b.classList.add('done-reject'); }
    }

    var bannerTimer = null;

    function showResult(ok, msg) {
        if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
        dom.resultBanner.className = 'result-banner ' + (ok ? 'accepted' : 'rejected');
        dom.resultBanner.innerHTML =
            '<span class="text-xl">' + (ok ? '✓' : '✗') + '</span>' +
            '<span>' + msg + '</span>';
        bannerTimer = setTimeout(function () {
            hideResult();
            bannerTimer = null;
        }, 3000);
    }

    function hideResult() {
        if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
        dom.resultBanner.className = 'result-banner hidden';
    }

    // ═══════════════════════════════════════════════════════════
    //  14. SIDEBAR TOGGLE + RESIZE
    // ═══════════════════════════════════════════════════════════

    var SIDEBAR_WIDTH = 340;
    var sidebarOpen = false;

    function toggleSidebar() {
        sidebarOpen ? closeSidebar() : openSidebar();
    }

    function openSidebar() {
        sidebarOpen = true;
        dom.sidebar.style.width = SIDEBAR_WIDTH + 'px';
        dom.sidebarHandle.style.display = 'block';
        // Resize canvas after transition
        setTimeout(function () { renderer.resize(); }, 320);
    }

    function closeSidebar() {
        sidebarOpen = false;
        dom.sidebar.style.width = '0';
        dom.sidebarHandle.style.display = 'none';
        setTimeout(function () { renderer.resize(); }, 320);
    }

    // Sidebar drag resize
    (function initSidebarResize() {
        var handle = dom.sidebarHandle;
        var dragging = false;

        handle.addEventListener('mousedown', function (e) {
            e.preventDefault();
            dragging = true;
            handle.classList.add('active');
            document.body.classList.add('no-select');
        });

        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var newW = Math.min(500, Math.max(260, e.clientX));
            SIDEBAR_WIDTH = newW;
            dom.sidebar.style.transition = 'none';
            dom.sidebar.style.width = newW + 'px';
            renderer.resize();
        });

        document.addEventListener('mouseup', function () {
            if (!dragging) return;
            dragging = false;
            handle.classList.remove('active');
            document.body.classList.remove('no-select');
            dom.sidebar.style.transition = '';
        });
    })();

    // ═══════════════════════════════════════════════════════════
    //  15. ZOOM & PAN (GeoGebra style)
    // ═══════════════════════════════════════════════════════════

    (function initZoomAndPan() {
        var scale = 1;
        var panX = 0;
        var panY = 0;
        var isDragging = false;
        var startX = 0;
        var startY = 0;
        var MIN_ZOOM = 0.5;
        var MAX_ZOOM = 3.0;

        var viewport = dom.viewport;
        var canvas = dom.stateDiagram;

        function updateTransform() {
            canvas.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
            canvas.style.transformOrigin = 'center center';
        }

        function zoomIn() {
            if (scale < MAX_ZOOM) {
                scale = Math.min(MAX_ZOOM, scale + 0.1);
                updateTransform();
            }
        }

        function zoomOut() {
            if (scale > MIN_ZOOM) {
                scale = Math.max(MIN_ZOOM, scale - 0.1);
                updateTransform();
            }
        }

        function resetZoom() {
            scale = 1;
            panX = 0;
            panY = 0;
            updateTransform();
        }

        if (dom.btnZoomIn) dom.btnZoomIn.addEventListener('click', zoomIn);
        if (dom.btnZoomOut) dom.btnZoomOut.addEventListener('click', zoomOut);
        if (dom.btnZoomReset) dom.btnZoomReset.addEventListener('click', resetZoom);

        if (viewport) {
            viewport.addEventListener('wheel', function (e) {
                e.preventDefault();
                if (e.deltaY < 0) zoomIn();
                else zoomOut();
            }, { passive: false });

            viewport.addEventListener('mousedown', function (e) {
                if (e.target.closest('.zoom-controls') || e.target.closest('#stack-panel') || e.target.closest('.glass-bar')) return;
                
                isDragging = true;
                startX = e.clientX - panX;
                startY = e.clientY - panY;
                viewport.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', function (e) {
                if (!isDragging) return;
                panX = e.clientX - startX;
                panY = e.clientY - startY;
                updateTransform();
            });

            document.addEventListener('mouseup', function () {
                if (isDragging) {
                    isDragging = false;
                    viewport.style.cursor = '';
                }
            });
        }
    })();

    // ═══════════════════════════════════════════════════════════
    //  15. TRACE PANEL TOGGLE + RESIZE + FULLSCREEN
    // ═══════════════════════════════════════════════════════════

    var TRACE_COLLAPSED = 42;
    var TRACE_EXPANDED = 220;
    var traceExpanded = false;

    function toggleTrace() {
        traceExpanded ? collapseTrace() : expandTrace();
    }

    function expandTrace() {
        traceExpanded = true;
        dom.tracePanel.style.height = TRACE_EXPANDED + 'px';
        dom.traceChevron.classList.add('expanded');
        setTimeout(function () { renderer.resize(); }, 50);
    }

    function collapseTrace() {
        traceExpanded = false;
        dom.tracePanel.style.height = TRACE_COLLAPSED + 'px';
        dom.traceChevron.classList.remove('expanded');
        setTimeout(function () { renderer.resize(); }, 50);
    }

    // Trace drag resize
    (function initTraceResize() {
        var handle = dom.traceHandle;
        var dragging = false;
        var workspace = $('workspace');

        handle.addEventListener('mousedown', function (e) {
            e.preventDefault();
            dragging = true;
            handle.classList.add('active');
            document.body.classList.add('no-select-row');
        });

        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var wsRect = workspace.getBoundingClientRect();
            var newH = Math.min(wsRect.height * 0.6, Math.max(TRACE_COLLAPSED, wsRect.bottom - e.clientY));
            dom.tracePanel.style.height = newH + 'px';
            TRACE_EXPANDED = newH;
            traceExpanded = newH > TRACE_COLLAPSED + 10;
            if (traceExpanded) dom.traceChevron.classList.add('expanded');
            else dom.traceChevron.classList.remove('expanded');
            renderer.resize();
        });

        document.addEventListener('mouseup', function () {
            if (!dragging) return;
            dragging = false;
            handle.classList.remove('active');
            document.body.classList.remove('no-select-row');
        });
    })();

    // Trace fullscreen overlay
    function openTraceFullscreen() {
        dom.traceOverlay.classList.remove('hidden');
    }

    function closeTraceFullscreen() {
        dom.traceOverlay.classList.add('hidden');
    }

    // ═══════════════════════════════════════════════════════════
    //  16. EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════

    // ── Rail Navigation ────────────────────────────────────────

    if (dom.btnTabAutomata) {
        dom.btnTabAutomata.addEventListener('click', function () {
            if (!sidebarOpen) openSidebar();
            else closeSidebar();
        });
    }

    // ── DPDA / NPDA Toggle Wiring ──────────────────────────────
    if (dom.pdaModeToggle) {
        var modeButtons = dom.pdaModeToggle.querySelectorAll('.pda-mode-btn');
        modeButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                modeButtons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                // Re-initialize Lucide icons for SVG rendering
                if (window.lucide) lucide.createIcons();
            });
        });
    }

    /**
     * Get the currently selected PDA mode from the toggle.
     * @returns {'DPDA'|'NPDA'}
     */
    function getSelectedPDAMode() {
        var activeBtn = dom.pdaModeToggle
            ? dom.pdaModeToggle.querySelector('.pda-mode-btn.active')
            : null;
        return activeBtn ? activeBtn.getAttribute('data-mode') : 'DPDA';
    }

    // ── Language Parser Hook ────────────────────────────────────
    if (dom.btnGeneratePda) {
        dom.btnGeneratePda.addEventListener('click', function () {
            var lang = dom.langInput.value.trim();
            var mode = getSelectedPDAMode();

            // Reset report
            dom.genReport.classList.add('hidden');
            dom.genExamples.classList.add('hidden');
            dom.genValidation.classList.add('hidden');
            dom.genBadges.innerHTML = '';

            if (!lang) {
                dom.genDecision.innerHTML = '❌ Error';
                dom.genReason.textContent = 'Please enter a language string.';
                dom.genReport.classList.remove('hidden');
                dom.genReport.className = 'flex flex-col gap-1.5 p-2.5 rounded-md border text-[11px] leading-tight mt-2 bg-red-500/10 border-red-500/20';
                dom.genDecision.className = 'flex items-center gap-2 font-bold mb-0.5 text-red-400';
                return;
            }

            try {
                var config = LanguageParser.parse(lang, mode);

                // ── Determine theme ──────────────────────────
                var isDPDA = config.pdaType === 'DPDA';
                var isNPDA = config.pdaType === 'NPDA';

                var bgClass = isDPDA ? 'bg-green-500/10 border-green-500/20' : 'bg-cyan-500/10 border-cyan-500/20';
                var textClass = isDPDA ? 'text-green-400' : 'text-cyan-400';
                var icon = isDPDA ? '✅' : '⚡';
                var typeLabel = isDPDA ? 'DPDA' : 'NPDA';

                // ── Badges ───────────────────────────────────
                var classNames = {
                    'REGULAR': 'Regular',
                    'SINGLE_DEPENDENCY': 'Single Dependency CFL',
                    'LINEAR': 'Linear Relation CFL',
                    'NESTED': 'Nested Structure',
                    'PALINDROME_MARKED': 'Marked Palindrome',
                    'PALINDROME': 'Palindrome (Mirror)',
                };
                var className = classNames[config.classification] || config.classification;

                dom.genBadges.innerHTML =
                    '<span class="gen-badge gen-badge-class">' + className + '</span>' +
                    '<span class="gen-badge gen-badge-' + (isDPDA ? 'dpda' : 'npda') + '">' + typeLabel + '</span>';

                // ── UX Messages (mandatory) ──────────────────
                if (isDPDA) {
                    dom.genDecision.innerHTML = icon + ' DPDA generated successfully';
                } else {
                    dom.genDecision.innerHTML = icon + ' Only NPDA possible for this language';
                }
                dom.genReason.textContent = config.reason || 'PDA constructed successfully.';

                // ── Examples ─────────────────────────────────
                if (config.examples) {
                    dom.genExamples.classList.remove('hidden');
                    var accStrs = config.examples.accepted.map(function(s) { return s === '' ? 'ε' : s; });
                    var rejStrs = config.examples.rejected.map(function(s) { return s === '' ? 'ε' : s; });
                    dom.genExAcc.textContent = accStrs.join(', ') || 'N/A';
                    dom.genExRej.textContent = rejStrs.join(', ') || 'N/A';
                }

                // ── Validation Results ───────────────────────
                if (config.validation && config.validation.tests && config.validation.tests.length > 0) {
                    dom.genValidation.classList.remove('hidden');
                    var allPass = config.validation.valid;
                    var html = '';
                    for (var i = 0; i < config.validation.tests.length; i++) {
                        var t = config.validation.tests[i];
                        var passIcon = t.pass ? '✓' : '✗';
                        var passColor = t.pass ? 'text-green-400' : 'text-red-400';
                        html += '<div class="flex items-center gap-1.5 font-mono text-[10px]">' +
                            '<span class="' + passColor + ' font-bold">' + passIcon + '</span>' +
                            '<span class="text-slate-400">"' + t.input + '"</span>' +
                            '<span class="text-slate-600">→</span>' +
                            '<span class="text-slate-500">expected ' + t.expected + '</span>' +
                            '<span class="text-slate-600">|</span>' +
                            '<span class="' + (t.pass ? 'text-slate-400' : 'text-red-400') + '">got ' + t.actual + '</span>' +
                            '</div>';
                    }
                    var summaryBadge = allPass
                        ? '<span class="text-green-400 font-bold text-[10px]">All tests passed ✓</span>'
                        : '<span class="text-red-400 font-bold text-[10px]">Some tests failed ✗</span>';
                    dom.genValResults.innerHTML = html + '<div class="mt-1">' + summaryBadge + '</div>';
                }

                dom.genReport.className = 'flex flex-col gap-1.5 p-2.5 rounded-md border text-[11px] leading-tight mt-2 ' + bgClass;
                dom.genDecision.className = 'flex items-center gap-2 font-bold mb-0.5 ' + textClass;
                dom.genReport.classList.remove('hidden');

                // ── Auto-fill configuration fields ───────────
                dom.statesInput.value = config.states.join(', ');
                dom.inputAlphabet.value = config.inputAlphabet.join(', ');
                dom.stackAlphabet.value = config.stackAlphabet.join(', ');
                dom.initialStack.value = config.initialStackSymbol;
                dom.startState.value = config.startState;
                dom.acceptStates.value = config.acceptStates.join(', ');
                dom.transitionsInput.value = config.transitionsStr;

                // Auto-fill sample input
                if (config.sampleInput !== undefined) {
                    dom.inputString.value = config.sampleInput;
                }

                dom.exampleSelect.value = "";
                resetSimulation();
                buildPDA();

            } catch (err) {
                var reasonStr = err.message;
                var classification = '';
                var pType = 'NOT_POSSIBLE';
                var status = 'error';
                try {
                    var data = JSON.parse(err.message);
                    reasonStr = data.reason || err.message;
                    classification = data.classification || '';
                    pType = data.pdaType || 'NOT_POSSIBLE';
                    status = data.status || 'error';
                } catch (e) { }

                // ── Build badges ─────────────────────────────
                dom.genBadges.innerHTML = '';
                var classNameMap = {
                    'PALINDROME': 'Palindrome (Mirror)',
                    'MULTI_DEPENDENCY': 'Multi-Dependency',
                    'UNKNOWN': 'Unknown'
                };

                if (classification) {
                    var clsLabel = classNameMap[classification] || classification;

                    // Determine right badge based on status
                    var rightBadge = '';
                    if (status === 'warning' && pType === 'NPDA_ONLY') {
                        rightBadge = '<span class="gen-badge gen-badge-warn">NPDA Only</span>';
                    } else {
                        rightBadge = '<span class="gen-badge gen-badge-reject">Not Possible</span>';
                    }

                    dom.genBadges.innerHTML =
                        '<span class="gen-badge gen-badge-class">' + clsLabel + '</span>' +
                        rightBadge;
                }

                // ── Determine report theming ─────────────────
                if (status === 'warning') {
                    // Yellow warning: DPDA not possible, switch to NPDA
                    dom.genDecision.innerHTML = '⚠️ DPDA not possible';
                    dom.genReason.textContent = reasonStr;
                    dom.genReport.className = 'flex flex-col gap-1.5 p-2.5 rounded-md border text-[11px] leading-tight mt-2 bg-yellow-500/10 border-yellow-500/20';
                    dom.genDecision.className = 'flex items-center gap-2 font-bold mb-0.5 text-yellow-400';
                } else {
                    // Red/orange error: Not context-free
                    dom.genDecision.innerHTML = '❌ Language is not context-free. PDA not possible.';
                    dom.genReason.textContent = reasonStr;
                    dom.genReport.className = 'flex flex-col gap-1.5 p-2.5 rounded-md border text-[11px] leading-tight mt-2 bg-orange-500/10 border-orange-500/20';
                    dom.genDecision.className = 'flex items-center gap-2 font-bold mb-0.5 text-orange-400';
                }

                dom.genReport.classList.remove('hidden');
            }
        });
    }

    dom.btnSidebarToggle.addEventListener('click', toggleSidebar);
    dom.btnSidebarClose.addEventListener('click', closeSidebar);

    dom.traceHeader.addEventListener('click', function (e) {
        // Don't toggle if clicking the fullscreen button
        if (e.target.closest('#btn-trace-fullscreen')) return;
        toggleTrace();
    });
    dom.btnTraceFullscreen.addEventListener('click', openTraceFullscreen);
    dom.btnTraceClose.addEventListener('click', closeTraceFullscreen);

    dom.exampleSelect.addEventListener('change', function (e) {
        if (e.target.value) loadExample(e.target.value);
    });

    dom.btnRun.addEventListener('click', startRun);
    dom.btnStep.addEventListener('click', stepOnce);
    dom.btnReset.addEventListener('click', resetSimulation);

    dom.speedSlider.addEventListener('input', function () {
        dom.speedLabel.textContent = dom.speedSlider.value + '×';
        if (animTimer) {
            stopAnim();
            dom.btnStep.disabled = true;
            dom.btnRun.disabled = true;
            animTimer = setInterval(function () {
                if (stepIndex < trace.length - 1) {
                    stepIndex++;
                    showStep(stepIndex);
                } else {
                    stopAnim();
                    finishSimulation(lastResult || { accepted: false, message: 'Done.' });
                }
            }, getSpeedMs());
        }
    });

    dom.btnEpsilon.addEventListener('click', function () {
        var ta = dom.transitionsInput;
        var s = ta.selectionStart;
        var e = ta.selectionEnd;
        ta.value = ta.value.substring(0, s) + 'ε' + ta.value.substring(e);
        ta.selectionStart = ta.selectionEnd = s + 1;
        ta.focus();
    });

    // Live-rebuild diagram on any config change
    [dom.statesInput, dom.inputAlphabet, dom.stackAlphabet,
    dom.initialStack, dom.startState, dom.acceptStates,
    dom.transitionsInput].forEach(function (el) {
        if (el) el.addEventListener('input', function () {
            try { buildPDA(); } catch (e) { /* ignore partial input */ }
        });
    });

    // Keyboard shortcut: Ctrl+B toggles sidebar
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleSidebar();
        }
        // Escape closes fullscreen trace
        if (e.key === 'Escape') {
            closeTraceFullscreen();
        }
    });

    // ═══════════════════════════════════════════════════════════
    //  17. INITIALISE
    // ═══════════════════════════════════════════════════════════

    renderer.resize();
    loadExample('balanced-parens');
    dom.exampleSelect.value = 'balanced-parens';

    console.log('[PDA] App ready ✓ — sidebar hidden, use ☰ or Ctrl+B to toggle');
});

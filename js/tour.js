/**
 * ============================================================
 *  Guided Tour — First-time user onboarding
 * ============================================================
 *
 *  Features:
 *    - Tooltip-style overlay with spotlight highlight
 *    - Next / Back / Skip navigation
 *    - Progress indicator (1/5)
 *    - Dimmed background overlay
 *    - Smooth animations with CSS transitions
 *    - Shown only once (localStorage flag)
 *    - Restart from settings gear
 * ============================================================
 */

(function () {
    'use strict';

    var VISITED_KEY = 'pda-tour-visited';

    // ── Tour Steps Definition ───────────────────────────────
    var STEPS = [
        {
            target: 'lang-input',
            title: 'Language Input',
            text: 'Enter your formal language definition here — e.g. {a^n b^n | n ≥ 0}',
            position: 'right',
            requireSidebar: true
        },
        {
            target: 'pda-mode-toggle',
            title: 'Automaton Type',
            text: 'Choose between DPDA (deterministic) and NPDA (nondeterministic) mode.',
            position: 'right',
            requireSidebar: true
        },
        {
            target: 'btn-generate-pda',
            title: 'Generate PDA',
            text: 'Click to auto-construct a PDA from your language description.',
            position: 'right',
            requireSidebar: true
        },
        {
            target: 'stack-panel',
            title: 'Output Panel',
            text: 'View your generated automaton details — stack state, current status, and remaining input.',
            position: 'left'
        },
        {
            target: 'canvas-area',
            title: 'PDA Visualization',
            text: 'Interact with the PDA diagram visually. States and transitions are rendered here in real-time.',
            position: 'top'
        }
    ];

    var currentStep = 0;
    var overlay = null;
    var spotlight = null;
    var tooltip = null;
    var isActive = false;

    // ── Create DOM Overlay ──────────────────────────────────
    function createOverlay() {
        // Main overlay backdrop
        overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.className = 'tour-overlay';

        // Spotlight cutout
        spotlight = document.createElement('div');
        spotlight.id = 'tour-spotlight';
        spotlight.className = 'tour-spotlight';

        // Tooltip
        tooltip = document.createElement('div');
        tooltip.id = 'tour-tooltip';
        tooltip.className = 'tour-tooltip';

        document.body.appendChild(overlay);
        document.body.appendChild(spotlight);
        document.body.appendChild(tooltip);

        // Click overlay to dismiss (optional)
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                // Don't dismiss, just ignore
            }
        });
    }

    // ── Remove Overlay ──────────────────────────────────────
    function removeOverlay() {
        if (overlay) { overlay.remove(); overlay = null; }
        if (spotlight) { spotlight.remove(); spotlight = null; }
        if (tooltip) { tooltip.remove(); tooltip = null; }
    }

    // ── Ensure sidebar is open for sidebar-targeted steps ───
    function ensureSidebarOpen() {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && parseInt(sidebar.style.width) < 100) {
            var toggleBtn = document.getElementById('btn-tab-automata');
            if (toggleBtn) toggleBtn.click();
            return true; // sidebar was closed, we opened it
        }
        return false;
    }

    // ── Show Step ───────────────────────────────────────────
    function showStep(idx) {
        if (idx < 0 || idx >= STEPS.length) return;
        currentStep = idx;
        var step = STEPS[idx];

        // Open sidebar if needed
        if (step.requireSidebar) {
            var opened = ensureSidebarOpen();
            if (opened) {
                // Wait for sidebar animation to finish
                setTimeout(function () { positionStep(step, idx); }, 380);
                return;
            }
        }

        positionStep(step, idx);
    }

    function positionStep(step, idx) {
        var targetEl = document.getElementById(step.target);
        if (!targetEl) {
            // Skip this step if element not found
            if (idx < STEPS.length - 1) showStep(idx + 1);
            else endTour();
            return;
        }

        var rect = targetEl.getBoundingClientRect();
        var padding = 8;

        // Position spotlight
        spotlight.style.top = (rect.top - padding) + 'px';
        spotlight.style.left = (rect.left - padding) + 'px';
        spotlight.style.width = (rect.width + padding * 2) + 'px';
        spotlight.style.height = (rect.height + padding * 2) + 'px';
        spotlight.style.borderRadius = '12px';

        // Animate spotlight in
        spotlight.classList.remove('tour-spotlight-hidden');
        spotlight.classList.add('tour-spotlight-visible');

        // Build tooltip content
        var progressDots = '';
        for (var i = 0; i < STEPS.length; i++) {
            progressDots += '<span class="tour-dot' + (i === idx ? ' tour-dot-active' : '') + '"></span>';
        }

        tooltip.innerHTML =
            '<div class="tour-tooltip-header">' +
            '<span class="tour-tooltip-step">' + (idx + 1) + '/' + STEPS.length + '</span>' +
            '<button class="tour-skip-btn" id="tour-btn-skip" title="Skip tour">✕</button>' +
            '</div>' +
            '<h3 class="tour-tooltip-title">' + step.title + '</h3>' +
            '<p class="tour-tooltip-text">' + step.text + '</p>' +
            '<div class="tour-tooltip-progress">' + progressDots + '</div>' +
            '<div class="tour-tooltip-nav">' +
            (idx > 0 ? '<button class="tour-btn tour-btn-back" id="tour-btn-back">← Back</button>' : '<span></span>') +
            (idx < STEPS.length - 1
                ? '<button class="tour-btn tour-btn-next" id="tour-btn-next">Next →</button>'
                : '<button class="tour-btn tour-btn-finish" id="tour-btn-finish">Done ✓</button>') +
            '</div>';

        // Position tooltip based on step.position
        positionTooltip(rect, step.position);

        // Animate tooltip
        tooltip.classList.remove('tour-tooltip-hidden');
        tooltip.classList.add('tour-tooltip-visible');

        // Bind buttons
        var skipBtn = document.getElementById('tour-btn-skip');
        var backBtn = document.getElementById('tour-btn-back');
        var nextBtn = document.getElementById('tour-btn-next');
        var finishBtn = document.getElementById('tour-btn-finish');

        if (skipBtn) skipBtn.addEventListener('click', endTour);
        if (backBtn) backBtn.addEventListener('click', function () { showStep(currentStep - 1); });
        if (nextBtn) nextBtn.addEventListener('click', function () { showStep(currentStep + 1); });
        if (finishBtn) finishBtn.addEventListener('click', endTour);
    }

    function positionTooltip(rect, position) {
        var tooltipW = 320;
        var gap = 16;
        var scrollX = window.scrollX || window.pageXOffset;
        var scrollY = window.scrollY || window.pageYOffset;
        var vw = window.innerWidth;
        var vh = window.innerHeight;

        tooltip.style.width = tooltipW + 'px';
        // Reset all positions
        tooltip.style.top = '';
        tooltip.style.left = '';
        tooltip.style.bottom = '';
        tooltip.style.right = '';

        switch (position) {
            case 'right':
                tooltip.style.top = Math.max(8, Math.min(vh - 300, rect.top)) + 'px';
                tooltip.style.left = Math.min(vw - tooltipW - 16, rect.right + gap) + 'px';
                break;
            case 'left':
                tooltip.style.top = Math.max(8, rect.top) + 'px';
                tooltip.style.left = Math.max(8, rect.left - tooltipW - gap) + 'px';
                break;
            case 'top':
                tooltip.style.top = Math.max(80, rect.top - 200) + 'px';
                tooltip.style.left = Math.max(8, Math.min(vw - tooltipW - 16, rect.left + rect.width / 2 - tooltipW / 2)) + 'px';
                break;
            case 'bottom':
                tooltip.style.top = (rect.bottom + gap) + 'px';
                tooltip.style.left = Math.max(8, Math.min(vw - tooltipW - 16, rect.left + rect.width / 2 - tooltipW / 2)) + 'px';
                break;
            default:
                tooltip.style.top = (rect.bottom + gap) + 'px';
                tooltip.style.left = Math.max(8, rect.left) + 'px';
        }
    }

    // ── End Tour ────────────────────────────────────────────
    function endTour() {
        isActive = false;
        localStorage.setItem(VISITED_KEY, 'true');

        // Animate out
        if (overlay) overlay.classList.add('tour-overlay-hiding');
        if (spotlight) spotlight.classList.add('tour-spotlight-hidden');
        if (tooltip) tooltip.classList.add('tour-tooltip-hidden');

        setTimeout(function () {
            removeOverlay();
        }, 350);
    }

    // ── Start Tour ──────────────────────────────────────────
    function startTour() {
        if (isActive) return;
        isActive = true;
        currentStep = 0;

        createOverlay();

        // Fade in overlay
        requestAnimationFrame(function () {
            overlay.classList.add('tour-overlay-visible');
            showStep(0);
        });
    }

    // ── Public API for restart ──────────────────────────────
    window.PDA_Tour = {
        start: function () {
            startTour();
        },
        restart: function () {
            localStorage.removeItem(VISITED_KEY);
            startTour();
        }
    };

    // ── Auto-start on first visit ───────────────────────────
    function init() {
        if (!localStorage.getItem(VISITED_KEY)) {
            // Small delay so the app finishes rendering
            setTimeout(function () {
                startTour();
            }, 800);
        }

        // Wire up settings button to restart tour
        var settingsBtn = document.getElementById('btn-tab-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function () {
                window.PDA_Tour.restart();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

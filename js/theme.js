/**
 * ============================================================
 *  Theme System — Light (default) / Dark mode toggle
 * ============================================================
 *
 *  - Default = LIGHT (white/neutral)
 *  - Dark = black/gray grayscale (no blue glow)
 *  - Persistent preference via localStorage
 *  - Floating toggle button (bottom-right)
 * ============================================================
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'pda-theme';
    var DEFAULT_THEME = 'light';

    // ── Resolve initial theme ───────────────────────────────
    function getInitialTheme() {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return DEFAULT_THEME;
    }

    // ── Apply theme ─────────────────────────────────────────
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        updateToggleButton(theme);
        updateTailwindOverrides(theme);
    }

    // ── Update toggle button icon ───────────────────────────
    function updateToggleButton(theme) {
        var btn = document.getElementById('theme-toggle-btn');
        if (!btn) return;
        var icon = btn.querySelector('.theme-toggle-icon');
        if (icon) {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
        btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        btn.classList.remove('theme-toggle-pop');
        void btn.offsetWidth;
        btn.classList.add('theme-toggle-pop');
    }

    // ── Tailwind overrides ──────────────────────────────────
    // The HTML uses Tailwind classes with hardcoded dark-blue colors.
    // We override them depending on the theme.
    function updateTailwindOverrides(theme) {
        var id = 'tw-theme-overrides';
        var existing = document.getElementById(id);
        if (existing) existing.remove();

        var style = document.createElement('style');
        style.id = id;

        if (theme === 'light') {
            style.textContent = `
                /* ── LIGHT MODE OVERRIDES ─────────────────────── */

                body,
                .bg-pda-bg {
                    background-color: var(--bg-color) !important;
                    color: var(--text-color) !important;
                }
                .bg-pda-panel,
                .bg-pda-panel\\/90 {
                    background-color: var(--panel-bg) !important;
                }
                .bg-pda-surface {
                    background-color: var(--surface-bg) !important;
                    color: var(--text-color) !important;
                }
                .border-pda-border {
                    border-color: var(--border-color) !important;
                }
                .text-slate-200,
                .text-slate-300 {
                    color: var(--text-color) !important;
                }
                .text-slate-400 {
                    color: var(--text-muted) !important;
                }
                .text-slate-500,
                .text-slate-600 {
                    color: var(--text-faint) !important;
                }
                .hover\\:bg-white\\/5:hover {
                    background-color: rgba(0, 0, 0, 0.04) !important;
                }
                .active\\:bg-white\\/10:active {
                    background-color: rgba(0, 0, 0, 0.06) !important;
                }
                #canvas-area {
                    background-color: var(--bg-color) !important;
                }
                #trace-overlay {
                    background-color: rgba(255, 255, 255, 0.96) !important;
                }
                .hover\\:bg-white\\/\\[0\\.02\\]:hover {
                    background-color: rgba(0, 0, 0, 0.02) !important;
                }
                .glass-bar {
                    background: rgba(255, 255, 255, 0.92) !important;
                    border-color: var(--border-color) !important;
                    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08) !important;
                }
                #stack-panel {
                    background: rgba(255, 255, 255, 0.95) !important;
                    border-color: var(--border-color) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
                }
                .result-banner.accepted {
                    background: rgba(16, 185, 129, 0.08) !important;
                    border-color: rgba(16, 185, 129, 0.25) !important;
                }
                .result-banner.rejected {
                    background: rgba(239, 68, 68, 0.08) !important;
                    border-color: rgba(239, 68, 68, 0.25) !important;
                }
                .field-input,
                .field-textarea {
                    background: var(--surface-bg) !important;
                    border-color: var(--border-color) !important;
                    color: var(--text-color) !important;
                }
                #example-select,
                #input-string {
                    background: var(--surface-bg) !important;
                    border-color: var(--border-color) !important;
                    color: var(--text-color) !important;
                }
                ::-webkit-scrollbar-thumb {
                    background: #c4c8d4 !important;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af !important;
                }
                .trace-th,
                .trace-th-lg {
                    border-bottom-color: var(--border-color) !important;
                    color: var(--text-muted) !important;
                }
                #trace-table td,
                #trace-table-full td {
                    color: var(--text-muted) !important;
                    border-bottom-color: rgba(0, 0, 0, 0.04) !important;
                }
                #trace-table tr.active-step td,
                #trace-table-full tr.active-step td {
                    color: var(--text-color) !important;
                }
                .sidebar-resize-handle::after,
                .trace-resize-handle::after {
                    background: #d1d5db !important;
                }
                .sidebar-resize-handle:hover::after,
                .sidebar-resize-handle.active::after,
                .trace-resize-handle:hover::after,
                .trace-resize-handle.active::after {
                    background: #111 !important;
                }
                .pda-mode-toggle {
                    background: var(--surface-bg) !important;
                    border-color: var(--border-color) !important;
                }
                .pda-mode-btn {
                    color: var(--text-faint) !important;
                }
                .pda-mode-btn:not(:last-child) {
                    border-right-color: var(--border-color) !important;
                }
                #gen-report {
                    background-color: var(--card-bg) !important;
                }
                .status-badge {
                    background: rgba(0, 0, 0, 0.06) !important;
                    color: #374151 !important;
                    border-color: rgba(0, 0, 0, 0.1) !important;
                }
                .stack-empty-msg {
                    color: var(--text-faint) !important;
                }
                #vertical-rail {
                    background-color: var(--panel-bg) !important;
                    border-right-color: var(--border-color) !important;
                }
                .bg-white\\/\\[0\\.03\\],
                .border-white\\/\\[0\\.03\\] {
                    border-color: rgba(0, 0, 0, 0.04) !important;
                }
                .border-white\\/5 {
                    border-color: rgba(0, 0, 0, 0.06) !important;
                }
                .bg-indigo-500\\/5 {
                    background: rgba(0, 0, 0, 0.02) !important;
                }
                .border-indigo-500\\/20 {
                    border-color: rgba(0, 0, 0, 0.08) !important;
                }
                .bg-indigo-500\\/20 {
                    background: rgba(0, 0, 0, 0.06) !important;
                }
                .text-indigo-400 {
                    color: #111827 !important;
                }
                .border-indigo-500\\/30 {
                    border-color: rgba(0, 0, 0, 0.12) !important;
                }
                /* Buttons — keep indigo for action buttons */
                .bg-indigo-600 {
                    background-color: #111827 !important;
                }
                .hover\\:bg-indigo-500:hover {
                    background-color: #1f2937 !important;
                }
                .shadow-indigo-500\\/20,
                .hover\\:shadow-indigo-500\\/35:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                }
                .bg-cyan-600 {
                    background-color: #374151 !important;
                }
                .hover\\:bg-cyan-500:hover {
                    background-color: #4b5563 !important;
                }
                .shadow-cyan-500\\/20,
                .hover\\:shadow-cyan-500\\/35:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important;
                }
                /* Gradient text → solid black */
                .bg-gradient-to-r.from-indigo-400.to-cyan-400 {
                    background: none !important;
                    -webkit-text-fill-color: #111827 !important;
                    color: #111827 !important;
                }
                /* Field label */
                .field-label {
                    color: var(--text-muted) !important;
                }
                .hint {
                    color: var(--text-faint) !important;
                }
                /* Input chars */
                .input-char.remaining {
                    background: rgba(0, 0, 0, 0.04) !important;
                    color: var(--text-color) !important;
                    border-color: rgba(0, 0, 0, 0.1) !important;
                }
                .input-char.current {
                    background: #111827 !important;
                    color: #ffffff !important;
                    border-color: #111827 !important;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
                }
                .input-char.consumed {
                    background: rgba(0, 0, 0, 0.02) !important;
                    color: #9ca3af !important;
                    border-color: transparent !important;
                }
                /* Speed slider */
                .accent-indigo-500 {
                    accent-color: #111827 !important;
                }
            `;
        } else {
            // DARK MODE overrides (black/gray, no blue)
            style.textContent = `
                /* ── DARK MODE OVERRIDES ──────────────────────── */

                body,
                .bg-pda-bg {
                    background-color: var(--bg-color) !important;
                    color: var(--text-color) !important;
                }
                .bg-pda-panel,
                .bg-pda-panel\\/90 {
                    background-color: var(--panel-bg) !important;
                }
                .bg-pda-surface {
                    background-color: var(--surface-bg) !important;
                    color: var(--text-color) !important;
                }
                .border-pda-border {
                    border-color: var(--border-color) !important;
                }
                .text-slate-200,
                .text-slate-300 {
                    color: var(--text-color) !important;
                }
                .text-slate-400 {
                    color: var(--text-muted) !important;
                }
                .text-slate-500,
                .text-slate-600 {
                    color: var(--text-faint) !important;
                }
                .hover\\:bg-white\\/5:hover {
                    background-color: rgba(255, 255, 255, 0.05) !important;
                }
                #canvas-area {
                    background-color: var(--bg-color) !important;
                }
                #trace-overlay {
                    background-color: rgba(10, 10, 10, 0.96) !important;
                }
                .glass-bar {
                    background: rgba(20, 20, 20, 0.92) !important;
                    border-color: var(--border-color) !important;
                    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4) !important;
                }
                #stack-panel {
                    background: rgba(20, 20, 20, 0.95) !important;
                    border-color: var(--border-color) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }
                .field-input,
                .field-textarea {
                    background: var(--surface-bg) !important;
                    border-color: var(--border-color) !important;
                    color: var(--text-color) !important;
                }
                #example-select,
                #input-string {
                    background: var(--surface-bg) !important;
                    border-color: var(--border-color) !important;
                    color: var(--text-color) !important;
                }
                ::-webkit-scrollbar-thumb {
                    background: #333 !important;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #555 !important;
                }
                .trace-th,
                .trace-th-lg {
                    border-bottom-color: var(--border-color) !important;
                    color: var(--text-muted) !important;
                }
                #trace-table td,
                #trace-table-full td {
                    color: var(--text-muted) !important;
                    border-bottom-color: rgba(255, 255, 255, 0.03) !important;
                }
                #trace-table tr.active-step td,
                #trace-table-full tr.active-step td {
                    color: var(--text-color) !important;
                }
                .sidebar-resize-handle::after,
                .trace-resize-handle::after {
                    background: #333 !important;
                }
                .sidebar-resize-handle:hover::after,
                .sidebar-resize-handle.active::after,
                .trace-resize-handle:hover::after,
                .trace-resize-handle.active::after {
                    background: #fff !important;
                }
                .pda-mode-toggle {
                    background: var(--surface-bg) !important;
                    border-color: var(--border-color) !important;
                }
                .pda-mode-btn {
                    color: var(--text-faint) !important;
                }
                .pda-mode-btn:not(:last-child) {
                    border-right-color: var(--border-color) !important;
                }
                #gen-report {
                    background-color: var(--card-bg) !important;
                }
                .status-badge {
                    background: rgba(255, 255, 255, 0.06) !important;
                    color: #d1d5db !important;
                    border-color: rgba(255, 255, 255, 0.1) !important;
                }
                .stack-empty-msg {
                    color: var(--text-faint) !important;
                }
                #vertical-rail {
                    background-color: var(--panel-bg) !important;
                    border-right-color: var(--border-color) !important;
                }
                .bg-white\\/\\[0\\.03\\],
                .border-white\\/\\[0\\.03\\] {
                    border-color: rgba(255, 255, 255, 0.04) !important;
                }
                .border-white\\/5 {
                    border-color: rgba(255, 255, 255, 0.06) !important;
                }
                .bg-indigo-500\\/5 {
                    background: rgba(255, 255, 255, 0.03) !important;
                }
                .border-indigo-500\\/20 {
                    border-color: rgba(255, 255, 255, 0.08) !important;
                }
                .bg-indigo-500\\/20 {
                    background: rgba(255, 255, 255, 0.06) !important;
                }
                .text-indigo-400 {
                    color: #e5e7eb !important;
                }
                .border-indigo-500\\/30 {
                    border-color: rgba(255, 255, 255, 0.1) !important;
                }
                /* Buttons */
                .bg-indigo-600 {
                    background-color: #ffffff !important;
                    color: #000000 !important;
                }
                .hover\\:bg-indigo-500:hover {
                    background-color: #e5e7eb !important;
                }
                .shadow-indigo-500\\/20,
                .hover\\:shadow-indigo-500\\/35:hover {
                    box-shadow: 0 4px 12px rgba(255,255,255,0.1) !important;
                }
                .bg-cyan-600 {
                    background-color: #d1d5db !important;
                    color: #000000 !important;
                }
                .hover\\:bg-cyan-500:hover {
                    background-color: #e5e7eb !important;
                }
                .shadow-cyan-500\\/20,
                .hover\\:shadow-cyan-500\\/35:hover {
                    box-shadow: 0 4px 12px rgba(255,255,255,0.06) !important;
                }
                /* Gradient text → white */
                .bg-gradient-to-r.from-indigo-400.to-cyan-400 {
                    background: none !important;
                    -webkit-text-fill-color: #f1f1f1 !important;
                    color: #f1f1f1 !important;
                }
                /* Field label */
                .field-label {
                    color: var(--text-muted) !important;
                }
                .hint {
                    color: var(--text-faint) !important;
                }
                /* Input chars */
                .input-char.remaining {
                    background: rgba(255, 255, 255, 0.05) !important;
                    color: var(--text-color) !important;
                    border-color: rgba(255, 255, 255, 0.1) !important;
                }
                .input-char.current {
                    background: #ffffff !important;
                    color: #000000 !important;
                    border-color: #ffffff !important;
                    box-shadow: 0 2px 8px rgba(255,255,255,0.15) !important;
                }
                .input-char.consumed {
                    background: rgba(255, 255, 255, 0.02) !important;
                    color: #555 !important;
                    border-color: transparent !important;
                }
                /* Speed slider */
                .accent-indigo-500 {
                    accent-color: #ffffff !important;
                }
            `;
        }

        document.head.appendChild(style);
    }

    // ── Create toggle button ────────────────────────────────
    function createToggleButton() {
        var btn = document.createElement('button');
        btn.id = 'theme-toggle-btn';
        btn.className = 'theme-toggle-fab';
        btn.setAttribute('aria-label', 'Toggle theme');
        btn.innerHTML = '<span class="theme-toggle-icon">🌙</span>';

        btn.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
            var next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
        });

        document.body.appendChild(btn);
    }

    // ── Boot ─────────────────────────────────────────────────
    function init() {
        createToggleButton();
        var initialTheme = getInitialTheme();
        applyTheme(initialTheme);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

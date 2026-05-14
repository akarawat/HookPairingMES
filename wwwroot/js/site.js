/* ============================================================
   wwwroot/js/site.js
   Shared utilities: clock, helper functions
   ============================================================ */

'use strict';

// ── Live clock ────────────────────────────────────────────────
function startClock() {
    const el = document.getElementById('serverTime');
    if (!el) return;
    function tick() {
        const now = new Date();
        el.textContent = now.toLocaleString('th-TH', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    }
    tick();
    setInterval(tick, 1000);
}

// ── Format decimal 5 places ──────────────────────────────────
function fmt5(v) {
    if (v === null || v === undefined) return '–';
    return parseFloat(v).toFixed(5);
}

// ── Relative time ────────────────────────────────────────────
function relativeTime(dtStr) {
    const dt = new Date(dtStr);
    const diff = Math.floor((Date.now() - dt) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
    return dt.toLocaleTimeString('th-TH');
}

// ── Flash KPI card ────────────────────────────────────────────
function flashEl(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('updated');
    setTimeout(() => el.classList.remove('updated'), 800);
}

document.addEventListener('DOMContentLoaded', startClock);

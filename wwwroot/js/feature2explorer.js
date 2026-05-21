/* ============================================================
   wwwroot/js/feature2explorer.js
   Feature2 Data Explorer – AJAX table, pagination, chart, export
   ============================================================ */

'use strict';

// ── Chart.js global defaults ──────────────────────────────────
Chart.defaults.color = '#7a8fa8';
Chart.defaults.borderColor = '#1e2d4a';

let f2CurrentPage = 1;
const f2PageSize = 50;
let f2Chart = null;
let f2AllItems = [];   // cache current page items for chart

// ── Config from appsettings.json (injected by Razor) ─────────
const CFG = window.F2ClassConfig || {};
const RULES = CFG.rules || CFG.Rules || [];
const DEF = CFG.defaultRule || CFG.Default || { label: 'OK', badge: 'success' };
const LIMITS = CFG.limits || CFG.Limits || [];

// ── Classification badge ──────────────────────────────────────
function classTag(val) {
    const rule = RULES.find(r => (r.value ?? r.Value) === val);
    const label = rule ? (rule.Label || rule.label) : (DEF.Label || DEF.label || 'OK');
    const badge = rule ? (rule.Badge || rule.badge) : (DEF.Badge || DEF.badge || 'success');
    return `<span class="badge bg-${badge}">${label}</span>`;
}

// ── Build Limit Legend ────────────────────────────────────────
function buildLimitLegend() {
    const el = document.getElementById('f2LimitLegend');
    if (!el) return;
    el.innerHTML = LIMITS.map(lim => {
        const label = lim.Label || lim.label || '';
        const color = lim.Color || lim.color || '#ff3d57';
        return `<span style="font-size:11px;color:${color};font-family:var(--font-mono)">
                    <span style="display:inline-block;width:24px;height:2px;background:${color};
                          vertical-align:middle;margin-right:4px;
                          border-bottom:${(lim.Dash || lim.dash) ? '2px dashed ' + color : 'none'}"></span>
                    ${label}: ${(lim.Value ?? lim.value ?? 0).toFixed(2)}
                </span>`;
    }).join('');
}

// ── Init / Update Chart ───────────────────────────────────────
function renderChart(items) {
    const ctx = document.getElementById('f2Chart');
    if (!ctx) return;

    // Sort oldest → newest for chart
    const sorted = [...items].sort((a, b) =>
        new Date(a.ReceivedAt || a.receivedAt) - new Date(b.ReceivedAt || b.receivedAt)
    );

    const labels = sorted.map(r => {
        const dt = new Date(r.ReceivedAt || r.receivedAt);
        return dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });

    const values = sorted.map(r => parseFloat(r.OpwValue ?? r.opwValue ?? 0));

    // Point colors based on classification
    const pointColors = sorted.map(r => {
        const cls = r.Classification ?? r.classification ?? null;
        const rule = RULES.find(ru => (ru.value ?? ru.Value) === cls);
        if (rule) return rule.Color || rule.color || '#ff3d57';
        return '#00d4ff';
    });

    // Build limit line datasets
    const n = labels.length;
    const limitDatasets = LIMITS.map(lim => ({
        label: lim.Label || lim.label || 'Limit',
        data: Array(n).fill(lim.Value ?? lim.value ?? 0),
        borderColor: lim.Color || lim.color || '#ff3d57',
        borderWidth: 1.5,
        borderDash: (lim.Dash || lim.dash) ? [6, 4] : [],
        pointRadius: 0,
        fill: false,
        tension: 0
    }));

    const datasets = [
        {
            label: 'OpwValue',
            data: values,
            borderColor: '#00d4ff',
            backgroundColor: 'rgba(0,212,255,0.08)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            tension: 0.3,
            fill: true
        },
        ...limitDatasets
    ];

    if (f2Chart) {
        f2Chart.data.labels = labels;
        f2Chart.data.datasets = datasets;
        f2Chart.update('none');
        return;
    }

    f2Chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#7a8fa8', font: { size: 10 }, boxWidth: 16 }
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            return `${ctx.dataset.label}: ${parseFloat(ctx.raw).toFixed(5)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#1e2d4a' },
                    ticks: { color: '#7a8fa8', maxTicksLimit: 12, maxRotation: 0 }
                },
                y: {
                    grid: { color: '#1e2d4a' },
                    ticks: {
                        color: '#7a8fa8',
                        font: { family: "'Share Tech Mono', monospace" }
                    }
                }
            }
        }
    });
}

// ── Fetch and render ──────────────────────────────────────────
function f2LoadData(page) {
    f2CurrentPage = page;

    const params = {
        tableName: $('#f2Table').val(),
        dateFrom: $('#f2DateFrom').val(),
        dateTo: $('#f2DateTo').val(),
        itemNo: $('#f2ItemNo').val() || null,
        pageNo: page,
        pageSize: f2PageSize
    };

    $('#f2TableLabel').text(params.tableName);
    $('#f2ChartLabel').text(params.tableName + ' — OpwValue Trend');

    $('#f2TableBody').html(
        '<tr><td colspan="6" class="text-center py-4">' +
        '<span class="spinner-border spinner-border-sm text-secondary"></span> Loading…</td></tr>'
    );

    $.ajax({
        url: '/Feature2/GetJson',
        data: params,
        success(result) {
            f2AllItems = result.Items || result.items || [];
            f2RenderTable(f2AllItems);
            renderChart(f2AllItems);
            f2RenderPagination(
                result.TotalRecords ?? result.totalRecords ?? 0,
                result.TotalPages ?? result.totalPages ?? 1,
                page
            );
            const total = result.TotalRecords ?? result.totalRecords ?? 0;
            $('#f2TotalInfo').text(`${total.toLocaleString()} records`);
        },
        error() {
            $('#f2TableBody').html(
                '<tr><td colspan="6" class="text-center text-danger py-3">Load failed. Retry.</td></tr>'
            );
        }
    });
}

// ── Render rows ───────────────────────────────────────────────
function f2RenderTable(items) {
    if (!items.length) {
        $('#f2TableBody').html(
            '<tr><td colspan="6" class="text-center text-secondary py-4">No records found.</td></tr>'
        );
        return;
    }

    const rows = items.map(r => {
        const dt = r.ReceivedAt || r.receivedAt || '';
        const dtFmt = dt ? new Date(dt).toLocaleString('th-TH') : '–';
        const val = r.OpwValue ?? r.opwValue ?? 0;
        const cls = r.Classification ?? r.classification ?? 0;
        const item = r.ItemNo || r.itemNo || '–';

        return `<tr>
            <td style="font-family:monospace">${r.MesId ?? r.mesId ?? '–'}</td>
            <td style="font-family:monospace;color:var(--accent-body)">${parseFloat(val).toFixed(5)}</td>
            <td>${r.Measured ?? r.measured ?? '–'}</td>
            <td>${classTag(cls)}</td>
            <td>${item}</td>
            <td style="white-space:nowrap">${dtFmt}</td>
        </tr>`;
    }).join('');

    $('#f2TableBody').html(rows);
}

// ── Pagination ────────────────────────────────────────────────
function f2RenderPagination(total, totalPages, currentPage) {
    const from = (currentPage - 1) * f2PageSize + 1;
    const to = Math.min(currentPage * f2PageSize, total);
    $('#f2PageInfo').text(`Showing ${from}–${to} of ${total.toLocaleString()}`);

    const ul = $('#f2Pagination').empty();
    if (totalPages <= 1) return;

    const addPage = (label, page, disabled, active) => {
        ul.append(
            `<li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${page}">${label}</a>
            </li>`
        );
    };

    addPage('‹', currentPage - 1, currentPage === 1);
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    if (start > 1) { addPage('1', 1); if (start > 2) ul.append('<li class="page-item disabled"><span class="page-link">…</span></li>'); }
    for (let p = start; p <= end; p++) addPage(p, p, false, p === currentPage);
    if (end < totalPages) { if (end < totalPages - 1) ul.append('<li class="page-item disabled"><span class="page-link">…</span></li>'); addPage(totalPages, totalPages); }
    addPage('›', currentPage + 1, currentPage === totalPages);
}

// ── Excel export ──────────────────────────────────────────────
function f2ExportExcel() {
    const params = new URLSearchParams({
        tableName: $('#f2Table').val(),
        dateFrom: $('#f2DateFrom').val(),
        dateTo: $('#f2DateTo').val(),
        itemNo: $('#f2ItemNo').val() || ''
    });
    const a = document.createElement('a');
    a.href = `/Feature2/ExportExcel?${params.toString()}`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ── Auto-refresh with countdown ──────────────────────────────
let _autoTimer = null;
let _countdownTimer = null;
let _remaining = 0;

function startAutoRefresh() {
    const sec = (window.F2AutoRefreshSeconds > 0) ? window.F2AutoRefreshSeconds : 180;
    _remaining = sec;
    updateCountdown();

    clearInterval(_countdownTimer);
    clearInterval(_autoTimer);

    _countdownTimer = setInterval(function () {
        _remaining = Math.max(0, _remaining - 1);
        updateCountdown();
    }, 1000);

    _autoTimer = setInterval(function () {
        f2LoadData(f2CurrentPage);
        _remaining = sec;
    }, sec * 1000);
}

function resetAutoRefresh() {
    const sec = (window.F2AutoRefreshSeconds > 0) ? window.F2AutoRefreshSeconds : 180;
    _remaining = sec;
    clearInterval(_autoTimer);
    clearInterval(_countdownTimer);
    startAutoRefresh();
}

function updateCountdown() {
    const m = String(Math.floor(_remaining / 60)).padStart(2, '0');
    const s = String(_remaining % 60).padStart(2, '0');
    const el = document.getElementById('f2AutoRefreshBadge');
    if (el) el.textContent = `Auto refresh ${m}:${s}`;
}

// ── Event bindings + Auto-load ────────────────────────────────
$(function () {
    buildLimitLegend();

    // Auto-load วันนี้เมื่อเปิดหน้า
    f2LoadData(1);

    // Start auto-refresh countdown
    startAutoRefresh();

    $('#f2Search').on('click', function () {
        f2LoadData(1);
        resetAutoRefresh();
    });
    $('#f2Export').on('click', f2ExportExcel);

    $('#f2Pagination').on('click', 'a.page-link', function (e) {
        e.preventDefault();
        const p = parseInt($(this).data('page'), 10);
        if (p > 0) f2LoadData(p);
    });

    $('#f2Table, #f2DateFrom, #f2DateTo, #f2ItemNo').on('keydown', function (e) {
        if (e.key === 'Enter') { f2LoadData(1); resetAutoRefresh(); }
    });

    $('#f2Table').on('change', function () {
        f2LoadData(1);
        resetAutoRefresh();
    });
});

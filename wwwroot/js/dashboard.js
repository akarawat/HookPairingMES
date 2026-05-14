/* ============================================================
   wwwroot/js/dashboard.js
   Dashboard chart initialisation & AJAX refresh
   Requires: Chart.js, chartjs-chart-boxplot plugin, jQuery
   ============================================================ */

'use strict';

// ── Chart.js global defaults ──────────────────────────────────
Chart.defaults.color           = '#7a8fa8';
Chart.defaults.borderColor     = '#1e2d4a';
Chart.defaults.font.family     = "'Sarabun', sans-serif";
Chart.defaults.animation.duration = 600;

// ── Color palette ────────────────────────────────────────────
const C = {
    body:       '#00d4ff',
    bodyBg:     'rgba(0,212,255,0.12)',
    guide:      '#ff6b35',
    guideBg:    'rgba(255,107,53,0.12)',
    green:      '#00e676',
    warn:       '#ffb300',
    grid:       '#1e2d4a',
    text:       '#7a8fa8'
};

// ── Chart instances registry ─────────────────────────────────
const charts = {};

// ── Server initial data ───────────────────────────────────────
let initData = {};
try {
    const raw = document.getElementById('initData');
    if (raw) initData = JSON.parse(raw.textContent);
} catch (e) { console.warn('initData parse error', e); }

// ── Trend data buffers (append on live update) ────────────────
let bodyTrend  = (initData.bodyTrend  || []).slice();
let guideTrend = (initData.guideTrend || []).slice();
const MAX_TREND = 50;

// ── Boxplot: build dataset for one axis ───────────────────────
function buildBoxplotDataset(boxStats, color, bgColor, label) {
    // boxStats: array of {AxisName, MinVal, MaxVal, Q1, MedianVal, Q3, MeanVal, StdDev}
    const labels = boxStats.map(s => s.AxisName);
    const data   = boxStats.map(s => ({
        min:    s.MinVal,
        q1:     s.Q1,
        median: s.MedianVal,
        q3:     s.Q3,
        max:    s.MaxVal,
        mean:   s.MeanVal
    }));

    return {
        labels,
        datasets: [{
            label,
            data,
            backgroundColor:     bgColor,
            borderColor:         color,
            borderWidth:         2,
            medianColor:         color,
            meanBorderColor:     C.warn,
            meanBackgroundColor: C.warn,
            outlierColor:        color,
            padding:             12,
            itemRadius:          2
        }]
    };
}

// ── Init Boxplot chart ────────────────────────────────────────
function initBoxplotChart(canvasId, data, color, bgColor, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (charts[canvasId]) { charts[canvasId].destroy(); }

    charts[canvasId] = new Chart(ctx, {
        type: 'boxplot',
        data: buildBoxplotDataset(data, color, bgColor, label),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const d = ctx.raw;
                            return [
                                `Min: ${fmt5(d.min)}`,
                                `Q1:  ${fmt5(d.q1)}`,
                                `Med: ${fmt5(d.median)}`,
                                `Q3:  ${fmt5(d.q3)}`,
                                `Max: ${fmt5(d.max)}`,
                                `Avg: ${fmt5(d.mean)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: C.grid }, ticks: { color: C.text } },
                y: { grid: { color: C.grid }, ticks: { color: C.text, font: { family: "'Share Tech Mono', monospace" } } }
            }
        }
    });

    return charts[canvasId];
}

// ── Trend chart: control-chart style ─────────────────────────
function buildTrendDataset(trendArr, axisKey, color, bgColor) {
    const labels = trendArr.map(r => r.dt);
    const values = trendArr.map(r => r[axisKey]);

    // Compute mean ± 3σ for control limits
    const n    = values.length;
    const mean = n ? values.reduce((a, b) => a + b, 0) / n : 0;
    const sd   = n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
    const ucl  = mean + 3 * sd;
    const lcl  = mean - 3 * sd;

    return {
        labels,
        mean, ucl, lcl,
        datasets: [
            {
                label: axisKey,
                data: values,
                borderColor: color,
                backgroundColor: bgColor,
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: values.map(v => (v > ucl || v < lcl) ? C.warn : color),
                tension: 0.3,
                fill: false
            },
            { label: 'UCL', data: Array(n).fill(ucl),  borderColor: C.warn, borderWidth: 1, borderDash: [4,4], pointRadius: 0, fill: false },
            { label: 'Mean',data: Array(n).fill(mean), borderColor: C.green, borderWidth: 1, borderDash: [2,2], pointRadius: 0, fill: false },
            { label: 'LCL', data: Array(n).fill(lcl),  borderColor: C.warn, borderWidth: 1, borderDash: [4,4], pointRadius: 0, fill: false }
        ]
    };
}

function initTrendChart(canvasId, trendArr, axisKey, color, bgColor) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (charts[canvasId]) { charts[canvasId].destroy(); }

    const ds = buildTrendDataset(trendArr, axisKey, color, bgColor);

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: ds,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: C.text, font: { size: 10 }, boxWidth: 16 }
                },
                tooltip: {
                    callbacks: {
                        label(ctx) { return `${ctx.dataset.label}: ${fmt5(ctx.raw)}`; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: C.grid },
                    ticks: { color: C.text, maxTicksLimit: 10, maxRotation: 0 }
                },
                y: {
                    grid: { color: C.grid },
                    ticks: { color: C.text, font: { family: "'Share Tech Mono', monospace" } }
                }
            }
        }
    });

    return charts[canvasId];
}

// ── Hourly Bar chart ──────────────────────────────────────────
function initHourlyChart(hourlyData) {
    const ctx = document.getElementById('chartHourly');
    if (!ctx) return;

    if (charts.hourly) { charts.hourly.destroy(); }

    // Build labels 0-23
    const hours  = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`);
    const bodyVals  = Array(24).fill(0);
    const guideVals = Array(24).fill(0);

    (hourlyData || []).forEach(row => {
        const h = row.HourSlot ?? row.hour_slot ?? 0;
        if (row.PartType === 'Body'     || row.part_type === 'Body')     bodyVals[h]  = row.MeasureCount ?? row.measure_count;
        if (row.PartType === 'Guideway' || row.part_type === 'Guideway') guideVals[h] = row.MeasureCount ?? row.measure_count;
    });

    charts.hourly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hours,
            datasets: [
                { label: 'Body',     data: bodyVals,  backgroundColor: C.bodyBg,  borderColor: C.body,  borderWidth: 1 },
                { label: 'Guideway', data: guideVals, backgroundColor: C.guideBg, borderColor: C.guide, borderWidth: 1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: C.text } }
            },
            scales: {
                x: { stacked: false, grid: { color: C.grid }, ticks: { color: C.text, maxRotation: 0 } },
                y: { grid: { color: C.grid }, ticks: { color: C.text } }
            }
        }
    });
}

// ── Update trend chart with new point ────────────────────────
function appendTrendPoint(chartId, trendBuffer, newPoint, axisKey) {
    const ch = charts[chartId];
    if (!ch) return;

    trendBuffer.push(newPoint);
    if (trendBuffer.length > MAX_TREND) trendBuffer.shift();

    const newDs = buildTrendDataset(trendBuffer, axisKey, ch.data.datasets[0].borderColor, ch.data.datasets[0].backgroundColor);
    ch.data.labels       = newDs.labels;
    ch.data.datasets[0].data = newDs.datasets[0].data;
    ch.data.datasets[1].data = newDs.datasets[1].data;
    ch.data.datasets[2].data = newDs.datasets[2].data;
    ch.data.datasets[3].data = newDs.datasets[3].data;
    ch.update('none');
}

// ── KPI update from live payload ──────────────────────────────
function updateKpi(kpi) {
    if (!kpi) return;
    const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== String(v)) {
            el.textContent = v;
            el.classList.add('updated');
            setTimeout(() => el.classList.remove('updated'), 800);
        }
    };
    setVal('kpiBodyToday', kpi.BodyCountToday  ?? kpi.body_count_today);
    setVal('kpiBodyTotal', kpi.BodyCountTotal  ?? kpi.body_count_total);
    setVal('kpiGwToday',   kpi.GwCountToday    ?? kpi.gw_count_today);
    setVal('kpiGwTotal',   kpi.GwCountTotal    ?? kpi.gw_count_total);
    setVal('kpiBodySn',    kpi.BodySnToday     ?? kpi.body_sn_today);

    const fmtTime = v => v ? new Date(v).toLocaleTimeString('th-TH') : '--';
    setVal('kpiLastBody', fmtTime(kpi.BodyLastMeasure || kpi.body_last_measure));
    setVal('kpiLastGw',   'GW: ' + fmtTime(kpi.GwLastMeasure   || kpi.gw_last_measure));
}

// ── AJAX dashboard refresh ────────────────────────────────────
function refreshDashboard() {
    const params = {
        dateFrom: $('#filterDateFrom').val(),
        dateTo:   $('#filterDateTo').val(),
        woNo:     $('#filterWoNo').val() || null
    };

    $.ajax({
        url: '/Dashboard/GetDashboardJson',
        data: params,
        success(vm) {
            updateKpi(vm.Kpi || vm.kpi);

            // Re-render boxplots
            initBoxplotChart('chartBodyBoxplot',  vm.BodyBoxplot  || vm.bodyBoxplot,  C.body,  C.bodyBg,  'Hook Body');
            initBoxplotChart('chartGuideBoxplot', vm.GuideBoxplot || vm.guideBoxplot, C.guide, C.guideBg, 'Hook Guideway');

            // Refresh trend buffers
            bodyTrend  = (vm.BodyTrend  || vm.bodyTrend  || []).map(normTrendRow);
            guideTrend = (vm.GuideTrend || vm.guideTrend || []).map(normTrendRow);

            const bAxis = $('#bodyTrendAxis').val() || 'A1Axis';
            const gAxis = $('#guideTrendAxis').val() || 'A1Axis';
            initTrendChart('chartBodyTrend',  bodyTrend,  bAxis, C.body,  C.bodyBg);
            initTrendChart('chartGuideTrend', guideTrend, gAxis, C.guide, C.guideBg);

            initHourlyChart(vm.HourlyCounts || vm.hourlyCounts);
        },
        error(xhr) {
            console.error('Dashboard refresh failed', xhr.statusText);
        }
    });
}

// ── Normalise row field names (handle camelCase vs PascalCase) ──
function normTrendRow(r) {
    return {
        dt:     r.dt || r.DtCreate || '',
        MacSn:  r.MacSn  || r.mac_sn,
        WoNo:   r.WoNo   || r.wo_no,
        A1Axis: r.A1Axis ?? r.a1axis ?? 0,
        A2Axis: r.A2Axis ?? r.a2axis ?? 0,
        Z1Axis: r.Z1Axis ?? r.z1axis ?? 0,
        X1Axis: r.X1Axis ?? r.x1axis ?? 0
    };
}

// ── Axis selector change ──────────────────────────────────────
function bindAxisSelectors() {
    $('#bodyTrendAxis').on('change', function () {
        initTrendChart('chartBodyTrend', bodyTrend, $(this).val(), C.body, C.bodyBg);
    });
    $('#guideTrendAxis').on('change', function () {
        initTrendChart('chartGuideTrend', guideTrend, $(this).val(), C.guide, C.guideBg);
    });
}

// ── Init on load ──────────────────────────────────────────────
$(function () {
    // Normalise initial trend data
    bodyTrend  = bodyTrend.map(normTrendRow);
    guideTrend = guideTrend.map(normTrendRow);

    // Boxplots
    initBoxplotChart('chartBodyBoxplot',
        initData.bodyBoxplot  || [],  C.body,  C.bodyBg,  'Hook Body');
    initBoxplotChart('chartGuideBoxplot',
        initData.guideBoxplot || [],  C.guide, C.guideBg, 'Hook Guideway');

    // Trend (default A1)
    initTrendChart('chartBodyTrend',  bodyTrend,  'A1Axis', C.body,  C.bodyBg);
    initTrendChart('chartGuideTrend', guideTrend, 'A1Axis', C.guide, C.guideBg);

    // Hourly
    initHourlyChart(initData.hourlyCounts || []);

    // Axis selectors
    bindAxisSelectors();

    // Refresh button
    $('#btnRefresh').on('click', refreshDashboard);

    // Auto-refresh every 60 s
    setInterval(refreshDashboard, 60000);
});

// ── Expose for realtime.js ────────────────────────────────────
window.DashboardCharts = {
    appendBodyTrend(row) {
        const normalized = normTrendRow(row);
        bodyTrend.push(normalized);
        if (bodyTrend.length > MAX_TREND) bodyTrend.shift();
        const axis = $('#bodyTrendAxis').val() || 'A1Axis';
        appendTrendPoint('chartBodyTrend', bodyTrend, normalized, axis);
    },
    appendGuideTrend(row) {
        const normalized = normTrendRow(row);
        guideTrend.push(normalized);
        if (guideTrend.length > MAX_TREND) guideTrend.shift();
        const axis = $('#guideTrendAxis').val() || 'A1Axis';
        appendTrendPoint('chartGuideTrend', guideTrend, normalized, axis);
    },
    updateKpi
};

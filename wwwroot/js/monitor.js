/* ============================================================
   wwwroot/js/monitor.js
   Live Measurement Monitor – SignalR client
   Receives measurements in real time, displays numbers only.
   ============================================================ */

'use strict';

const MAX_LOG_ROWS = 200;   // ค้างได้สูงสุด 200 แถว
let sessionCount = 0;
let rowSeq = 0;

// ── SignalR connection ────────────────────────────────────────
const conn = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/measurement')
    .withAutomaticReconnect([1000, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

// ── Connection status ─────────────────────────────────────────
function setStatus(state) {
    const pill = document.getElementById('monConnPill');
    const text = document.getElementById('monConnText');
    const foot = document.getElementById('connStatus');

    const cfg = {
        connected: { label: '● CONNECTED', cls: 'connected', foot: '<i class="bi bi-wifi text-success"></i> Connected' },
        reconnecting: { label: '⟳ RECONNECTING…', cls: '', foot: '<i class="bi bi-wifi text-warning"></i> Reconnecting…' },
        disconnected: { label: '✕ DISCONNECTED', cls: 'disconnected', foot: '<i class="bi bi-wifi-off text-danger"></i> Disconnected' }
    }[state] || {};

    if (pill) {
        pill.className = `conn-pill ${cfg.cls}`;
        text.textContent = cfg.label;
    }
    if (foot) foot.innerHTML = cfg.foot;
}

// ── Flash helper (border glow + axis highlight) ───────────────
function flashPanel(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;
    const cls = panelId === 'panelBody' ? 'flash-body' : 'flash-guide';
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 800);
}

function flashVal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.parentElement.classList.add('updated');
    setTimeout(() => el.parentElement.classList.remove('updated'), 600);
}

function flashStat(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 600);
}

// ── Normalise payload (SignalR ส่ง camelCase) ────────────────
function norm(p) {
    return {
        partType: p.partType || p.PartType || '',
        mesId: p.mesId || p.MesId || '',
        macSn: p.macSn || p.MacSn || '',
        woNo: p.woNo || p.WoNo || '',
        boxNo: p.boxNo || p.BoxNo || '',
        oprNo: p.oprNo || p.OprNo || '',
        dtCreate: p.dtCreate || p.DtCreate || new Date().toISOString(),
        a1Axis: p.a1Axis ?? p.A1Axis ?? 0,
        a2Axis: p.a2Axis ?? p.A2Axis ?? 0,
        z1Axis: p.z1Axis ?? p.Z1Axis ?? 0,
        x1Axis: p.x1Axis ?? p.X1Axis ?? 0
    };
}

// ── Update "Latest" panel ─────────────────────────────────────
function updateLatestPanel(raw) {
    const p = norm(raw);
    const isBody = p.partType === 'Body';
    const prefix = isBody ? 'body' : 'guide';
    const time = new Date(p.dtCreate).toLocaleTimeString('th-TH', { hour12: false });

    document.getElementById(`${prefix}LatestSn`).textContent = p.macSn || '–';
    document.getElementById(`${prefix}LatestWo`).textContent = 'WO: ' + (p.woNo || '–');
    document.getElementById(`${prefix}LatestBox`).textContent = p.boxNo || '–';
    document.getElementById(`${prefix}LatestOpr`).textContent = p.oprNo || '–';
    document.getElementById(`${prefix}LatestId`).textContent = p.mesId || '–';
    document.getElementById(`${prefix}LatestTime`).textContent = time;

    const axisMap = { A1: 'a1Axis', A2: 'a2Axis', Z1: 'z1Axis', X1: 'x1Axis' };
    Object.entries(axisMap).forEach(([label, key]) => {
        const el = document.getElementById(`${prefix}${label}`);
        if (el) {
            el.textContent = parseFloat(p[key]).toFixed(5);
            flashVal(`${prefix}${label}`);
        }
    });

    flashPanel(isBody ? 'panelBody' : 'panelGuide');
}

// ── Append row to log table ───────────────────────────────────
function appendLogRow(raw) {
    const p = norm(raw);
    const tbody = document.getElementById('monLogBody');
    const empty = document.getElementById('monEmptyRow');
    if (empty) empty.remove();

    rowSeq++;
    const isBody = p.partType === 'Body';
    const time = new Date(p.dtCreate).toLocaleTimeString('th-TH', { hour12: false });
    const tagCls = isBody ? 'tag-body' : 'tag-guide';
    const rowCls = isBody ? 'log-row-new' : 'log-row-new guide-row';

    const tr = document.createElement('tr');
    tr.className = rowCls;
    tr.innerHTML = `
        <td class="row-seq">${rowSeq}</td>
        <td class="${tagCls}">${p.partType.toUpperCase()}</td>
        <td>${p.macSn || '–'}</td>
        <td>${p.woNo || '–'}</td>
        <td>${p.boxNo || '–'}</td>
        <td>${p.oprNo || '–'}</td>
        <td class="text-end val-a1">${parseFloat(p.a1Axis).toFixed(5)}</td>
        <td class="text-end val-a2">${parseFloat(p.a2Axis).toFixed(5)}</td>
        <td class="text-end val-z1">${parseFloat(p.z1Axis).toFixed(5)}</td>
        <td class="text-end val-x1">${parseFloat(p.x1Axis).toFixed(5)}</td>
        <td>${time}</td>
    `;

    tbody.insertBefore(tr, tbody.firstChild);

    while (tbody.rows.length > MAX_LOG_ROWS) {
        tbody.deleteRow(tbody.rows.length - 1);
    }
}

// ── Update counters ───────────────────────────────────────────
function updateCounters(kpi) {
    if (!kpi) return;
    const total = (kpi.bodyCountToday ?? kpi.BodyCountToday ?? kpi.body_count_today ?? 0)
        + (kpi.gwCountToday ?? kpi.GwCountToday ?? kpi.gw_count_today ?? 0);

    const el = document.getElementById('monTotalCount');
    if (el) el.textContent = total.toLocaleString();
    flashStat('monTotalCount');
}

// ── SignalR event handlers ────────────────────────────────────
conn.on('ReceiveMeasurement', function (payload) {
    sessionCount++;
    document.getElementById('monSessionCount').textContent = sessionCount.toLocaleString();
    flashStat('monSessionCount');

    updateLatestPanel(payload);
    appendLogRow(payload);
});

conn.on('ReceiveKpi', function (kpi) {
    updateCounters(kpi);
});

// ── Connection lifecycle ──────────────────────────────────────
conn.onreconnecting(() => setStatus('reconnecting'));
conn.onreconnected(() => setStatus('connected'));
conn.onclose(() => setStatus('disconnected'));

async function startConn() {
    try {
        await conn.start();
        setStatus('connected');
    } catch (err) {
        setStatus('disconnected');
        console.error('SignalR connect failed:', err);
        setTimeout(startConn, 5000);
    }
}

// ── Load initial recent data on page load ────────────────────
function loadRecentData() {
    $.ajax({
        url: '/Dashboard/GetRecentJson',
        data: { topN: 10 },
        success(items) {
            if (!items || items.length === 0) return;

            // Sort oldest → newest so newest ends up on top after prepend
            items.sort((a, b) => new Date(a.DtCreate || a.dtCreate) - new Date(b.DtCreate || b.dtCreate));

            items.forEach(item => {
                // Map HookMeasurement fields → LiveMeasurementPayload shape
                const payload = {
                    PartType: item.PartType || item.part_type || '',
                    MesId: item.MesId || item.mesId || '',
                    MacSn: item.MacSn || item.mac_sn || '',
                    WoNo: item.WoNo || item.wo_no || '',
                    BoxNo: item.BoxNo || item.box_no || '',
                    OprNo: item.OprNo || item.opr_no || '',
                    A1Axis: item.A1Axis ?? item.a1axis ?? 0,
                    A2Axis: item.A2Axis ?? item.a2axis ?? 0,
                    Z1Axis: item.Z1Axis ?? item.z1axis ?? 0,
                    X1Axis: item.X1Axis ?? item.x1axis ?? 0,
                    DtCreate: item.DtCreate || item.dtCreate || new Date().toISOString()
                };

                // Update latest panel only for the very last item per type
                const isLastBody = items.filter(r => (r.PartType || r.part_type) === 'Body').slice(-1)[0] === item;
                const isLastGuide = items.filter(r => (r.PartType || r.part_type) === 'Guideway').slice(-1)[0] === item;
                if (isLastBody || isLastGuide) updateLatestPanel(payload);

                appendLogRow(payload);
            });
        },
        error() {
            console.warn('Could not load recent measurements.');
        }
    });
}

// ── Clear log ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    startConn();
    loadRecentData();

    document.getElementById('monClearBtn').addEventListener('click', function () {
        const tbody = document.getElementById('monLogBody');
        tbody.innerHTML = `
            <tr id="monEmptyRow">
                <td colspan="11" class="text-center py-5 text-secondary">
                    <i class="bi bi-wifi me-2"></i>รอรับข้อมูลจากเครื่องวัด…
                </td>
            </tr>`;
        sessionCount = 0;
        rowSeq = 0;
        document.getElementById('monSessionCount').textContent = '0';
    });
});

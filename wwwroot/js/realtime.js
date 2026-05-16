/* ============================================================
   wwwroot/js/realtime.js
   SignalR client – real-time measurement feed
   Requires: @microsoft/signalr, dashboard.js (window.DashboardCharts)
   ============================================================ */

'use strict';

const MAX_FEED_ITEMS = 30;

// ── Build connection ─────────────────────────────────────────
const connection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/measurement')
    .withAutomaticReconnect([1000, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

// ── Connection status display ────────────────────────────────
function setConnStatus(state) {
    const el = document.getElementById('connStatus');
    const bd = document.getElementById('liveStatusBadge');
    if (!el) return;

    const states = {
        connected: { text: '● Connected', cls: 'text-success' },
        reconnecting: { text: '⟳ Reconnecting…', cls: 'text-warning' },
        disconnected: { text: '✕ Disconnected', cls: 'text-danger' }
    };
    const s = states[state] || states.disconnected;
    el.className = `small ${s.cls}`;
    el.innerHTML = s.text;

    if (bd) {
        bd.style.display = state === 'connected' ? 'inline-flex' : 'none';
    }
}

// ── Live feed DOM ─────────────────────────────────────────────
function addFeedItem(payload) {
    const feed = document.getElementById('liveFeed');
    if (!feed) return;

    const isBody = payload.PartType === 'Body';
    const dotCls = isBody ? 'body' : 'guideway';
    const color = isBody ? '#00d4ff' : '#ff6b35';
    const label = isBody ? 'BODY' : 'GW';
    const dt = new Date(payload.DtCreate).toLocaleTimeString('th-TH');

    const item = document.createElement('div');
    item.className = 'live-feed-item';
    item.innerHTML = `
        <span class="feed-dot ${dotCls}"></span>
        <div class="feed-info">
            <div class="feed-sn">
                <span style="color:${color};font-size:10px;font-weight:700">${label}</span>
                &nbsp;${payload.MacSn || '–'}
                ${payload.WoNo ? `<span class="text-muted ms-1">[${payload.WoNo}]</span>` : ''}
            </div>
            <div class="feed-vals">
                A1:${fmt5(payload.A1Axis)}
                A2:${fmt5(payload.A2Axis)}
                Z1:${fmt5(payload.Z1Axis)}
                X1:${fmt5(payload.X1Axis)}
            </div>
        </div>
        <span class="feed-time">${dt}</span>
    `;

    feed.insertBefore(item, feed.firstChild);

    // Trim list
    while (feed.children.length > MAX_FEED_ITEMS) {
        feed.removeChild(feed.lastChild);
    }
}

// ── Receive measurement event ─────────────────────────────────
connection.on('ReceiveMeasurement', function (payload) {
    addFeedItem(payload);

    // Forward to trend charts
    const row = {
        dt: new Date(payload.DtCreate).toLocaleTimeString('th-TH'),
        MacSn: payload.MacSn,
        WoNo: payload.WoNo,
        A1Axis: payload.A1Axis,
        A2Axis: payload.A2Axis,
        Z1Axis: payload.Z1Axis,
        X1Axis: payload.X1Axis
    };

    if (window.DashboardCharts) {
        if (payload.PartType === 'Body') window.DashboardCharts.appendBodyTrend(row);
        if (payload.PartType === 'Guideway') window.DashboardCharts.appendGuideTrend(row);
    }
});

// ── Receive KPI update ────────────────────────────────────────
connection.on('ReceiveKpi', function (kpi) {
    if (window.DashboardCharts) {
        window.DashboardCharts.updateKpi(kpi);
    }
});

// ── Reconnecting ─────────────────────────────────────────────
connection.onreconnecting(() => setConnStatus('reconnecting'));
connection.onreconnected(() => setConnStatus('connected'));
connection.onclose(() => setConnStatus('disconnected'));

// ── Start ────────────────────────────────────────────────────
async function startConnection() {
    try {
        await connection.start();
        setConnStatus('connected');
    } catch (err) {
        setConnStatus('disconnected');
        console.error('SignalR start failed:', err);
        setTimeout(startConnection, 5000);
    }
}

document.addEventListener('DOMContentLoaded', startConnection);
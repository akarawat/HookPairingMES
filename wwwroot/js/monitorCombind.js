/* ============================================================
   wwwroot/js/monitorCombind.js
   SignalR + AJAX client for /Dashboard/MonitorCombind

   Depends on (loaded by _Layout.cshtml):
     - jQuery
     - @microsoft/signalr
   ============================================================ */

'use strict';

$(function () {

    // ── initial mes_id จาก server render (inject จาก Razor) ──────────────
    // ค่าเหล่านี้ถูก set โดย monitorCombind.cshtml ก่อน include ไฟล์นี้:
    //   window.MC = { lastId1: @Model.MeasTable1..., lastId2: @Model.MeasTable2... }
    let lastId1 = (window.MC && window.MC.lastId1) || 0;
    let lastId2 = (window.MC && window.MC.lastId2) || 0;

    // ════════════════════════════════════════════════════════════════════════
    //  HUB 1 — MonitorCombindHub (/hubs/monitorCombind)
    //  poll ทุก 5 วินาที → อัปเดต Feature_2 tables
    // ════════════════════════════════════════════════════════════════════════
    const f2Hub = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/monitorCombind')
        .withAutomaticReconnect([1000, 2000, 5000, 10000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

    f2Hub.on('ReceiveFeature2Update', function (payload) {
        renderF2Table(payload.table1, '#tbody-f2-1', '#badge-t1', 'text-primary',
            lastId1, function (id) { lastId1 = id; });
        renderF2Table(payload.table2, '#tbody-f2-2', '#badge-t2', 'text-success',
            lastId2, function (id) { lastId2 = id; });
        $('#mcLastUpdated').text('Updated: ' + payload.updatedAt);
    });

    f2Hub.onreconnecting(() => setHubStatus('warning', 'Reconnecting…'));
    f2Hub.onreconnected(()  => setHubStatus('success', 'Connected'));
    f2Hub.onclose(()        => setHubStatus('danger',  'Disconnected'));

    f2Hub.start()
        .then(() => setHubStatus('success', 'Connected'))
        .catch(err => { setHubStatus('danger', 'Error'); console.error('f2Hub:', err); });

    // ════════════════════════════════════════════════════════════════════════
    //  HUB 2 — MeasurementHub (/hubs/measurement)  [hub เดิมที่มีอยู่แล้ว]
    //  Payload (camelCase ยืนยันจาก console.log):
    //    partType   "Body" | "Guideway"
    //    a1Axis, a2Axis, z1Axis, x1Axis
    //    macSn, woNo, dtCreate
    // ════════════════════════════════════════════════════════════════════════
    const measureHub = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/measurement')
        .withAutomaticReconnect([1000, 2000, 5000, 10000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

    measureHub.on('ReceiveMeasurement', function (payload) {
        // ── เพิ่ม row ใหม่บนสุดของ Measurement Log (ทุก partType) ────────
        if (window._mcPrependLogRow) window._mcPrependLogRow(payload);

        // ── อัปเดต Hook Body cards เฉพาะ Body เท่านั้น ───────────────────
        if (!payload || payload.partType !== 'Body') return;

        updateChannel('A1', payload.a1Axis);
        updateChannel('A2', payload.a2Axis);
        updateChannel('Z1', payload.z1Axis);
        updateChannel('X1', payload.x1Axis);

        const timeStr = payload.dtCreate
            ? new Date(payload.dtCreate).toLocaleTimeString('th-TH')
            : '—';

        ['A1', 'A2', 'Z1', 'X1'].forEach(function (ch) {
            $('#sn-'   + ch).text(payload.macSn || '—');
            $('#wo-'   + ch).text(payload.woNo  || '—');
            $('#time-' + ch).text(timeStr);
            const $card = $('#card-' + ch);
            $card.addClass('card-updated');
            setTimeout(() => $card.removeClass('card-updated'), 700);
        });
    });

    measureHub.onreconnecting(() => console.log('MeasurementHub: reconnecting…'));
    measureHub.onreconnected(()  => console.log('MeasurementHub: reconnected ✓'));
    measureHub.onclose(()        => console.log('MeasurementHub: closed.'));

    measureHub.start()
        .then(() => console.log('MeasurementHub: connected ✓'))
        .catch(err => console.error('MeasurementHub:', err));

    // ════════════════════════════════════════════════════════════════════════
    //  AJAX — โหลดข้อมูล Hook Body ล่าสุดทันทีที่เปิดหน้า
    //  refresh ทุก 30 วินาที (fallback กรณีไม่มี SignalR event ใหม่)
    // ════════════════════════════════════════════════════════════════════════
    function loadLatestBodyAjax() {
        $.getJSON('/Dashboard/GetRecentJson?topN=50')
            .done(function (data) {
                if (!data || data.length === 0) return;

                // หา Body ล่าสุด → ถ้าไม่มีใช้ record แรก
                let rec = data.find(r => (r.partType || '').toLowerCase() === 'body');
                if (!rec) rec = data[0];
                if (!rec) return;

                updateChannel('A1', rec.a1Axis);
                updateChannel('A2', rec.a2Axis);
                updateChannel('Z1', rec.z1Axis);
                updateChannel('X1', rec.x1Axis);

                const dt = rec.dtCreate || null;
                const timeStr = (dt && !dt.startsWith('0001'))
                    ? new Date(dt).toLocaleTimeString('th-TH')
                    : '—';

                ['A1', 'A2', 'Z1', 'X1'].forEach(function (ch) {
                    $('#sn-'   + ch).text(rec.macSn || '—');
                    $('#wo-'   + ch).text(rec.woNo  || '—');
                    $('#time-' + ch).text(timeStr);
                });
            })
            .fail(function (xhr) {
                console.warn('❌ AJAX GetRecentJson failed:', xhr.status, xhr.statusText);
            });
    }

    loadLatestBodyAjax();                    // โหลดทันทีเมื่อเปิดหน้า
    setInterval(loadLatestBodyAjax, 30000);  // refresh ทุก 30 วินาที

    // ════════════════════════════════════════════════════════════════════════
    //  MEASUREMENT LOG — โหลดข้อมูลล่าสุดเมื่อเปิดหน้า
    //  ใช้ endpoint เดิม /Dashboard/GetRecentJson
    // ════════════════════════════════════════════════════════════════════════
    const MAX_LOG_ROWS = 100;
    let   logRowCount  = 0;

    function loadMeasurementLog() {
        $.getJSON('/Dashboard/GetRecentJson?topN=' + MAX_LOG_ROWS)
            .done(function (data) {
                if (!data || data.length === 0) {
                    $('#mcLogBody').html(
                        '<tr><td colspan="11" class="text-center py-4 text-secondary">' +
                        '<i class="bi bi-inbox me-2"></i>ไม่มีข้อมูล</td></tr>');
                    return;
                }
                let html = '';
                data.forEach(function (r, i) {
                    html += buildLogRow(r, i + 1);
                });
                $('#mcLogBody').html(html);
                logRowCount = data.length;
            })
            .fail(function () {
                $('#mcLogBody').html(
                    '<tr><td colspan="11" class="text-center py-4 text-danger">' +
                    'โหลดข้อมูลไม่สำเร็จ</td></tr>');
            });
    }

    function buildLogRow(r, seq) {
        const isBody = (r.partType || '').toLowerCase() === 'body';
        const partBadge = isBody
            ? '<span style="color:#00d4ff;font-weight:700">Body</span>'
            : '<span style="color:#ff6b35;font-weight:700">GW</span>';
        const dt = r.dtCreate
            ? new Date(r.dtCreate).toLocaleTimeString('th-TH')
            : '—';
        const fmt = v => (v != null && v !== 0) ? parseFloat(v).toFixed(5) : '–.–––––';

        return `<tr>
            <td class="text-muted" style="padding:6px 10px;">${seq}</td>
            <td>${partBadge}</td>
            <td>${escHtml(r.macSn || '–')}</td>
            <td>${escHtml(r.woNo  || '–')}</td>
            <td>${escHtml(r.boxNo || '–')}</td>
            <td>${escHtml(r.oprNo || '–')}</td>
            <td class="text-end">${fmt(r.a1Axis)}</td>
            <td class="text-end">${fmt(r.a2Axis)}</td>
            <td class="text-end">${fmt(r.z1Axis)}</td>
            <td class="text-end">${fmt(r.x1Axis)}</td>
            <td>${dt}</td>
        </tr>`;
    }

    // โหลดครั้งแรกเมื่อเปิดหน้า
    loadMeasurementLog();

    // เพิ่ม row ใหม่บนสุดเมื่อมีข้อมูลจาก SignalR (ReceiveMeasurement)
    // เรียกใช้ภายใน measureHub.on() ด้านบน — ผ่าน prependLogRow()
    window._mcPrependLogRow = function (payload) {
        logRowCount++;
        const newRow = $(buildLogRow(payload, logRowCount));
        newRow.css('background', '#fffde7');   // flash เหลืองสั้นๆ
        $('#mcLogBody').prepend(newRow);
        setTimeout(() => newRow.css('background', ''), 800);

        // ตัด row เกิน MAX_LOG_ROWS
        const rows = $('#mcLogBody tr');
        if (rows.length > MAX_LOG_ROWS) rows.last().remove();
    };

    // ════════════════════════════════════════════════════════════════════════
    //  Helper functions
    // ════════════════════════════════════════════════════════════════════════

    function updateChannel(ch, val) {
        if (val == null) return;
        $('#val-' + ch).text(parseFloat(val).toFixed(5));
    }

    function setHubStatus(cls, text) {
        $('#mcHubStatus')
            .removeClass('bg-secondary bg-success bg-warning bg-danger')
            .addClass('bg-' + cls).text(text);
    }

    function renderF2Table(rows, tbodySel, badgeSel, valClass, prevLastId, setLastId) {
        if (!rows || rows.length === 0) return;
        const newTopId = rows[0].mesId;
        $(badgeSel).text(rows.length + ' rows');

        let html = '';
        rows.forEach(function (r) {
            const badge  = r.classification ===  2 ? 'danger'
                         : r.classification === -2 ? 'primary' : 'success';
            const label  = r.classification ===  2 ? 'HIGH'
                         : r.classification === -2 ? 'LOW' : 'OK';
            const itemno = r.itemNo
                ? `<span title="${escHtml(r.itemNo)}">${escHtml(r.itemNo)}</span>`
                : `<span class="text-muted">—</span>`;

            html += `
            <tr class="${r.mesId > prevLastId ? 'row-new' : ''}">
                <td class="text-muted">${r.mesId}</td>
                <td class="f2-val ${valClass}">${parseFloat(r.opwValue).toFixed(5)}</td>
                <td class="f2-itemno">${itemno}</td>
                <td><span class="badge bg-${badge}">${label}</span></td>
                <td class="f2-time">${r.receivedAt ? formatDt(r.receivedAt) : '—'}</td>
            </tr>`;
        });

        $(tbodySel).html(html);
        if (newTopId > prevLastId) setLastId(newTopId);
    }

    function formatDt(dtStr) {
        const d = new Date(dtStr);
        return String(d.getDate()).padStart(2,'0') + '/' +
               String(d.getMonth()+1).padStart(2,'0') + ' ' +
               String(d.getHours()).padStart(2,'0') + ':' +
               String(d.getMinutes()).padStart(2,'0') + ':' +
               String(d.getSeconds()).padStart(2,'0');
    }

    function escHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

});

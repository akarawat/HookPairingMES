/* ============================================================
   wwwroot/js/rawdata.js
   Data Explorer – paged table with AJAX search
   ============================================================ */

'use strict';

let currentPage = 1;
const pageSize  = 50;

// ── Fetch and render data ─────────────────────────────────────
function loadData(page) {
    currentPage = page;

    const params = {
        partType: $('#rdPartType').val(),
        dateFrom: $('#rdDateFrom').val(),
        dateTo:   $('#rdDateTo').val(),
        woNo:     $('#rdWoNo').val()   || null,
        macSn:    $('#rdMacSn').val()  || null,
        pageNo:   page,
        pageSize: pageSize
    };

    $('#rdTableBody').html(
        '<tr><td colspan="11" class="text-center py-4">' +
        '<span class="spinner-border spinner-border-sm text-secondary"></span>' +
        ' Loading…</td></tr>'
    );

    $.ajax({
        url: '/Dashboard/GetRawDataJson',
        data: params,
        success(result) {
            renderTable(result.Items  || result.items  || []);
            renderPagination(
                result.TotalRecords ?? result.totalRecords ?? 0,
                result.TotalPages   ?? result.totalPages   ?? 1,
                page
            );
            const total = result.TotalRecords ?? result.totalRecords ?? 0;
            $('#rdTotalInfo').text(`${total.toLocaleString()} records`);
        },
        error() {
            $('#rdTableBody').html(
                '<tr><td colspan="11" class="text-center text-danger py-3">Load failed. Retry.</td></tr>'
            );
        }
    });
}

// ── Render table rows ─────────────────────────────────────────
function renderTable(items) {
    if (!items.length) {
        $('#rdTableBody').html(
            '<tr><td colspan="11" class="text-center text-secondary py-4">No records found.</td></tr>'
        );
        return;
    }

    const rows = items.map(r => {
        const isBody = (r.PartType || r.part_type) === 'Body';
        const ptClass = isBody ? 'badge-body-sm' : 'badge-guide-sm';
        const ptLabel = isBody ? 'Body' : 'Guideway';
        const dt = r.DtCreate || r.dt_create;
        const dtFmt = dt ? new Date(dt).toLocaleString('th-TH') : '–';

        return `<tr>
            <td style="font-family:monospace">${r.MesId ?? r.mesId ?? '–'}</td>
            <td class="${ptClass}" style="font-weight:700;font-size:11px">${ptLabel}</td>
            <td>${r.MacSn || r.mac_sn || '–'}</td>
            <td>${r.WoNo  || r.wo_no  || '–'}</td>
            <td>${r.BoxNo || r.box_no || '–'}</td>
            <td>${r.OprNo || r.opr_no || '–'}</td>
            <td>${fmt5(r.A1Axis ?? r.a1axis)}</td>
            <td>${fmt5(r.A2Axis ?? r.a2axis)}</td>
            <td>${fmt5(r.Z1Axis ?? r.z1axis)}</td>
            <td>${fmt5(r.X1Axis ?? r.x1axis)}</td>
            <td style="white-space:nowrap">${dtFmt}</td>
        </tr>`;
    }).join('');

    $('#rdTableBody').html(rows);
}

// ── Pagination ─────────────────────────────────────────────── 
function renderPagination(total, totalPages, currentPage) {
    const from = (currentPage - 1) * pageSize + 1;
    const to   = Math.min(currentPage * pageSize, total);
    $('#rdPageInfo').text(`Showing ${from}–${to} of ${total.toLocaleString()}`);

    const ul = $('#rdPagination').empty();
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
    let end   = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    if (start > 1) { addPage('1', 1); if (start > 2) ul.append('<li class="page-item disabled"><span class="page-link">…</span></li>'); }
    for (let p = start; p <= end; p++) addPage(p, p, false, p === currentPage);
    if (end < totalPages) { if (end < totalPages - 1) ul.append('<li class="page-item disabled"><span class="page-link">…</span></li>'); addPage(totalPages, totalPages); }

    addPage('›', currentPage + 1, currentPage === totalPages);
}

// ── Excel export ──────────────────────────────────────────────
function rdExportExcel() {
    const params = new URLSearchParams({
        partType: $('#rdPartType').val(),
        dateFrom: $('#rdDateFrom').val(),
        dateTo:   $('#rdDateTo').val(),
        woNo:     $('#rdWoNo').val()  || '',
        macSn:    $('#rdMacSn').val() || ''
    });
    const url = `/Dashboard/ExportExcel?${params.toString()}`;
    const a   = document.createElement('a');
    a.href    = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ── Event bindings ────────────────────────────────────────────
$(function () {
    $('#rdSearch').on('click', () => loadData(1));
    $('#rdExport').on('click', rdExportExcel);

    $('#rdPagination').on('click', 'a.page-link', function (e) {
        e.preventDefault();
        const p = parseInt($(this).data('page'), 10);
        if (p > 0) loadData(p);
    });

    // Enter key triggers search
    $('#rdDateFrom, #rdDateTo, #rdWoNo, #rdMacSn, #rdPartType').on('keydown', function (e) {
        if (e.key === 'Enter') loadData(1);
    });
});

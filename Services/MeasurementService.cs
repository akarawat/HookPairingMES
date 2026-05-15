// ============================================================
// File: Services/MeasurementService.cs
// Description: Business logic – insert + broadcast via SignalR
// ============================================================

using HookPairingMES.Data;
using HookPairingMES.Hubs;
using HookPairingMES.Models;
using Microsoft.AspNetCore.SignalR;

namespace HookPairingMES.Services
{
    public interface IMeasurementService
    {
        Task<int> AddHookBodyAsync(CreateMeasurementRequest req);
        Task<int> AddHookGuideAsync(CreateMeasurementRequest req);
        Task<DashboardViewModel> GetDashboardDataAsync(DashboardFilter filter);
        Task<List<HookMeasurement>> GetRecentAsync(int topN = 10);
        Task<PagedResult<HookMeasurement>> GetRawDataAsync(
            string partType, DateTime? from, DateTime? to,
            string? woNo, string? macSn, int pageNo, int pageSize);
    }

    public class MeasurementService : IMeasurementService
    {
        private readonly IDatabaseHelper _db;
        private readonly IHubContext<MeasurementHub> _hub;

        public MeasurementService(IDatabaseHelper db, IHubContext<MeasurementHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        // ── Insert Hook Body + Broadcast ─────────────────────
        public async Task<int> AddHookBodyAsync(CreateMeasurementRequest req)
        {
            int newId = await _db.InsertHookBodyAsync(req);

            var payload = new LiveMeasurementPayload
            {
                PartType = "Body",
                MesId = newId,
                MacSn = req.MacSn,
                WoNo = req.WoNo,
                BoxNo = req.BoxNo,
                OprNo = req.OprNo,
                A1Axis = req.A1Axis,
                A2Axis = req.A2Axis,
                Z1Axis = req.Z1Axis,
                X1Axis = req.X1Axis,
                DtCreate = DateTime.Now
            };

            await _hub.Clients.All.SendAsync("ReceiveMeasurement", payload);

            // Also refresh KPI
            var kpi = await _db.GetDashboardKpiAsync();
            await _hub.Clients.All.SendAsync("ReceiveKpi", kpi);

            return newId;
        }

        // ── Insert Hook Guideway + Broadcast ─────────────────
        public async Task<int> AddHookGuideAsync(CreateMeasurementRequest req)
        {
            int newId = await _db.InsertHookGuideAsync(req);

            var payload = new LiveMeasurementPayload
            {
                PartType = "Guideway",
                MesId = newId,
                MacSn = req.MacSn,
                WoNo = req.WoNo,
                BoxNo = req.BoxNo,
                OprNo = req.OprNo,
                A1Axis = req.A1Axis,
                A2Axis = req.A2Axis,
                Z1Axis = req.Z1Axis,
                X1Axis = req.X1Axis,
                DtCreate = DateTime.Now
            };

            await _hub.Clients.All.SendAsync("ReceiveMeasurement", payload);

            var kpi = await _db.GetDashboardKpiAsync();
            await _hub.Clients.All.SendAsync("ReceiveKpi", kpi);

            return newId;
        }

        // ── Dashboard aggregate ───────────────────────────────
        public async Task<DashboardViewModel> GetDashboardDataAsync(DashboardFilter filter)
        {
            var kpiTask = _db.GetDashboardKpiAsync();
            var bodyBoxTask = _db.GetBoxplotDataAsync("Body", filter.DateFrom, filter.DateTo, filter.WoNo);
            var gwBoxTask = _db.GetBoxplotDataAsync("Guideway", filter.DateFrom, filter.DateTo, filter.WoNo);
            var bodyTrendTask = _db.GetTrendDataAsync("Body", 50);
            var gwTrendTask = _db.GetTrendDataAsync("Guideway", 50);
            var hourlyTask = _db.GetHourlyCountAsync();

            await Task.WhenAll(kpiTask, bodyBoxTask, gwBoxTask, bodyTrendTask, gwTrendTask, hourlyTask);

            return new DashboardViewModel
            {
                Kpi = await kpiTask,
                BodyBoxplot = await bodyBoxTask,
                GuideBoxplot = await gwBoxTask,
                BodyTrend = await bodyTrendTask,
                GuideTrend = await gwTrendTask,
                HourlyCounts = await hourlyTask
            };
        }

        // ── Recent measurements (for monitor page load) ─────────
        public async Task<List<HookMeasurement>> GetRecentAsync(int topN = 10)
        {
            return await _db.GetRecentMeasurementsAsync(topN);
        }

        // ── Raw data (for DataTable) ──────────────────────────
        public async Task<PagedResult<HookMeasurement>> GetRawDataAsync(
            string partType, DateTime? from, DateTime? to,
            string? woNo, string? macSn, int pageNo, int pageSize)
        {
            return await _db.GetRawDataAsync(partType, from, to, woNo, macSn, pageNo, pageSize);
        }
    }
}

// ============================================================
// File: Data/DatabaseHelper.cs
// Description: Dapper-based database access layer
// ============================================================

using System.Data;
using Dapper;
using HookPairingMES.Models;
using Microsoft.Data.SqlClient;

namespace HookPairingMES.Data
{
    public interface IDatabaseHelper
    {
        Task<DashboardKpi>            GetDashboardKpiAsync();
        Task<List<BoxplotStat>>       GetBoxplotDataAsync(string partType, DateTime? from, DateTime? to, string? woNo);
        Task<List<HookMeasurement>>   GetTrendDataAsync(string partType, int topN = 50);
        Task<List<HookMeasurement>>   GetRecentMeasurementsAsync(int topN = 20);
        Task<List<HourlyCount>>       GetHourlyCountAsync();
        Task<PagedResult<HookMeasurement>> GetRawDataAsync(string partType, DateTime? from, DateTime? to, string? woNo, string? macSn, int pageNo, int pageSize);
        Task<int>                     InsertHookBodyAsync(CreateMeasurementRequest req);
        Task<int>                     InsertHookGuideAsync(CreateMeasurementRequest req);
    }

    public class DatabaseHelper : IDatabaseHelper
    {
        private readonly string _connStr;

        public DatabaseHelper(IConfiguration config)
        {
            _connStr = config.GetConnectionString("DBHookParing")
                ?? throw new InvalidOperationException("Connection string 'DBHookParing' not found.");
        }

        private IDbConnection CreateConnection() => new SqlConnection(_connStr);

        // ── KPI ──────────────────────────────────────────────
        public async Task<DashboardKpi> GetDashboardKpiAsync()
        {
            using var conn = CreateConnection();
            var result = await conn.QueryFirstOrDefaultAsync<DashboardKpi>(
                "sp_GetDashboardKPI",
                commandType: CommandType.StoredProcedure
            );
            return result ?? new DashboardKpi();
        }

        // ── Boxplot ──────────────────────────────────────────
        public async Task<List<BoxplotStat>> GetBoxplotDataAsync(
            string partType, DateTime? from, DateTime? to, string? woNo)
        {
            using var conn = CreateConnection();
            var rows = await conn.QueryAsync<BoxplotStat>(
                "sp_GetBoxplotData",
                new { PartType = partType, DateFrom = from?.Date, DateTo = to?.Date, WoNo = woNo },
                commandType: CommandType.StoredProcedure
            );
            return rows.ToList();
        }

        // ── Trend ────────────────────────────────────────────
        public async Task<List<HookMeasurement>> GetTrendDataAsync(string partType, int topN = 50)
        {
            using var conn = CreateConnection();
            var rows = await conn.QueryAsync<HookMeasurement>(
                "sp_GetTrendData",
                new { PartType = partType, TopN = topN },
                commandType: CommandType.StoredProcedure
            );
            // Reverse so chart shows oldest→newest
            return rows.Reverse().ToList();
        }

        // ── Recent live feed ─────────────────────────────────
        public async Task<List<HookMeasurement>> GetRecentMeasurementsAsync(int topN = 20)
        {
            using var conn = CreateConnection();
            var rows = await conn.QueryAsync<HookMeasurement>(
                "sp_GetRecentMeasurements",
                new { TopN = topN },
                commandType: CommandType.StoredProcedure
            );
            return rows.ToList();
        }

        // ── Hourly ───────────────────────────────────────────
        public async Task<List<HourlyCount>> GetHourlyCountAsync()
        {
            using var conn = CreateConnection();
            var rows = await conn.QueryAsync<HourlyCount>(
                "sp_GetHourlyCount",
                commandType: CommandType.StoredProcedure
            );
            return rows.ToList();
        }

        // ── Paged raw data ────────────────────────────────────
        public async Task<PagedResult<HookMeasurement>> GetRawDataAsync(
            string partType, DateTime? from, DateTime? to,
            string? woNo, string? macSn, int pageNo, int pageSize)
        {
            using var conn = CreateConnection();
            var rows = await conn.QueryAsync<HookMeasurement>(
                "sp_GetRawData",
                new
                {
                    PartType = partType,
                    DateFrom = from?.Date,
                    DateTo   = to?.Date,
                    WoNo     = woNo,
                    MacSn    = macSn,
                    PageNo   = pageNo,
                    PageSize = pageSize
                },
                commandType: CommandType.StoredProcedure
            );

            var list = rows.ToList();
            int total = list.FirstOrDefault()?.MesId ?? 0; // total_records mapped separately below

            // Re-map total_records using dynamic
            using var conn2 = CreateConnection();
            var dynRows = await conn2.QueryAsync(
                "sp_GetRawData",
                new
                {
                    PartType = partType,
                    DateFrom = from?.Date,
                    DateTo   = to?.Date,
                    WoNo     = woNo,
                    MacSn    = macSn,
                    PageNo   = pageNo,
                    PageSize = pageSize
                },
                commandType: CommandType.StoredProcedure
            );
            var dynList = dynRows.ToList();
            int totalRecords = dynList.Count > 0 ? (int)(dynList[0].total_records ?? 0) : 0;

            return new PagedResult<HookMeasurement>
            {
                Items        = list,
                TotalRecords = totalRecords,
                PageNo       = pageNo,
                PageSize     = pageSize
            };
        }

        // ── Insert Hook Body ──────────────────────────────────
        public async Task<int> InsertHookBodyAsync(CreateMeasurementRequest req)
        {
            using var conn = CreateConnection();
            var result = await conn.ExecuteScalarAsync<int>(
                "sp_InsertHookBody",
                new
                {
                    a1axis = req.A1Axis, a2axis = req.A2Axis,
                    z1axis = req.Z1Axis, x1axis = req.X1Axis,
                    mac_sn = req.MacSn,  wo_no  = req.WoNo,
                    box_no = req.BoxNo,  opr_no = req.OprNo
                },
                commandType: CommandType.StoredProcedure
            );
            return result;
        }

        // ── Insert Hook Guideway ──────────────────────────────
        public async Task<int> InsertHookGuideAsync(CreateMeasurementRequest req)
        {
            using var conn = CreateConnection();
            var result = await conn.ExecuteScalarAsync<int>(
                "sp_InsertHookGuideway",
                new
                {
                    a1axis = req.A1Axis, a2axis = req.A2Axis,
                    z1axis = req.Z1Axis, x1axis = req.X1Axis,
                    mac_sn = req.MacSn,  wo_no  = req.WoNo,
                    box_no = req.BoxNo,  opr_no = req.OprNo
                },
                commandType: CommandType.StoredProcedure
            );
            return result;
        }
    }
}

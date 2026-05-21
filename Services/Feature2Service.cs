// ============================================================
// File: Services/Feature2Service.cs
// Description: Feature2 data access + Excel export helper
// ============================================================

using System.Data;
using ClosedXML.Excel;
using Dapper;
using HookPairingMES.Models;
using HookPairingMES.Models.Dashboard;
using Microsoft.Data.SqlClient;

namespace HookPairingMES.Services
{
    public interface IFeature2Service
    {
        Task<PagedResult<Feature2Record>> GetPagedAsync(Feature2Filter filter);
        Task<List<Feature2Record>> GetExportAsync(Feature2Filter filter);
        Task<List<Feature2Record>> GetLatestAsync(string tableName, int top = 5);
        Task<List<HookMeasurement>> GetHookExportAsync(string partType, DateTime? from, DateTime? to, string? woNo, string? macSn);
        byte[] BuildFeature2Excel(List<Feature2Record> data, string tableName);
        byte[] BuildHookExcel(List<HookMeasurement> data, string partType);
    }

    public class Feature2Service : IFeature2Service
    {
        private readonly string _connStr;

        private static readonly HashSet<string> AllowedTables = new(StringComparer.OrdinalIgnoreCase)
        {
            "Feature_2_Measurement",
            "Feature_2_Measurement_2"
        };

        public Feature2Service(IConfiguration config)
        {
            _connStr = config.GetConnectionString("DBHookParing")
                ?? throw new InvalidOperationException("Connection string 'DBHookParing' not found.");
        }

        private IDbConnection Conn() => new SqlConnection(_connStr);

        // ── Paged data ────────────────────────────────────────
        public async Task<PagedResult<Feature2Record>> GetPagedAsync(Feature2Filter f)
        {
            if (!AllowedTables.Contains(f.TableName))
                throw new ArgumentException("Table not permitted.");

            using var conn = Conn();

            // Use dynamic to capture TotalRecords without modifying Feature2Record
            var dynRows = await conn.QueryAsync(
                "sp_GetFeature2Paged",
                new
                {
                    TableName = f.TableName,
                    DateFrom = f.DateFrom?.Date,
                    DateTo = f.DateTo?.Date,
                    ItemNo = f.ItemNo,
                    PageNo = f.PageNo,
                    PageSize = f.PageSize
                },
                commandType: CommandType.StoredProcedure
            );

            var dynList = dynRows.ToList();
            int total = dynList.Count > 0 ? (int)(dynList[0].TotalRecords ?? 0) : 0;

            // Map dynamic rows → Feature2Record
            var list = dynList.Select(r => new Feature2Record
            {
                MesId = (int)r.MesId,
                OpwValue = (float)r.OpwValue,
                Measured = (int)r.Measured,
                Classification = (int)r.Classification,
                ItemNo = (string?)r.ItemNo,
                ReceivedAt = (DateTime)r.ReceivedAt
            }).ToList();

            return new PagedResult<Feature2Record>
            {
                Items = list,
                TotalRecords = total,
                PageNo = f.PageNo,
                PageSize = f.PageSize
            };
        }

        // ── Latest N rows (for MonitorCombind broadcaster) ──────
        public async Task<List<Feature2Record>> GetLatestAsync(string tableName, int top = 5)
        {
            if (!AllowedTables.Contains(tableName))
                throw new ArgumentException($"Table '{tableName}' is not permitted.");

            using var conn = Conn();
            // Table name is whitelisted — safe to interpolate
            string sql = $@"
                SELECT TOP (@top)
                    mes_id         AS MesId,
                    opw_value      AS OpwValue,
                    measured       AS Measured,
                    classification AS Classification,
                    itemno         AS ItemNo,
                    received_at    AS ReceivedAt
                FROM dbo.[{tableName}]
                ORDER BY mes_id DESC";

            var rows = await conn.QueryAsync<Feature2Record>(sql, new { top });
            return rows.ToList();
        }

        // ── All data for export ───────────────────────────────
        public async Task<List<Feature2Record>> GetExportAsync(Feature2Filter f)
        {
            if (!AllowedTables.Contains(f.TableName))
                throw new ArgumentException("Table not permitted.");

            using var conn = Conn();
            var rows = await conn.QueryAsync<Feature2Record>(
                "sp_ExportFeature2Data",
                new
                {
                    TableName = f.TableName,
                    DateFrom = f.DateFrom?.Date,
                    DateTo = f.DateTo?.Date,
                    ItemNo = f.ItemNo
                },
                commandType: CommandType.StoredProcedure
            );
            return rows.ToList();
        }

        // ── Hook data for export ──────────────────────────────
        public async Task<List<HookMeasurement>> GetHookExportAsync(
            string partType, DateTime? from, DateTime? to, string? woNo, string? macSn)
        {
            using var conn = Conn();
            var rows = await conn.QueryAsync<HookMeasurement>(
                "sp_ExportHookData",
                new
                {
                    PartType = partType,
                    DateFrom = from?.Date,
                    DateTo = to?.Date,
                    WoNo = woNo,
                    MacSn = macSn
                },
                commandType: CommandType.StoredProcedure
            );
            return rows.ToList();
        }

        // ── Build Feature2 Excel ──────────────────────────────
        public byte[] BuildFeature2Excel(List<Feature2Record> data, string tableName)
        {
            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add(tableName.Length > 31 ? tableName[..31] : tableName);

            // ── Header style ──────────────────────────────────
            var headerStyle = wb.Style;
            string[] headers = { "ID", "Value (F2)", "Measured", "Classification", "Item No", "Received At" };

            for (int i = 0; i < headers.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1F4E79");
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }

            // ── Data rows ─────────────────────────────────────
            for (int r = 0; r < data.Count; r++)
            {
                var rec = data[r];
                int row = r + 2;
                ws.Cell(row, 1).Value = rec.MesId;
                ws.Cell(row, 2).Value = rec.OpwValue;
                ws.Cell(row, 2).Style.NumberFormat.Format = "0.00000";
                ws.Cell(row, 3).Value = rec.Measured;
                ws.Cell(row, 4).Value = rec.ClassLabel;
                ws.Cell(row, 5).Value = rec.ItemNo ?? "–";
                ws.Cell(row, 6).Value = rec.ReceivedAt;
                ws.Cell(row, 6).Style.NumberFormat.Format = "dd/MM/yyyy HH:mm:ss";

                // Colour classification
                var clsCell = ws.Cell(row, 4);
                clsCell.Style.Fill.BackgroundColor = rec.Classification switch
                {
                    1 => XLColor.FromHtml("#D4EDDA"),
                    0 => XLColor.FromHtml("#F8D7DA"),
                    2 => XLColor.FromHtml("#FFF3CD"),
                    _ => XLColor.White
                };

                // Zebra row
                if (r % 2 == 1)
                {
                    foreach (var col in new[] { 1, 2, 3, 5, 6 })
                        ws.Cell(row, col).Style.Fill.BackgroundColor = XLColor.FromHtml("#F5F5F5");
                }
            }

            ws.Columns().AdjustToContents();
            ws.SheetView.FreezeRows(1);
            ws.RangeUsed()!.SetAutoFilter();

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return ms.ToArray();
        }

        // ── Build Hook Measurement Excel ──────────────────────
        public byte[] BuildHookExcel(List<HookMeasurement> data, string partType)
        {
            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add($"Hook {partType}");

            string[] headers = { "ID", "Serial No.", "WO No.", "Box No.", "OPR No.",
                                  "A1 Axis", "A2 Axis", "Z1 Axis", "X1 Axis", "Measured At" };

            for (int i = 0; i < headers.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = partType == "Body"
                    ? XLColor.FromHtml("#004B6E")
                    : XLColor.FromHtml("#7B3F00");
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }

            for (int r = 0; r < data.Count; r++)
            {
                var rec = data[r];
                int row = r + 2;
                ws.Cell(row, 1).Value = rec.MesId;
                ws.Cell(row, 2).Value = rec.MacSn;
                ws.Cell(row, 3).Value = rec.WoNo ?? "–";
                ws.Cell(row, 4).Value = rec.BoxNo ?? "–";
                ws.Cell(row, 5).Value = rec.OprNo ?? "–";
                ws.Cell(row, 6).Value = rec.A1Axis;
                ws.Cell(row, 7).Value = rec.A2Axis;
                ws.Cell(row, 8).Value = rec.Z1Axis;
                ws.Cell(row, 9).Value = rec.X1Axis;
                ws.Cell(row, 10).Value = rec.DtCreate;

                string numFmt = "0.00000";
                foreach (var col in new[] { 6, 7, 8, 9 })
                    ws.Cell(row, col).Style.NumberFormat.Format = numFmt;
                ws.Cell(row, 10).Style.NumberFormat.Format = "dd/MM/yyyy HH:mm:ss";

                if (r % 2 == 1)
                    for (int col = 1; col <= 10; col++)
                        ws.Cell(row, col).Style.Fill.BackgroundColor = XLColor.FromHtml("#F5F5F5");
            }

            ws.Columns().AdjustToContents();
            ws.SheetView.FreezeRows(1);
            ws.RangeUsed()!.SetAutoFilter();

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return ms.ToArray();
        }
    }
}

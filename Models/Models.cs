// ============================================================
// File: Models/HookMeasurement.cs
// Description: Domain models for Hook Body & Guideway
// ============================================================

namespace HookPairingMES.Models
{
    // ── Shared measurement model (maps both tables) ──────────
    public class HookMeasurement
    {
        public int MesId { get; set; }
        public decimal A1Axis { get; set; }
        public decimal A2Axis { get; set; }
        public decimal Z1Axis { get; set; }
        public decimal X1Axis { get; set; }
        public string MacSn { get; set; } = string.Empty;
        public string? WoNo { get; set; }
        public string? BoxNo { get; set; }
        public string? OprNo { get; set; }
        public DateTime DtCreate { get; set; }
        public string? PartType { get; set; }   // "Body" | "Guideway"
    }

    // ── Boxplot statistics per axis ──────────────────────────
    public class BoxplotStat
    {
        public string AxisName { get; set; } = string.Empty;
        public decimal MinVal { get; set; }
        public decimal MaxVal { get; set; }
        public decimal MeanVal { get; set; }
        public decimal Q1 { get; set; }
        public decimal MedianVal { get; set; }
        public decimal Q3 { get; set; }
        public decimal StdDev { get; set; }
        public int N { get; set; }
    }

    // ── Dashboard KPI ────────────────────────────────────────
    public class DashboardKpi
    {
        public int BodyCountToday { get; set; }
        public int BodySnToday { get; set; }
        public int BodyCountTotal { get; set; }
        public int GwCountToday { get; set; }
        public int GwSnToday { get; set; }
        public int GwCountTotal { get; set; }
        public DateTime? BodyLastMeasure { get; set; }
        public DateTime? GwLastMeasure { get; set; }
    }

    // ── Hourly count ─────────────────────────────────────────
    public class HourlyCount
    {
        public int HourSlot { get; set; }
        public string PartType { get; set; } = string.Empty;
        public int MeasureCount { get; set; }
    }

    // ── Paged raw data ────────────────────────────────────────
    public class PagedResult<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalRecords { get; set; }
        public int PageNo { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling((double)TotalRecords / PageSize);
    }
}


// ============================================================
// File: Models/ApiModels.cs
// Description: Request/Response DTOs for REST API
// ============================================================

namespace HookPairingMES.Models
{
    // ── Inbound: Create measurement ──────────────────────────
    public class CreateMeasurementRequest
    {
        public decimal A1Axis { get; set; }
        public decimal A2Axis { get; set; }
        public decimal Z1Axis { get; set; }
        public decimal X1Axis { get; set; }
        public string MacSn { get; set; } = string.Empty;
        public string? WoNo { get; set; }
        public string? BoxNo { get; set; }
        public string? OprNo { get; set; }
    }

    // ── Outbound: API response wrapper ───────────────────────
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }

        public static ApiResponse<T> Ok(T data, string msg = "Success")
            => new() { Success = true, Message = msg, Data = data };

        public static ApiResponse<T> Fail(string msg)
            => new() { Success = false, Message = msg };
    }

    // ── Dashboard filter ─────────────────────────────────────
    public class DashboardFilter
    {
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
        public string? WoNo { get; set; }
    }

    // ── SignalR live update payload ───────────────────────────
    public class LiveMeasurementPayload
    {
        public string PartType { get; set; } = string.Empty;
        public int MesId { get; set; }
        public string MacSn { get; set; } = string.Empty;
        public string? WoNo { get; set; }
        public string? BoxNo { get; set; }
        public string? OprNo { get; set; }
        public decimal A1Axis { get; set; }
        public decimal A2Axis { get; set; }
        public decimal Z1Axis { get; set; }
        public decimal X1Axis { get; set; }
        public DateTime DtCreate { get; set; }
    }
}


// ============================================================
// File: Models/DashboardViewModel.cs
// Description: ViewModel for Dashboard/Index view
// ============================================================

namespace HookPairingMES.Models
{
    public class DashboardViewModel
    {
        public DashboardKpi Kpi { get; set; } = new();
        public List<BoxplotStat> BodyBoxplot { get; set; } = new();
        public List<BoxplotStat> GuideBoxplot { get; set; } = new();
        public List<HookMeasurement> BodyTrend { get; set; } = new();
        public List<HookMeasurement> GuideTrend { get; set; } = new();
        public List<HourlyCount> HourlyCounts { get; set; } = new();
    }
}

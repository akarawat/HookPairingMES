// ============================================================
// File: Models/Feature2Models.cs
// Description: NEW models only — Feature2Record, MonitorCombindPayload
//              already exist in the project; do NOT redefine them.
// ============================================================

namespace HookPairingMES.Models.Dashboard
{
    // Filter/paging params for Feature2 Data Explorer (new)
    public class Feature2Filter
    {
        public string TableName { get; set; } = "Feature_2_Measurement";
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
        public string? ItemNo { get; set; }
        public int PageNo { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }
}

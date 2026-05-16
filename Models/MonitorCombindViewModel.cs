namespace HookPairingMES.Models.Dashboard;

// ── Feature_2 record (shared shape for both tables) ────────────────────────
public class Feature2Record
{
    public int      MesId          { get; set; }
    public double   OpwValue       { get; set; }
    public int      Measured       { get; set; }
    public int      Classification { get; set; }
    public string?  ItemNo         { get; set; }
    public DateTime ReceivedAt     { get; set; }

    public string ClassLabel => Classification switch
    {
         2 => "HIGH",
        -2 => "LOW",
        _  => "OK"
    };
    public string ClassBadge => Classification switch
    {
         2 => "danger",
        -2 => "primary",
        _  => "success"
    };
}

// ── Hook Body channel (A1/A2/Z1/X1) — same shape as existing pages ─────────
public class HookBodyChannel
{
    public string   ChannelName    { get; set; } = "";   // "A1","A2","Z1","X1"
    public double   LatestValue    { get; set; }
    public string?  ItemNo         { get; set; }
    public string   Status         { get; set; } = "OK"; // OK / HIGH / LOW
    public DateTime MeasuredAt     { get; set; }
}

// ── Page ViewModel ─────────────────────────────────────────────────────────
public class MonitorCombindViewModel
{
    public List<HookBodyChannel> HookBodyChannels    { get; set; } = new();
    public List<Feature2Record>  MeasTable1          { get; set; } = new();   // Feature_2_Measurement
    public List<Feature2Record>  MeasTable2          { get; set; } = new();   // Feature_2_Measurement_2
    public DateTime              LastRefreshed        { get; set; } = DateTime.Now;
}

// ── SignalR push payload ───────────────────────────────────────────────────
public class MonitorCombindPayload
{
    public List<Feature2Record> Table1 { get; set; } = new();
    public List<Feature2Record> Table2 { get; set; } = new();
    public string               UpdatedAt { get; set; } = "";
}

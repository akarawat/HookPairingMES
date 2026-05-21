using Microsoft.AspNetCore.SignalR;
using HookPairingMES.Models.Dashboard;
using HookPairingMES.Services;

namespace HookPairingMES.Hubs;

/// <summary>
/// SignalR Hub — pushes Feature_2 data to all connected clients on the
/// /Dashboard/MonitorCombind page.
///
/// Client connects to: /hubs/monitorCombind
/// Client listens to : hub.on("ReceiveFeature2Update", payload => { ... })
/// </summary>
public class MonitorCombindHub : Hub
{
    // Clients call this to request an immediate refresh
    public async Task RequestRefresh()
    {
        await Clients.Caller.SendAsync("RefreshRequested");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Background service — polls DB every N seconds and broadcasts to all clients
// ─────────────────────────────────────────────────────────────────────────────
public class MonitorCombindBroadcaster : BackgroundService
{
    private readonly IHubContext<MonitorCombindHub> _hub;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MonitorCombindBroadcaster> _logger;
    private readonly int _intervalMs;

    public MonitorCombindBroadcaster(
        IHubContext<MonitorCombindHub> hub,
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        ILogger<MonitorCombindBroadcaster> logger)
    {
        _hub = hub;
        _scopeFactory = scopeFactory;
        _logger = logger;
        // Default poll interval: 5 seconds. Override in appsettings.json
        _intervalMs = config.GetValue<int>("MonitorCombind:PollIntervalSeconds", 5) * 1000;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "MonitorCombindBroadcaster started — polling every {ms}ms", _intervalMs);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await BroadcastAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MonitorCombindBroadcaster error");
            }
            await Task.Delay(_intervalMs, stoppingToken);
        }
    }

    private async Task BroadcastAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IFeature2Service>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var topN = config.GetValue<int>("MonitorCombind:Feature2TopN", 5);

        var t1 = await svc.GetLatestAsync("Feature_2_Measurement", topN);
        var t2 = await svc.GetLatestAsync("Feature_2_Measurement_2", topN);

        var payload = new MonitorCombindPayload
        {
            Table1 = t1,
            Table2 = t2,
            UpdatedAt = DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss")
        };

        await _hub.Clients.All.SendAsync("ReceiveFeature2Update", payload);
    }
}

// ============================================================
// File: Hubs/MeasurementHub.cs
// Description: SignalR Hub – broadcast live measurement events
// ============================================================

using HookPairingMES.Models;
using Microsoft.AspNetCore.SignalR;

namespace HookPairingMES.Hubs
{
    public class MeasurementHub : Hub
    {
        // Called by server to push new measurement to all clients
        public async Task BroadcastMeasurement(LiveMeasurementPayload payload)
        {
            await Clients.All.SendAsync("ReceiveMeasurement", payload);
        }

        // Called by server to push updated KPI to all clients
        public async Task BroadcastKpi(DashboardKpi kpi)
        {
            await Clients.All.SendAsync("ReceiveKpi", kpi);
        }

        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }
    }
}

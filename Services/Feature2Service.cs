using Microsoft.Data.SqlClient;
using System.Data;
using HookPairingMES.Models.Dashboard;

namespace HookPairingMES.Services;

public interface IFeature2Service
{
    Task<List<Feature2Record>> GetLatestAsync(string tableName, int top = 5);
}

public class Feature2Service : IFeature2Service
{
    private readonly string _connectionString;
    private readonly ILogger<Feature2Service> _logger;

    // Allowed table names — whitelist to prevent SQL injection
    private static readonly HashSet<string> _allowedTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "Feature_2_Measurement",
        "Feature_2_Measurement_2"
    };

    public Feature2Service(IConfiguration config, ILogger<Feature2Service> logger)
    {
        _connectionString = config.GetConnectionString("DBHookParing")
            ?? throw new InvalidOperationException(
                "Connection string 'DBHookParing' not found in appsettings.json");
        _logger = logger;
    }

    /// <summary>
    /// Returns the latest <paramref name="top"/> records from the specified table.
    /// Only whitelisted table names are accepted.
    /// </summary>
    public async Task<List<Feature2Record>> GetLatestAsync(string tableName, int top = 5)
    {
        if (!_allowedTables.Contains(tableName))
            throw new ArgumentException($"Table '{tableName}' is not permitted.", nameof(tableName));

        var result = new List<Feature2Record>();

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // Table name is whitelisted above — safe to interpolate
        string sql = $@"
            SELECT TOP (@top)
                mes_id, opw_value, measured, classification, itemno, received_at
            FROM   dbo.[{tableName}]
            ORDER  BY mes_id DESC";

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@top", top);

        await using var rdr = await cmd.ExecuteReaderAsync();
        while (await rdr.ReadAsync())
        {
            result.Add(new Feature2Record
            {
                MesId          = rdr.GetInt32(0),
                OpwValue       = rdr.GetFloat(1),
                Measured       = rdr.GetInt32(2),
                Classification = rdr.GetInt32(3),
                ItemNo         = rdr.IsDBNull(4) ? null : rdr.GetString(4),
                ReceivedAt     = rdr.GetDateTime(5)
            });
        }

        return result;
    }
}

// ============================================================
// File: Program.cs
// Description: .NET Core 8 LTS App bootstrap
// ============================================================

using HookPairingMES.Data;
using HookPairingMES.Hubs;
using HookPairingMES.Services;

var builder = WebApplication.CreateBuilder(args);

// ── MVC + Razor Pages ────────────────────────────────────────
builder.Services.AddControllersWithViews()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = null; // keep PascalCase
    });

// ── SignalR ──────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── DI – Data & Services ─────────────────────────────────────
builder.Services.AddScoped<IDatabaseHelper, DatabaseHelper>();
builder.Services.AddScoped<IMeasurementService, MeasurementService>();

// ── CORS (allow measurement machines on LAN) ─────────────────
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("LanPolicy", p =>
        p.AllowAnyOrigin()
         .AllowAnyMethod()
         .AllowAnyHeader());
});

// ── Swagger (optional, useful for API testing) ───────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "HookPairing MES API", Version = "v1" });
});

// ── Logging ──────────────────────────────────────────────────
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddEventSourceLogger();

var app = builder.Build();

// ── Pipeline ─────────────────────────────────────────────────
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseCors("LanPolicy");
app.UseAuthorization();

// ── Swagger UI ───────────────────────────────────────────────
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "HookPairing MES API v1"));

// ── MVC Routes ───────────────────────────────────────────────
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Dashboard}/{action=Index}/{id?}");

// ── SignalR Hub ───────────────────────────────────────────────
app.MapHub<MeasurementHub>("/hubs/measurement");

app.Run();

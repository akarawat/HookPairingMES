// ============================================================
// File: Controllers/Feature2Controller.cs
// Description: Feature2 Data Explorer + Excel Export
// ============================================================

using System.Text.Json;
using HookPairingMES.Models;
using HookPairingMES.Models.Dashboard;
using HookPairingMES.Services;
using Microsoft.AspNetCore.Mvc;

namespace HookPairingMES.Controllers
{
    public class Feature2Controller : Controller
    {
        private readonly IFeature2Service _svc;
        private readonly IConfiguration _config;
        private readonly ILogger<Feature2Controller> _log;

        public Feature2Controller(IFeature2Service svc, IConfiguration config, ILogger<Feature2Controller> log)
        {
            _svc = svc;
            _config = config;
            _log = log;
        }

        // GET: /Feature2/Explorer
        public IActionResult Explorer()
        {
            // ส่ง Classification config ไปยัง View เพื่อใช้ใน JS
            var section = _config.GetSection("Feature2Classification");
            var rules = section.GetSection("Rules").Get<List<ClassRule>>() ?? new();
            var def = section.GetSection("Default").Get<ClassRule>()
                          ?? new ClassRule { Label = "OK", Badge = "success" };

            var limits = section.GetSection("Limits").Get<List<LimitRule>>() ?? new();

            ViewBag.ClassConfigJson = JsonSerializer.Serialize(new
            {
                rules,
                defaultRule = def,
                limits
            });
            ViewBag.AutoRefreshSeconds = _config.GetValue<int>("Feature2Explorer:AutoRefreshSeconds", 180);
            return View();
        }

        private class ClassRule
        {
            public int? Value { get; set; }
            public string Label { get; set; } = "OK";
            public string Badge { get; set; } = "success";
        }

        private class LimitRule
        {
            public string Label { get; set; } = "";
            public double Value { get; set; }
            public string Color { get; set; } = "#ff3d57";
            public bool Dash { get; set; } = true;
        }

        // AJAX: /Feature2/GetJson
        [HttpGet]
        public async Task<IActionResult> GetJson(
            string tableName = "Feature_2_Measurement",
            DateTime? dateFrom = null, DateTime? dateTo = null,
            string? itemNo = null, int pageNo = 1, int pageSize = 50)
        {
            try
            {
                var filter = new Feature2Filter
                {
                    TableName = tableName,
                    DateFrom = dateFrom,
                    DateTo = dateTo,
                    ItemNo = string.IsNullOrWhiteSpace(itemNo) ? null : itemNo,
                    PageNo = pageNo,
                    PageSize = pageSize
                };

                var result = await _svc.GetPagedAsync(filter);
                return Json(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: /Feature2/ExportExcel
        [HttpGet]
        public async Task<IActionResult> ExportExcel(
            string tableName = "Feature_2_Measurement",
            DateTime? dateFrom = null, DateTime? dateTo = null,
            string? itemNo = null)
        {
            try
            {
                var filter = new Feature2Filter
                {
                    TableName = tableName,
                    DateFrom = dateFrom,
                    DateTo = dateTo,
                    ItemNo = string.IsNullOrWhiteSpace(itemNo) ? null : itemNo
                };

                var data = await _svc.GetExportAsync(filter);
                var bytes = _svc.BuildFeature2Excel(data, tableName);

                string filename = $"{tableName}_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
                return File(bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    filename);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Feature2 Excel export failed");
                return StatusCode(500, "Export failed.");
            }
        }
    }
}

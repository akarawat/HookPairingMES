// ============================================================
// File: Controllers/DashboardController.cs
// Description: MVC Controller – Dashboard views
// ============================================================

using HookPairingMES.Models;
using HookPairingMES.Services;
using Microsoft.AspNetCore.Mvc;

namespace HookPairingMES.Controllers
{
    public class DashboardController : Controller
    {
        private readonly IMeasurementService _svc;

        public DashboardController(IMeasurementService svc) => _svc = svc;

        // GET: /Dashboard  (main real-time dashboard)
        public async Task<IActionResult> Index()
        {
            var filter = new DashboardFilter
            {
                DateFrom = DateTime.Today.AddDays(-7),
                DateTo = DateTime.Today
            };
            var vm = await _svc.GetDashboardDataAsync(filter);
            return View(vm);
        }

        // GET: /Dashboard/Monitor  (real-time numeric monitor)
        public IActionResult Monitor() => View();

        // GET: /Dashboard/RawData  (data explorer page)
        public IActionResult RawData() => View();

        // AJAX: /Dashboard/GetDashboardJson
        [HttpGet]
        public async Task<IActionResult> GetDashboardJson(
            DateTime? dateFrom, DateTime? dateTo, string? woNo)
        {
            var filter = new DashboardFilter
            {
                DateFrom = dateFrom ?? DateTime.Today.AddDays(-7),
                DateTo = dateTo ?? DateTime.Today,
                WoNo = woNo
            };
            var vm = await _svc.GetDashboardDataAsync(filter);
            return Json(vm);
        }

        // AJAX: /Dashboard/GetRecentJson
        [HttpGet]
        public async Task<IActionResult> GetRecentJson(int topN = 10)
        {
            var items = await _svc.GetRecentAsync(topN);
            return Json(items);
        }

        // AJAX: /Dashboard/GetRawDataJson
        [HttpGet]
        public async Task<IActionResult> GetRawDataJson(
            string partType = "Body",
            DateTime? dateFrom = null, DateTime? dateTo = null,
            string? woNo = null, string? macSn = null,
            int pageNo = 1, int pageSize = 50)
        {
            var result = await _svc.GetRawDataAsync(
                partType, dateFrom, dateTo, woNo, macSn, pageNo, pageSize);
            return Json(result);
        }
    }
}


// ============================================================
// File: Controllers/MeasureApiController.cs
// Description: REST API Controller – receive measurement data
//              from measuring machines / external systems
// ============================================================

namespace HookPairingMES.Controllers
{
    [ApiController]
    [Route("api/measure")]
    [Produces("application/json")]
    public class MeasureApiController : ControllerBase
    {
        private readonly IMeasurementService _svc;
        private readonly ILogger<MeasureApiController> _log;

        public MeasureApiController(IMeasurementService svc, ILogger<MeasureApiController> log)
        {
            _svc = svc;
            _log = log;
        }

        /// <summary>
        /// POST /api/measure/body
        /// Insert Hook Body measurement and push real-time update
        /// </summary>
        [HttpPost("body")]
        public async Task<IActionResult> PostHookBody([FromBody] CreateMeasurementRequest req)
        {
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse<object>.Fail("Invalid request data."));

            if (string.IsNullOrWhiteSpace(req.MacSn))
                return BadRequest(ApiResponse<object>.Fail("mac_sn is required."));

            try
            {
                int newId = await _svc.AddHookBodyAsync(req);
                _log.LogInformation("Hook Body inserted: mesId={Id}, mac_sn={Sn}", newId, req.MacSn);
                return Ok(ApiResponse<object>.Ok(new { mesId = newId }, "Hook Body measurement saved."));
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error inserting Hook Body for mac_sn={Sn}", req.MacSn);
                return StatusCode(500, ApiResponse<object>.Fail("Internal server error."));
            }
        }

        /// <summary>
        /// POST /api/measure/guideway
        /// Insert Hook Guideway measurement and push real-time update
        /// </summary>
        [HttpPost("guideway")]
        public async Task<IActionResult> PostHookGuideway([FromBody] CreateMeasurementRequest req)
        {
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse<object>.Fail("Invalid request data."));

            if (string.IsNullOrWhiteSpace(req.MacSn))
                return BadRequest(ApiResponse<object>.Fail("mac_sn is required."));

            try
            {
                int newId = await _svc.AddHookGuideAsync(req);
                _log.LogInformation("Hook Guideway inserted: mesId={Id}, mac_sn={Sn}", newId, req.MacSn);
                return Ok(ApiResponse<object>.Ok(new { mesId = newId }, "Hook Guideway measurement saved."));
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error inserting Hook Guideway for mac_sn={Sn}", req.MacSn);
                return StatusCode(500, ApiResponse<object>.Fail("Internal server error."));
            }
        }

        /// <summary>
        /// GET /api/measure/health
        /// Health check endpoint
        /// </summary>
        [HttpGet("health")]
        public IActionResult Health()
            => Ok(new { status = "ok", timestamp = DateTime.Now });
    }
}

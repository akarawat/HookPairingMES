# Hook Pairing MES — Real-Time Dashboard

ระบบ MES สำหรับติดตามการวัดชิ้นงาน **Hook Body** และ **Hook Guideway**  
พร้อม Real-Time Dashboard และ REST API รับค่าจากเครื่องวัด

---

## 📁 Project Structure

```
HookPairingMES/
├── Controllers/
│   └── Controllers.cs          ← DashboardController + MeasureApiController
├── Data/
│   └── DatabaseHelper.cs       ← ADO.NET / Dapper + Stored Procedures
├── Hubs/
│   └── MeasurementHub.cs       ← SignalR Hub
├── Models/
│   └── Models.cs               ← HookMeasurement, BoxplotStat, DashboardKpi …
├── Services/
│   └── MeasurementService.cs   ← Business logic + SignalR broadcast
├── Views/
│   ├── Dashboard/
│   │   ├── Index.cshtml        ← Real-time dashboard
│   │   └── RawData.cshtml      ← Data explorer / paged table
│   └── Shared/
│       └── _Layout.cshtml      ← Dark industrial layout
├── wwwroot/
│   ├── css/
│   │   └── site.css            ← Dark MES theme
│   └── js/
│       ├── site.js             ← Shared utilities (clock, helpers)
│       ├── dashboard.js        ← All chart logic (Boxplot, Trend, Hourly)
│       ├── realtime.js         ← SignalR client
│       └── rawdata.js          ← Data explorer AJAX + pagination
├── SQL/
│   ├── 01_CreateTables.sql
│   └── 02_StoredProcedures.sql
├── Program.cs
├── appsettings.json
├── web.config                  ← IIS hosting
└── HookPairingMES.csproj
```

---

## 🗄️ Database Setup

1. สร้าง Database ใน SQL Server:
```sql
CREATE DATABASE DBHookParing;
```

2. รัน script ตามลำดับ:
```
SQL/01_CreateTables.sql
SQL/02_StoredProcedures.sql
```

3. อัปเดต connection string ใน `appsettings.json`:
```json
"DBHookParing": "Server=YOUR_SERVER;Database=DBHookParing;User Id=YOUR_USER;Password=YOUR_PASS;TrustServerCertificate=True;"
```

---

## 🌐 REST API Endpoints

### Insert Hook Body Measurement
```http
POST /api/measure/body
Content-Type: application/json

{
  "A1Axis": 10.00123,
  "A2Axis": 10.00456,
  "Z1Axis": 5.00789,
  "X1Axis": 8.00234,
  "MacSn":  "HB-2024-001",
  "WoNo":   "WO-001",
  "BoxNo":  "BOX-01",
  "OprNo":  "OPR-01"
}
```

**Response:**
```json
{ "Success": true, "Message": "Hook Body measurement saved.", "Data": { "mesId": 42 } }
```

---

### Insert Hook Guideway Measurement
```http
POST /api/measure/guideway
Content-Type: application/json

{
  "A1Axis": 9.99876,
  "A2Axis": 9.99543,
  "Z1Axis": 4.99210,
  "X1Axis": 7.99765,
  "MacSn":  "HG-2024-001",
  "WoNo":   "WO-001",
  "BoxNo":  "BOX-02",
  "OprNo":  "OPR-02"
}
```

---

### Health Check
```http
GET /api/measure/health
```

---

### Swagger UI
```
http://your-server/swagger
```

---

## 📡 SignalR Events

| Event (Client receives)   | Payload            | Description                        |
|---------------------------|--------------------|------------------------------------|
| `ReceiveMeasurement`      | `LiveMeasurementPayload` | ค่าวัดใหม่ push ทุกครั้งที่ insert |
| `ReceiveKpi`              | `DashboardKpi`     | KPI updated หลังทุก insert         |

Hub URL: `/hubs/measurement`

---

## 📊 Dashboard Features

| Feature                | Details                                          |
|------------------------|--------------------------------------------------|
| KPI Cards              | Body/Guideway today count, SN count, last time   |
| Boxplot Charts         | 4 axes (A1, A2, Z1, X1) per part type           |
| Trend / Control Chart  | Last 50 readings with UCL/Mean/LCL lines         |
| Hourly Bar Chart       | Production per hour today                        |
| Live Feed              | Real-time list of incoming measurements          |
| Auto-refresh           | Charts refresh every 60 seconds                  |
| Filter                 | By date range + Work Order                       |

---

## 🖥️ IIS Publish

1. Publish จาก Visual Studio:  
   `Build → Publish → Folder` → เลือก path บน IIS

2. หรือใช้ CLI:
```bash
dotnet publish -c Release -o ./publish
```

3. IIS Application Pool:
   - **.NET CLR Version**: No Managed Code
   - **Managed Pipeline**: Integrated

4. **เปิด WebSocket** ใน IIS Features:
   - IIS Manager → Server → Turn Windows features on/off → WebSocket Protocol ✅

---

## 📦 NuGet Packages

| Package                          | Version  | Use                    |
|----------------------------------|----------|------------------------|
| `Dapper`                         | 2.1.35   | Stored Procedure calls |
| `Microsoft.Data.SqlClient`       | 5.2.1    | SQL Server connection  |
| `Swashbuckle.AspNetCore`         | 6.6.2    | Swagger UI             |

SignalR & MVC ใช้จาก ASP.NET Core 8 built-in ไม่ต้องติดตั้งเพิ่ม

---

## 🔧 Stored Procedures

| SP Name                   | Purpose                                              |
|---------------------------|------------------------------------------------------|
| `sp_InsertHookBody`       | Insert body measurement → returns `mesId`            |
| `sp_InsertHookGuideway`   | Insert guideway measurement → returns `mesId`        |
| `sp_GetDashboardKPI`      | Today's counts + total + last timestamps             |
| `sp_GetBoxplotData`       | Q1/Q3/Median/Min/Max/StdDev per axis                 |
| `sp_GetTrendData`         | Last N measurements for trend chart                  |
| `sp_GetRecentMeasurements`| Latest N rows (both tables)                          |
| `sp_GetHourlyCount`       | Per-hour count today                                 |
| `sp_GetRawData`           | Paged & filtered records for Data Explorer           |

---

## 🎨 Design System

- **Theme**: Dark Industrial / Precision Manufacturing
- **Colors**: Cyan (#00d4ff) = Body | Orange (#ff6b35) = Guideway
- **Fonts**: Oswald (display) + Sarabun (Thai body) + Share Tech Mono (numbers)
- **Charts**: Chart.js 4 + chartjs-chart-boxplot plugin
- **Real-time**: SignalR ASP.NET Core 8

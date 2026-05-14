-- ============================================================
-- Database: DBHookParing
-- Script: 02_StoredProcedures.sql
-- Description: All Stored Procedures for Hook Pairing MES
-- ============================================================

USE DBHookParing;
GO

-- ============================================================
-- SP: sp_InsertHookBody
-- Description: Insert measurement record for Hook Body
-- ============================================================
CREATE OR ALTER PROCEDURE sp_InsertHookBody
    @a1axis   DECIMAL(12,5),
    @a2axis   DECIMAL(12,5),
    @z1axis   DECIMAL(12,5),
    @x1axis   DECIMAL(12,5),
    @mac_sn   NVARCHAR(50),
    @wo_no    NVARCHAR(50) = NULL,
    @box_no   NVARCHAR(50) = NULL,
    @opr_no   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO MesHookBody (a1axis, a2axis, z1axis, x1axis, mac_sn, wo_no, box_no, opr_no, dt_create)
    VALUES (@a1axis, @a2axis, @z1axis, @x1axis, @mac_sn, @wo_no, @box_no, @opr_no, GETDATE());

    SELECT SCOPE_IDENTITY() AS mesId;
END
GO

-- ============================================================
-- SP: sp_InsertHookGuideway
-- Description: Insert measurement record for Hook Guideway
-- ============================================================
CREATE OR ALTER PROCEDURE sp_InsertHookGuideway
    @a1axis   DECIMAL(12,5),
    @a2axis   DECIMAL(12,5),
    @z1axis   DECIMAL(12,5),
    @x1axis   DECIMAL(12,5),
    @mac_sn   NVARCHAR(50),
    @wo_no    NVARCHAR(50) = NULL,
    @box_no   NVARCHAR(50) = NULL,
    @opr_no   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO MesHookGuideway (a1axis, a2axis, z1axis, x1axis, mac_sn, wo_no, box_no, opr_no, dt_create)
    VALUES (@a1axis, @a2axis, @z1axis, @x1axis, @mac_sn, @wo_no, @box_no, @opr_no, GETDATE());

    SELECT SCOPE_IDENTITY() AS mesId;
END
GO

-- ============================================================
-- SP: sp_GetDashboardKPI
-- Description: Get today's KPI summary for both part types
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetDashboardKPI
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT
        -- Hook Body KPIs
        (SELECT COUNT(*) FROM MesHookBody WHERE CAST(dt_create AS DATE) = @Today) AS body_count_today,
        (SELECT COUNT(DISTINCT mac_sn) FROM MesHookBody WHERE CAST(dt_create AS DATE) = @Today) AS body_sn_today,
        (SELECT COUNT(*) FROM MesHookBody) AS body_count_total,

        -- Hook Guideway KPIs
        (SELECT COUNT(*) FROM MesHookGuideway WHERE CAST(dt_create AS DATE) = @Today) AS gw_count_today,
        (SELECT COUNT(DISTINCT mac_sn) FROM MesHookGuideway WHERE CAST(dt_create AS DATE) = @Today) AS gw_sn_today,
        (SELECT COUNT(*) FROM MesHookGuideway) AS gw_count_total,

        -- Latest measurement timestamps
        (SELECT MAX(dt_create) FROM MesHookBody)     AS body_last_measure,
        (SELECT MAX(dt_create) FROM MesHookGuideway) AS gw_last_measure;
END
GO

-- ============================================================
-- SP: sp_GetBoxplotData
-- Description: Get boxplot statistics for all 4 axes
--              for a specified date range and part type
--              PartType: 'Body' | 'Guideway'
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetBoxplotData
    @PartType  NVARCHAR(20) = 'Body',   -- 'Body' or 'Guideway'
    @DateFrom  DATE         = NULL,
    @DateTo    DATE         = NULL,
    @WoNo      NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @DateFrom IS NULL SET @DateFrom = CAST(DATEADD(DAY,-7,GETDATE()) AS DATE);
    IF @DateTo   IS NULL SET @DateTo   = CAST(GETDATE() AS DATE);

    IF @PartType = 'Body'
    BEGIN
        SELECT
            'A1' AS axis_name,
            MIN(a1axis) AS min_val, MAX(a1axis) AS max_val,
            AVG(a1axis) AS mean_val,
            PERCENTILE_CONT(0.25) WITHIN GROUP(ORDER BY a1axis) OVER() AS q1,
            PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY a1axis) OVER() AS median_val,
            PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY a1axis) OVER() AS q3,
            STDEV(a1axis) AS std_dev, COUNT(*) AS n
        FROM MesHookBody
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo IS NULL OR wo_no = @WoNo)

        UNION ALL

        SELECT
            'A2' AS axis_name,
            MIN(a2axis), MAX(a2axis), AVG(a2axis),
            PERCENTILE_CONT(0.25) WITHIN GROUP(ORDER BY a2axis) OVER(),
            PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY a2axis) OVER(),
            PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY a2axis) OVER(),
            STDEV(a2axis), COUNT(*)
        FROM MesHookBody
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo IS NULL OR wo_no = @WoNo)

        UNION ALL

        SELECT
            'Z1' AS axis_name,
            MIN(z1axis), MAX(z1axis), AVG(z1axis),
            PERCENTILE_CONT(0.25) WITHIN GROUP(ORDER BY z1axis) OVER(),
            PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY z1axis) OVER(),
            PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY z1axis) OVER(),
            STDEV(z1axis), COUNT(*)
        FROM MesHookBody
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo IS NULL OR wo_no = @WoNo)

        UNION ALL

        SELECT
            'X1' AS axis_name,
            MIN(x1axis), MAX(x1axis), AVG(x1axis),
            PERCENTILE_CONT(0.25) WITHIN GROUP(ORDER BY x1axis) OVER(),
            PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY x1axis) OVER(),
            PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY x1axis) OVER(),
            STDEV(x1axis), COUNT(*)
        FROM MesHookBody
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo IS NULL OR wo_no = @WoNo);
    END
    ELSE
    BEGIN
        SELECT
            'A1' AS axis_name,
            MIN(a1axis), MAX(a1axis), AVG(a1axis),
            PERCENTILE_CONT(0.25) WITHIN GROUP(ORDER BY a1axis) OVER(),
            PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY a1axis) OVER(),
            PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY a1axis) OVER(),
            STDEV(a1axis), COUNT(*)
        FROM MesHookGuideway
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo IS NULL OR wo_no = @WoNo)

        UNION ALL

        SELECT
            'A2' AS axis_name,
            MIN(a2axis), MAX(a2axis), AVG(a2axis),
            PERCENTILE_CONT(0.25) WITHIN GROUP(ORDER BY a2axis) OVER(),
            PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY a2axis) OVER(),
            PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY a2axis) OVER(),
            STDEV(a2axis), COUNT(*)
        FROM MesHookGuideway
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo IS NULL OR wo_no = @WoNo)

        UNION ALL

        SELECT
            'Z1' AS axis_name,
            MIN(z1axis), MAX(z1axis), AVG(z1axis),
            PERCENTILE_CONT(0.25) WITHIN GROUP(ORDER BY z1axis) OVER(),
            PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY z1axis) OVER(),
            PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY z1axis) OVER(),
            STDEV(z1axis), COUNT(*)
        FROM MesHookGuideway
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo IS NULL OR wo_no = @WoNo)

        UNION ALL

        SELECT
            'X1' AS axis_name,
            MIN(x1axis), MAX(x1axis), AVG(x1axis),
            PERCENTILE_CONT(0.25) WITHIN GROUP(ORDER BY x1axis) OVER(),
            PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY x1axis) OVER(),
            PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY x1axis) OVER(),
            STDEV(x1axis), COUNT(*)
        FROM MesHookGuideway
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo IS NULL OR wo_no = @WoNo);
    END
END
GO

-- ============================================================
-- SP: sp_GetTrendData
-- Description: Get last N measurement trend per axis for both
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetTrendData
    @PartType  NVARCHAR(20) = 'Body',
    @TopN      INT          = 50,
    @Axis      NVARCHAR(10) = 'a1axis'   -- a1axis, a2axis, z1axis, x1axis
AS
BEGIN
    SET NOCOUNT ON;

    IF @PartType = 'Body'
    BEGIN
        SELECT TOP (@TopN) mesId, mac_sn, wo_no, dt_create,
               a1axis, a2axis, z1axis, x1axis
        FROM MesHookBody
        ORDER BY dt_create DESC;
    END
    ELSE
    BEGIN
        SELECT TOP (@TopN) mesId, mac_sn, wo_no, dt_create,
               a1axis, a2axis, z1axis, x1axis
        FROM MesHookGuideway
        ORDER BY dt_create DESC;
    END
END
GO

-- ============================================================
-- SP: sp_GetRecentMeasurements
-- Description: Get latest N rows for both tables (for live feed)
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetRecentMeasurements
    @TopN INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@TopN)
        'Body'    AS part_type,
        mesId, mac_sn, wo_no, box_no, opr_no,
        a1axis, a2axis, z1axis, x1axis, dt_create
    FROM MesHookBody
    ORDER BY dt_create DESC

    UNION ALL

    SELECT TOP (@TopN)
        'Guideway' AS part_type,
        mesId, mac_sn, wo_no, box_no, opr_no,
        a1axis, a2axis, z1axis, x1axis, dt_create
    FROM MesHookGuideway
    ORDER BY dt_create DESC

    ORDER BY dt_create DESC;
END
GO

-- ============================================================
-- SP: sp_GetRawData
-- Description: Raw data with paging for data table
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetRawData
    @PartType  NVARCHAR(20) = 'Body',
    @DateFrom  DATE         = NULL,
    @DateTo    DATE         = NULL,
    @WoNo      NVARCHAR(50) = NULL,
    @MacSn     NVARCHAR(50) = NULL,
    @PageNo    INT          = 1,
    @PageSize  INT          = 50
AS
BEGIN
    SET NOCOUNT ON;

    IF @DateFrom IS NULL SET @DateFrom = CAST(DATEADD(DAY,-1,GETDATE()) AS DATE);
    IF @DateTo   IS NULL SET @DateTo   = CAST(GETDATE() AS DATE);

    DECLARE @Offset INT = (@PageNo - 1) * @PageSize;

    IF @PartType = 'Body'
    BEGIN
        SELECT mesId, mac_sn, wo_no, box_no, opr_no,
               a1axis, a2axis, z1axis, x1axis, dt_create,
               COUNT(*) OVER() AS total_records
        FROM MesHookBody
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo  IS NULL OR wo_no  = @WoNo)
          AND (@MacSn IS NULL OR mac_sn = @MacSn)
        ORDER BY dt_create DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    END
    ELSE
    BEGIN
        SELECT mesId, mac_sn, wo_no, box_no, opr_no,
               a1axis, a2axis, z1axis, x1axis, dt_create,
               COUNT(*) OVER() AS total_records
        FROM MesHookGuideway
        WHERE CAST(dt_create AS DATE) BETWEEN @DateFrom AND @DateTo
          AND (@WoNo  IS NULL OR wo_no  = @WoNo)
          AND (@MacSn IS NULL OR mac_sn = @MacSn)
        ORDER BY dt_create DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    END
END
GO

-- ============================================================
-- SP: sp_GetHourlyCount
-- Description: Hourly production count today for both types
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetHourlyCount
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT
        DATEPART(HOUR, dt_create) AS hour_slot,
        'Body'                    AS part_type,
        COUNT(*)                  AS measure_count
    FROM MesHookBody
    WHERE CAST(dt_create AS DATE) = @Today
    GROUP BY DATEPART(HOUR, dt_create)

    UNION ALL

    SELECT
        DATEPART(HOUR, dt_create) AS hour_slot,
        'Guideway'                AS part_type,
        COUNT(*)                  AS measure_count
    FROM MesHookGuideway
    WHERE CAST(dt_create AS DATE) = @Today
    GROUP BY DATEPART(HOUR, dt_create)

    ORDER BY hour_slot, part_type;
END
GO

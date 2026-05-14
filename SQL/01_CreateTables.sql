-- ============================================================
-- Database: DBHookParing
-- Script: 01_CreateTables.sql
-- Description: Create tables for Hook Body & Hook Guideway MES
-- ============================================================

USE DBHookParing;
GO

-- Table: MesHookBody
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MesHookBody' AND xtype='U')
BEGIN
    CREATE TABLE MesHookBody (
        mesId    INT           IDENTITY(1,1) NOT NULL CONSTRAINT PK_MesHookBody PRIMARY KEY,
        a1axis   DECIMAL(12,5) NOT NULL,
        a2axis   DECIMAL(12,5) NOT NULL,
        z1axis   DECIMAL(12,5) NOT NULL,
        x1axis   DECIMAL(12,5) NOT NULL,
        mac_sn   NVARCHAR(50)  NOT NULL,
        wo_no    NVARCHAR(50)  NULL,
        box_no   NVARCHAR(50)  NULL,
        opr_no   NVARCHAR(50)  NULL,
        dt_create DATETIME     NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Table MesHookBody created.';
END
ELSE PRINT 'Table MesHookBody already exists.';
GO

-- Table: MesHookGuideway
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MesHookGuideway' AND xtype='U')
BEGIN
    CREATE TABLE MesHookGuideway (
        mesId    INT           IDENTITY(1,1) NOT NULL CONSTRAINT PK_MesHookGuideway PRIMARY KEY,
        a1axis   DECIMAL(12,5) NOT NULL,
        a2axis   DECIMAL(12,5) NOT NULL,
        z1axis   DECIMAL(12,5) NOT NULL,
        x1axis   DECIMAL(12,5) NOT NULL,
        mac_sn   NVARCHAR(50)  NOT NULL,
        wo_no    NVARCHAR(50)  NULL,
        box_no   NVARCHAR(50)  NULL,
        opr_no   NVARCHAR(50)  NULL,
        dt_create DATETIME     NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Table MesHookGuideway created.';
END
ELSE PRINT 'Table MesHookGuideway already exists.';
GO

-- Index: for fast lookup by mac_sn and dt_create
CREATE NONCLUSTERED INDEX IX_MesHookBody_MacSn     ON MesHookBody    (mac_sn, dt_create DESC);
CREATE NONCLUSTERED INDEX IX_MesHookBody_WoNo      ON MesHookBody    (wo_no, dt_create DESC);
CREATE NONCLUSTERED INDEX IX_MesHookGuideway_MacSn ON MesHookGuideway(mac_sn, dt_create DESC);
CREATE NONCLUSTERED INDEX IX_MesHookGuideway_WoNo  ON MesHookGuideway(wo_no, dt_create DESC);
GO

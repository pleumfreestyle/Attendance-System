-- Additive migration for Attendance-System.
-- Review before applying to the production D1 database.
CREATE TABLE IF NOT EXISTS work_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  grace_minutes INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personnel_id INTEGER NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (personnel_id) REFERENCES personnel(id),
  FOREIGN KEY (reviewed_by) REFERENCES personnel(id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_personnel_time ON attendance_records(personnel_id, recorded_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_one_type_per_day ON attendance_records(personnel_id, attendance_type, date(recorded_at, '+7 hours'));
-- Ensure one account per email; confirm no duplicate non-empty emails before applying to any populated database.
CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_email_unique ON personnel(email COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_leave_personnel_status ON leave_requests(personnel_id, status);

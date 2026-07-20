-- SQL script to create tables in Supabase for ShiftWise

-- Create companies table
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL, -- UUID of the owner (from auth.users)
  name TEXT NOT NULL,
  unit TEXT,
  standard_shift_hours NUMERIC DEFAULT 9,
  factory_shift_hours NUMERIC DEFAULT 12,
  default_incentive NUMERIC DEFAULT 100,
  currency TEXT DEFAULT 'INR',
  financial_year TEXT DEFAULT '2026-27'
);

-- Create company_members table for RBAC
CREATE TABLE company_members (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- UUID from auth.users
  role TEXT NOT NULL DEFAULT 'accountant', -- 'admin', 'supervisor', 'accountant'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create employees table
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  shift TEXT,
  rate NUMERIC,
  status TEXT
);

-- Create attendance table
CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  shift TEXT,
  clock_in TEXT,
  clock_out TEXT,
  hours NUMERIC,
  rate NUMERIC,
  incentive NUMERIC,
  weekly_advance NUMERIC,
  loan NUMERIC,
  is_modified BOOLEAN DEFAULT true
);

-- Create audit_logs table
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_email TEXT,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Disable Row Level Security for easy testing (we can enable and write policies later)
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Audit Log Trigger Function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (id, company_id, user_id, action, table_name, record_id, old_data)
        VALUES (gen_random_uuid(), OLD.company_id, auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (id, company_id, user_id, action, table_name, record_id, old_data, new_data)
        VALUES (gen_random_uuid(), NEW.company_id, auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (id, company_id, user_id, action, table_name, record_id, new_data)
        VALUES (gen_random_uuid(), NEW.company_id, auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_attendance ON attendance;
CREATE TRIGGER audit_attendance
AFTER INSERT OR UPDATE OR DELETE ON attendance
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_employees ON employees;
CREATE TRIGGER audit_employees
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

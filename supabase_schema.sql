-- SQL script to create tables in Supabase for ShiftWise

-- Create companies table
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT,
  standard_shift_hours NUMERIC DEFAULT 9,
  factory_shift_hours NUMERIC DEFAULT 12,
  default_incentive NUMERIC DEFAULT 100,
  currency TEXT DEFAULT 'INR',
  financial_year TEXT DEFAULT '2026-27'
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
  hours NUMERIC,
  rate NUMERIC,
  incentive NUMERIC,
  weekly_advance NUMERIC,
  loan NUMERIC,
  is_modified BOOLEAN DEFAULT true
);

-- Disable Row Level Security for easy testing (we can enable and write policies later)
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;

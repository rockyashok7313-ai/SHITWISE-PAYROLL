-- Enable Row Level Security (RLS) on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
-- Allow authenticated users to read and modify all data (since this is a single-tenant app)
-- In a multi-tenant app, you would restrict this to auth.uid() matching a user_id column.

CREATE POLICY "Allow authenticated full access to companies" ON companies
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to employees" ON employees
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to attendance" ON attendance
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

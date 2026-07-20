-- Enable Row Level Security (RLS) on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- company_members policies
CREATE POLICY "Users can view members of their companies" ON company_members
    FOR SELECT
    TO authenticated
    USING (company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Owners can manage company members" ON company_members
    FOR ALL
    TO authenticated
    USING (company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()::text
    ));

-- companies policies
CREATE POLICY "Users can view companies they belong to" ON companies
    FOR SELECT
    TO authenticated
    USING (
        id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()::text)
        OR owner_id = auth.uid()::text
    );

CREATE POLICY "Owners can update companies" ON companies
    FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid()::text);

CREATE POLICY "Owners can insert companies" ON companies
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Owners can delete companies" ON companies
    FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid()::text);

-- employees policies
CREATE POLICY "Users can view employees in their companies" ON employees
    FOR SELECT
    TO authenticated
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()::text));

CREATE POLICY "Admins and Supervisors can manage employees" ON employees
    FOR ALL
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'supervisor')
        )
    );

-- attendance policies
CREATE POLICY "Users can view attendance in their companies" ON attendance
    FOR SELECT
    TO authenticated
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()::text));

CREATE POLICY "Admins and Supervisors can manage attendance" ON attendance
    FOR ALL
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'supervisor')
        )
    );

-- audit_logs policies
CREATE POLICY "Users can view audit logs in their companies" ON audit_logs
    FOR SELECT
    TO authenticated
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()::text));

CREATE POLICY "Admins and Supervisors can insert audit logs" ON audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'supervisor')
        )
    );

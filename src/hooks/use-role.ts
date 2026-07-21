import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'supervisor' | 'accountant' | null;

export function useRole(activeCompanyId?: string) {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!activeCompanyId) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRole('admin'); // Fallback to admin if no auth is configured
          return;
        }

        // First check if user is the owner of the company
        const { data: company } = await supabase
          .from('companies')
          .select('owner_id')
          .eq('id', activeCompanyId)
          .single();

        if (company?.owner_id === user.id) {
          setRole('admin');
          return;
        }

        // Otherwise check company_members
        const { data: member } = await supabase
          .from('company_members')
          .select('role')
          .eq('company_id', activeCompanyId)
          .eq('user_id', user.id)
          .single();

        if (member) {
          setRole(member.role as UserRole);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
        setRole('admin'); // Fallback to admin if schema doesn't match (e.g. no owner_id)
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    fetchRole();
  }, [activeCompanyId]);

  return { role, loading, isAdmin: role === 'admin', isSupervisor: role === 'supervisor', isAccountant: role === 'accountant' };
}

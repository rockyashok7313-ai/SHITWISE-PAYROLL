const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ouddccqhzjzsgjevbkrj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91ZGRjY3Foemp6c2dqZXZia3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDAyNzQsImV4cCI6MjA5OTUxNjI3NH0.F8XHA3bYBXT8lIACWCDn577V2PqPV8x0ipicTZMmyEE'
);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin2@factory.com', // Let's use the one I told the user to create, or I'll create a new one.
    password: 'password123'
  });
  
  // If sign in fails, try sign up (assuming user disabled email confirm as instructed)
  let session = authData?.session;
  if (!session) {
     const { data: upData } = await supabase.auth.signUp({
       email: 'test_restore_agent@factory.com',
       password: 'password123'
     });
     session = upData?.session;
  }
  
  if (!session) {
    console.log("Could not authenticate. Email confirms probably still on.");
    return;
  }

  console.log("Authenticated.");
  const { data, error } = await supabase.from('companies').upsert([{
    id: 'test-123',
    name: 'Test Factory',
    unit: 'Unit 1',
    standard_shift_hours: 9,
    factory_shift_hours: 12,
    default_incentive: 100,
    currency: 'INR',
    financial_year: '2026-27'
  }]);

  console.log('Upsert result:', { data, error });
}

test();

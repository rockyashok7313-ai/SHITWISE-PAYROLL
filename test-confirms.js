const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ouddccqhzjzsgjevbkrj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91ZGRjY3Foemp6c2dqZXZia3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDAyNzQsImV4cCI6MjA5OTUxNjI3NH0.F8XHA3bYBXT8lIACWCDn577V2PqPV8x0ipicTZMmyEE'
);

async function test() {
  const { data: upData, error } = await supabase.auth.signUp({
    email: 'test_confirms_off_' + Date.now() + '@factory.com',
    password: 'password123'
  });
  console.log('Signup data:', upData);
  console.log('Signup error:', error);
}

test();

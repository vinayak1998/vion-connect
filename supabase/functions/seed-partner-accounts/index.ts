import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const partners = [
  { email: "technet@vion.in", partnerId: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d", name: "TechNet Solutions" },
  { email: "quickfiber@vion.in", partnerId: "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e", name: "QuickFiber Partners" },
  { email: "networks@vion.in", partnerId: "c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f", name: "NetWorks India" },
  { email: "speedlink@vion.in", partnerId: "d4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a", name: "SpeedLink Services" },
  { email: "fastconnect@vion.in", partnerId: "e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b", name: "FastConnect Hub" },
];

const DEFAULT_PASSWORD = "partner123";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: { email: string; status: string; error?: string }[] = [];

    for (const partner of partners) {
      console.log(`Processing partner: ${partner.name} (${partner.email})`);

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === partner.email);

      if (existingUser) {
        console.log(`User ${partner.email} already exists, checking partner link...`);
        
        // Check if already linked
        const { data: partnerRecord } = await supabaseAdmin
          .from('partners')
          .select('user_id')
          .eq('id', partner.partnerId)
          .single();

        if (partnerRecord?.user_id === existingUser.id) {
          results.push({ email: partner.email, status: 'already_exists' });
          continue;
        }

        // Link existing user to partner
        await supabaseAdmin
          .from('partners')
          .update({ user_id: existingUser.id })
          .eq('id', partner.partnerId);

        results.push({ email: partner.email, status: 'linked_existing' });
        continue;
      }

      // Create new auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: partner.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });

      if (createError) {
        console.error(`Error creating user ${partner.email}:`, createError);
        results.push({ email: partner.email, status: 'error', error: createError.message });
        continue;
      }

      console.log(`Created user ${partner.email} with ID ${newUser.user.id}`);

      // Add partner role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: 'partner',
        });

      if (roleError) {
        console.error(`Error adding role for ${partner.email}:`, roleError);
        results.push({ email: partner.email, status: 'error', error: roleError.message });
        continue;
      }

      // Link user to partner record
      const { error: linkError } = await supabaseAdmin
        .from('partners')
        .update({ user_id: newUser.user.id })
        .eq('id', partner.partnerId);

      if (linkError) {
        console.error(`Error linking partner ${partner.email}:`, linkError);
        results.push({ email: partner.email, status: 'error', error: linkError.message });
        continue;
      }

      console.log(`Successfully created and linked partner account: ${partner.email}`);
      results.push({ email: partner.email, status: 'created' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Partner accounts seeded successfully',
        results,
        defaultPassword: DEFAULT_PASSWORD,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error seeding partner accounts:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

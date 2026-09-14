import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: 'Thiếu cấu hình Supabase phía máy chủ.' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return json({ ok: false, error: 'Chưa đăng nhập.' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Xác thực người đang gọi hàm.
    const { data: callerData, error: callerError } = await adminClient.auth.getUser(token)
    const caller = callerData?.user

    if (callerError || !caller) {
      return json({ ok: false, error: 'Phiên đăng nhập không hợp lệ.' }, 401)
    }

    // Chỉ tài khoản admin đang hoạt động mới được tạo user.
    const { data: callerRole, error: roleError } = await adminClient
      .from('app3_user_roles')
      .select('role,active')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (roleError) throw roleError

    if (!callerRole || callerRole.role !== 'admin' || callerRole.active !== true) {
      return json({ ok: false, error: 'Chỉ Admin được tạo tài khoản.' }, 403)
    }

    const body = await req.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const displayName = String(body?.display_name || '').trim()
    const role = body?.role === 'viewer' ? 'viewer' : 'teacher'
    const accessScope = body?.access_scope === 'all' ? 'all' : 'assigned'

    if (!email || !email.includes('@')) {
      return json({ ok: false, error: 'Email không hợp lệ.' }, 400)
    }

    if (!displayName) {
      return json({ ok: false, error: 'Họ và tên không được để trống.' }, 400)
    }

    if (password.length < 8) {
      return json({ ok: false, error: 'Mật khẩu phải có ít nhất 8 ký tự.' }, 400)
    }

    // Tạo tài khoản Auth. email_confirm=true để giáo viên có thể đăng nhập ngay.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        full_name: displayName,
      },
    })

    if (createError) {
      return json({ ok: false, error: createError.message }, 400)
    }

    const newUser = created.user
    if (!newUser) {
      return json({ ok: false, error: 'Supabase không trả về tài khoản vừa tạo.' }, 500)
    }

    // Tạo hồ sơ phân quyền. Nếu lỗi thì xóa Auth user để tránh tài khoản mồ côi.
    const { error: profileError } = await adminClient
      .from('app3_user_roles')
      .insert({
        user_id: newUser.id,
        email,
        display_name: displayName,
        role,
        active: true,
        access_scope: accessScope,
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(newUser.id)
      return json({ ok: false, error: 'Không tạo được hồ sơ phân quyền: ' + profileError.message }, 500)
    }

    return json({
      ok: true,
      user: {
        id: newUser.id,
        email,
        display_name: displayName,
        role,
        access_scope: accessScope,
      },
    })
  } catch (error) {
    console.error(error)
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500)
  }
})

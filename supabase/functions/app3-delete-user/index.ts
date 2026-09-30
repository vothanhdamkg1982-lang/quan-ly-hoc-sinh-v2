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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: 'Thiếu cấu hình Supabase phía máy chủ.' }, 500)
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ ok: false, error: 'Chưa đăng nhập.' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: callerData, error: callerError } = await adminClient.auth.getUser(token)
    const caller = callerData?.user
    if (callerError || !caller) return json({ ok: false, error: 'Phiên đăng nhập không hợp lệ.' }, 401)

    const { data: callerRole, error: callerRoleError } = await adminClient
      .from('app3_user_roles')
      .select('role,active')
      .eq('user_id', caller.id)
      .maybeSingle()
    if (callerRoleError) throw callerRoleError
    if (!callerRole || callerRole.role !== 'admin' || callerRole.active !== true) {
      return json({ ok: false, error: 'Chỉ Admin đang hoạt động được xóa tài khoản.' }, 403)
    }

    const body = await req.json()
    const targetUserId = String(body?.user_id || '').trim()
    if (!targetUserId) return json({ ok: false, error: 'Thiếu user_id cần xóa.' }, 400)
    if (targetUserId === caller.id) {
      return json({ ok: false, error: 'Không thể xóa tài khoản Admin đang đăng nhập.' }, 400)
    }

    const { data: targetRole, error: targetRoleError } = await adminClient
      .from('app3_user_roles')
      .select('user_id,email,display_name,role,active,access_scope')
      .eq('user_id', targetUserId)
      .maybeSingle()
    if (targetRoleError) throw targetRoleError
    if (!targetRole) return json({ ok: false, error: 'Không tìm thấy tài khoản trong bảng phân quyền.' }, 404)

    // Không cho xóa Admin cuối cùng đang hoạt động.
    if (targetRole.role === 'admin' && targetRole.active === true) {
      const { count, error: countError } = await adminClient
        .from('app3_user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('active', true)
      if (countError) throw countError
      if ((count || 0) <= 1) {
        return json({ ok: false, error: 'Không thể xóa Admin hoạt động cuối cùng của hệ thống.' }, 400)
      }
    }

    // Giữ bản sao phân công để có thể khôi phục nếu bước xóa Auth thất bại.
    const { data: oldAssignments, error: assignmentReadError } = await adminClient
      .from('app3_teacher_assignments')
      .select('user_id,subject_id,class_id,active,updated_at')
      .eq('user_id', targetUserId)
    if (assignmentReadError) throw assignmentReadError

    const { error: deleteAssignmentsError } = await adminClient
      .from('app3_teacher_assignments')
      .delete()
      .eq('user_id', targetUserId)
    if (deleteAssignmentsError) throw deleteAssignmentsError

    const { error: deleteRoleError } = await adminClient
      .from('app3_user_roles')
      .delete()
      .eq('user_id', targetUserId)
    if (deleteRoleError) {
      if (oldAssignments?.length) await adminClient.from('app3_teacher_assignments').insert(oldAssignments)
      throw deleteRoleError
    }

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId)
    if (deleteAuthError) {
      // Khôi phục phân quyền nếu Auth không xóa được để tránh tài khoản mồ côi còn đăng nhập nhưng mất hồ sơ.
      await adminClient.from('app3_user_roles').insert({
        user_id: targetRole.user_id,
        email: targetRole.email,
        display_name: targetRole.display_name,
        role: targetRole.role,
        active: targetRole.active,
        access_scope: targetRole.access_scope,
        updated_at: new Date().toISOString(),
      })
      if (oldAssignments?.length) await adminClient.from('app3_teacher_assignments').insert(oldAssignments)
      return json({ ok: false, error: 'Không xóa được tài khoản đăng nhập: ' + deleteAuthError.message }, 500)
    }

    return json({ ok: true, deleted_user_id: targetUserId, email: targetRole.email || '' })
  } catch (error) {
    console.error(error)
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

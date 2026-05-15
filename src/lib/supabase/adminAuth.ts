import { getSupabaseServerClient } from './serverClient'

export interface AdminAuthResult {
  user: { id: string; email?: string } | null
  isAdmin: boolean
  /** Diagnostic info for development — never expose secrets here. */
  diag: {
    supabaseReady: boolean
    gotUser: boolean
    userError: string | null
    /** null = query was never reached (no user) */
    adminRowFound: boolean | null
    adminError: string | null
  }
}

export async function getCurrentAdmin(): Promise<AdminAuthResult> {
  const supabase = getSupabaseServerClient()

  if (!supabase) {
    return {
      user: null,
      isAdmin: false,
      diag: {
        supabaseReady: false,
        gotUser: false,
        userError: 'Supabase env vars not configured',
        adminRowFound: null,
        adminError: null,
      },
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      user: null,
      isAdmin: false,
      diag: {
        supabaseReady: true,
        gotUser: false,
        userError: userError?.message ?? 'No active session',
        adminRowFound: null,
        adminError: null,
      },
    }
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return {
    user: { id: user.id, email: user.email },
    isAdmin: !!adminRow,
    diag: {
      supabaseReady: true,
      gotUser: true,
      userError: null,
      adminRowFound: !!adminRow,
      // Capture the Supabase error code/message but strip any sensitive detail
      adminError: adminError
        ? `${adminError.code ?? 'error'}: ${adminError.message}`
        : null,
    },
  }
}

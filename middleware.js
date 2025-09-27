// middleware.js
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  try {
    console.log('Middleware checking path:', req.nextUrl.pathname)
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      console.log('No session found, redirecting to login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    console.log('Session found for user:', session.user.id)

    // Get user role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    // If no profile found, redirect to login
    if (profileError || !profile) {
      console.log('No profile found, logging out and redirecting')
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login', req.url))
    }

    console.log('User role:', profile.role)
    
    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/main/:path*',
    '/pre_press/:path*',
    '/plates/:path*',
    '/card_cutting/:path*',
    '/printing/:path*',
    '/pasting/:path*',
    '/sorting/:path*',
    '/cutting/:path*',
    '/lamination/:path*',
  ],
}
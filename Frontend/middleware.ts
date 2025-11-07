// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check if the user is authenticated
  const token = request.cookies.get('auth_token')?.value
  const user = request.cookies.get('user')?.value

  const { pathname } = request.nextUrl

  // Protected routes
  const protectedRoutes = ['/account', '/checkout', '/profile']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // Auth routes (under /auth now)
  const authRoutes = ['/auth/login', '/auth/register']
  const isAuthRoute = authRoutes.includes(pathname)

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/auth/login', request.url) // ✅ updated path
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to account if accessing auth routes while authenticated
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL('/account', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/account/:path*',
    '/checkout/:path*',
    '/profile/:path*',
    '/auth/login',
    '/auth/register'
  ]
}

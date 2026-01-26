import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username:id: string
    username: string
    role: string
    tokenVersion?: number
  }

  interface User {
    id: string
    username: string
    role: string
    tokenVersion?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    role: string
    tokenVersion?: number
  }
}
}

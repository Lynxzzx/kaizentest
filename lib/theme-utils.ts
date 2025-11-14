export type Theme = 'dark' | 'light' | 'default'

export const getThemeClasses = (theme: Theme) => {
  switch (theme) {
    case 'dark':
      return {
        bg: 'bg-[#050816] text-slate-100 bg-tech-grid',
        card: 'bg-white/5 backdrop-blur-2xl rounded-3xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-[0_40px_80px_rgba(8,47,73,0.45)]',
        text: {
          primary: 'text-slate-50',
          secondary: 'text-slate-300',
          muted: 'text-slate-400'
        },
        input: 'bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-sky-400 focus:ring-sky-500',
        button: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white hover:opacity-90 shadow-[0_20px_35px_rgba(59,130,246,0.35)]',
        loading: 'bg-[#050816] text-slate-100'
      }
    case 'light':
      return {
        bg: 'bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_55%)] from-slate-50 via-slate-100 to-slate-200 text-slate-900',
        card: 'bg-white/90 backdrop-blur-xl rounded-3xl p-4 sm:rounded-[28px] sm:p-6 md:p-8 border border-white shadow-[0_35px_65px_rgba(15,23,42,0.12)]',
        text: {
          primary: 'text-gray-900',
          secondary: 'text-gray-600',
          muted: 'text-gray-500'
        },
        input: 'bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:border-sky-400 focus:ring-sky-500',
        button: 'bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 text-white hover:opacity-95 shadow-[0_20px_35px_rgba(59,130,246,0.25)]',
        loading: 'bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_55%)] from-slate-50 via-slate-100 to-slate-200 text-slate-900'
      }
    case 'default':
      return {
        bg: 'bg-[#020617] text-slate-50 bg-tech-grid',
        card: 'bg-white/5 backdrop-blur-2xl rounded-3xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-[0_40px_80px_rgba(8,47,73,0.55)]',
        text: {
          primary: 'text-slate-100',
          secondary: 'text-slate-300',
          muted: 'text-slate-500'
        },
        input: 'bg-white/10 border border-white/15 text-white placeholder-slate-400 focus:border-cyan-400 focus:ring-cyan-500',
        button: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white hover:opacity-90 shadow-[0_20px_35px_rgba(15,23,42,0.55)]',
        loading: 'bg-[#020617] text-slate-100'
      }
    default:
      return {
        bg: 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white',
        card: 'bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-white/20',
        text: {
          primary: 'text-white',
          secondary: 'text-gray-300',
          muted: 'text-gray-400'
        },
        input: 'bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-purple-500',
        button: 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700',
        loading: 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white'
      }
  }
}


export type Theme = 'dark' | 'light' | 'default'

export const getThemeClasses = (theme: Theme) => {
  switch (theme) {
    case 'dark':
      return {
        bg: 'bg-[#05070f] text-slate-100 bg-kaizen-gradient',
        card: 'glass-card rounded-3xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-[0_30px_80px_rgba(15,23,42,0.6)]',
        text: {
          primary: 'text-slate-50',
          secondary: 'text-slate-300',
          muted: 'text-slate-400'
        },
        input: 'bg-white/10 border border-white/15 text-white placeholder-slate-400 focus:border-indigo-400 focus:ring-indigo-500',
        button: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 text-white hover:opacity-90 shadow-[0_20px_40px_rgba(99,102,241,0.35)]',
        loading: 'bg-[#05070f] text-slate-100'
      }
    case 'light':
      return {
        bg: 'bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900',
        card: 'bg-white/90 backdrop-blur-2xl rounded-3xl p-4 sm:rounded-[28px] sm:p-6 md:p-8 border border-slate-200/80 shadow-[0_30px_70px_rgba(15,23,42,0.12)]',
        text: {
          primary: 'text-slate-900',
          secondary: 'text-slate-600',
          muted: 'text-slate-500'
        },
        input: 'bg-white border border-slate-200 text-slate-900 placeholder-slate-500 focus:border-indigo-400 focus:ring-indigo-500',
        button: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white hover:opacity-95 shadow-[0_20px_35px_rgba(99,102,241,0.25)]',
        loading: 'bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900'
      }
    case 'default':
      return {
        bg: 'bg-[#05070f] text-slate-50 bg-kaizen-gradient',
        card: 'glass-card rounded-3xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-[0_30px_80px_rgba(15,23,42,0.65)]',
        text: {
          primary: 'text-slate-100',
          secondary: 'text-slate-300',
          muted: 'text-slate-500'
        },
        input: 'bg-white/10 border border-white/15 text-white placeholder-slate-400 focus:border-indigo-400 focus:ring-indigo-500',
        button: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 text-white hover:opacity-90 shadow-[0_20px_40px_rgba(99,102,241,0.35)]',
        loading: 'bg-[#05070f] text-slate-100'
      }
    default:
      return {
        bg: 'bg-[#05070f] text-slate-50 bg-kaizen-gradient',
        card: 'glass-card rounded-3xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-[0_30px_80px_rgba(15,23,42,0.65)]',
        text: {
          primary: 'text-slate-100',
          secondary: 'text-slate-300',
          muted: 'text-slate-500'
        },
        input: 'bg-white/10 border border-white/15 text-white placeholder-slate-400 focus:border-indigo-400 focus:ring-indigo-500',
        button: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 text-white hover:opacity-90 shadow-[0_20px_40px_rgba(99,102,241,0.35)]',
        loading: 'bg-[#05070f] text-slate-100'
      }
  }
}


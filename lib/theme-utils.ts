export type Theme = 'dark' | 'light' | 'default'

export const getThemeClasses = (theme: Theme) => {
  switch (theme) {
    case 'dark':
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
    case 'light':
      return {
        bg: 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 text-gray-900',
        card: 'bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-200',
        text: {
          primary: 'text-gray-900',
          secondary: 'text-gray-600',
          muted: 'text-gray-500'
        },
        input: 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500',
        button: 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800',
        loading: 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 text-gray-900'
      }
    case 'default':
      return {
        bg: 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 text-gray-900',
        card: 'bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-200',
        text: {
          primary: 'text-gray-900',
          secondary: 'text-gray-600',
          muted: 'text-gray-500'
        },
        input: 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500',
        button: 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800',
        loading: 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 text-gray-900'
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


export type Theme = 'dark' | 'light' | 'default'

/**
 * Kaizen Aurora — Theme tokens
 * All themes share the same premium aurora aesthetic.
 * Light theme = inverted surfaces with cool blue tints. Dark/Default = obsidian + aurora.
 */
export const getThemeClasses = (theme: Theme) => {
  switch (theme) {
    case 'light':
      return {
        bg: 'bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900',
        card: 'relative bg-white/85 backdrop-blur-2xl rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-200/80 shadow-[0_20px_60px_-15px_rgba(99,102,241,0.15),inset_0_1px_0_0_rgba(255,255,255,0.8)]',
        text: {
          primary: 'text-slate-900',
          secondary: 'text-slate-600',
          muted: 'text-slate-500'
        },
        input: 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:ring-indigo-200',
        button: 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 text-white hover:opacity-95 shadow-[0_10px_30px_-8px_rgba(99,102,241,0.45)]',
        loading: 'bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900'
      }
    case 'dark':
    case 'default':
    default:
      return {
        bg: 'text-[var(--c-text)]',
        card: 'surface-card-elevated p-4 sm:p-6 md:p-7',
        text: {
          primary: 'text-white',
          secondary: 'text-white/70',
          muted: 'text-white/45'
        },
        input: 'input-premium',
        button: 'btn btn-primary',
        loading: 'text-white/55'
      }
  }
}

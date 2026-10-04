import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'

const THEME_KEY = 'budimas-mobile-theme'

const enforceRootVisibility = () => {
  if (typeof document === 'undefined') return

  const rootNodes = [
    document.documentElement,
    document.body,
    document.getElementById('app')
  ].filter(Boolean)

  rootNodes.forEach((node) => {
    node.style.setProperty('opacity', '1', 'important')
    node.style.setProperty('filter', 'none', 'important')
    node.style.setProperty('mix-blend-mode', 'normal', 'important')
  })
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: 'light'
  }),
  getters: {
    isDark: (state) => state.mode === 'dark'
  },
  actions: {
    async initTheme() {
      try {
        const savedPreference = await Preferences.get({ key: THEME_KEY })
        const saved = savedPreference?.value
        if (saved === 'dark' || saved === 'light') {
          this.mode = saved
        } else {
          const prefersDark =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches
          this.mode = prefersDark ? 'dark' : 'light'
        }
      } catch {
        try {
          const saved = localStorage.getItem(THEME_KEY)
          this.mode = saved === 'dark' || saved === 'light' ? saved : 'light'
        } catch {
          this.mode = 'light'
        }
      }

      await this.applyTheme()
    },
    async toggleTheme() {
      this.mode = this.mode === 'dark' ? 'light' : 'dark'
      await this.applyTheme()
    },
    async setTheme(mode) {
      this.mode = mode === 'dark' ? 'dark' : 'light'
      await this.applyTheme()
    },
    async applyTheme() {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', this.mode)
        document.body?.setAttribute('data-theme', this.mode)
        document.documentElement.style.colorScheme = this.mode
        enforceRootVisibility()
      }

      try {
        await Preferences.set({ key: THEME_KEY, value: this.mode })
      } catch {}

      try {
        localStorage.setItem(THEME_KEY, this.mode)
      } catch {}
    }
  }
})

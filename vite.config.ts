import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Build and preview use the GitHub Pages path /gacha-sim-lin/; the dev server stays at /.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/gacha-sim-lin/' : '/',
  plugins: [tailwindcss()],
}))

import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        espresso: {
          light: 'rgb(var(--color-espresso-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--color-espresso) / <alpha-value>)',
          dark: 'rgb(var(--color-espresso-dark) / <alpha-value>)',
        },
        caramel: {
          light: 'rgb(var(--color-caramel-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--color-caramel) / <alpha-value>)',
        },
        cream: {
          DEFAULT: 'rgb(var(--color-cream) / <alpha-value>)',
          dark: 'rgb(var(--color-cream-dark) / <alpha-value>)',
        },
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        crema: 'rgb(var(--color-crema) / <alpha-value>)',
        sage: 'rgb(var(--color-sage) / <alpha-value>)',
        brick: 'rgb(var(--color-brick) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        display: ['var(--font-display)', 'serif'],
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};

export default config;

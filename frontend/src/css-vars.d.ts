import 'react'

// Allow CSS custom properties (e.g., style={{ '--indent': 4 }})
declare module 'react' {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined
  }
}

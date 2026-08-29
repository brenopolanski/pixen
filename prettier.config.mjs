/** @type {import('prettier').Config} */
const prettierConfig = {
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-tailwindcss'],
  printWidth: 100,
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  tailwindFunctions: ['cn', 'cva'],
  tailwindStylesheet: 'src/index.css',
  trailingComma: 'all',
}

export default prettierConfig

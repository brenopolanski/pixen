const eslintIgnoredPaths = ['/src/components/ui/', '/src-tauri/']
const shouldLintWithEslint = (file) => !eslintIgnoredPaths.some((path) => file.includes(path))

const lintStagedConfig = {
  '*.{ts,tsx}': (filenames) => {
    const eslintFiles = filenames.filter(shouldLintWithEslint)
    const filesString = filenames.join(' ')
    const eslintFilesString = eslintFiles.join(' ')

    const commands = [`prettier --write ${filesString}`]

    if (eslintFiles.length > 0) {
      commands.push(`eslint --fix --max-warnings=0 --no-warn-ignored ${eslintFilesString}`)
    }

    commands.push('pnpm typecheck')

    return commands
  },

  '*.{js,mjs}': (filenames) => {
    const filesString = filenames.join(' ')

    return [
      `prettier --write ${filesString}`,
      `eslint --fix --max-warnings=0 --no-warn-ignored ${filesString}`,
    ]
  },

  '*.{json,css,md}': (filenames) => {
    const filesString = filenames.join(' ')

    return [`prettier --write ${filesString}`]
  },
}

export default lintStagedConfig

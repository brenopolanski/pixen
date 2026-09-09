export { cn } from 'cn'

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(), ms)
  })
}

export const generateReactKey = (
  prefix: string,
  identifier: string | number,
  index?: number,
): string => {
  const base = `${prefix}_${identifier}`
  return typeof index === 'number' ? `${base}_${index}` : base
}

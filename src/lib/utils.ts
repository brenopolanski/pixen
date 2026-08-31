import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs))
}

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(), ms)
  })
}

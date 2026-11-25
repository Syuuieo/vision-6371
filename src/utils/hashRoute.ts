import type { ModuleId } from '../types/sensor'

export function parseModuleFromHash(hash: string): ModuleId | null {
  const clean = hash.trim().replace(/^#\/?/, '').toLowerCase()
  if (clean === 'prologue') return 'prologue'
  if (clean === 'radio') return 'radio'
  if (clean === 'mailbox' || clean === 'post') return 'post'
  if (clean === 'diorama') return 'diorama'
  return null
}

export function formatModuleHash(module: ModuleId): string {
  if (module === 'post') return '#/mailbox'
  return `#/${module}`
}

export function isAdminHash(hash: string): boolean {
  return hash.trim().replace(/^#\/?/, '').toLowerCase() === 'admin'
}

export function syncModuleHash(module: ModuleId, replace = false): void {
  if (typeof window === 'undefined') return
  const target = formatModuleHash(module)
  if (window.location.hash === target) return
  try {
    const nextUrl = `${window.location.pathname}${window.location.search}${target}`
    if (replace) {
      window.history.replaceState({}, '', nextUrl)
    } else {
      window.history.pushState({}, '', nextUrl)
    }
  } catch {
    /* ignore in restricted environments */
  }
}

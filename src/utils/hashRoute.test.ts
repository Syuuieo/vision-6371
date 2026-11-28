import { describe, expect, it } from 'vitest'
import type { ModuleId } from '../types/sensor'
import { formatModuleHash, isAdminHash, isLegacyDioramaHash, parseModuleFromHash } from './hashRoute'

describe('hashRoute', () => {
  it('parses valid module hashes case-insensitively', () => {
    expect(parseModuleFromHash('#/prologue')).toBe('prologue')
    expect(parseModuleFromHash('#prologue')).toBe('prologue')
    expect(parseModuleFromHash('#/radio')).toBe('radio')
    expect(parseModuleFromHash('#/mailbox')).toBe('post')
    expect(parseModuleFromHash('#/post')).toBe('post')
    expect(parseModuleFromHash('#/diorama')).toBe('radio')
    expect(parseModuleFromHash('#/Diorama')).toBe('radio')
  })

  it('recognizes legacy diorama hashes case-insensitively', () => {
    expect(isLegacyDioramaHash('#/diorama')).toBe(true)
    expect(isLegacyDioramaHash('#Diorama')).toBe(true)
    expect(isLegacyDioramaHash('#/radio')).toBe(false)
    expect(isLegacyDioramaHash('')).toBe(false)
  })

  it('returns null for empty or unknown hashes', () => {
    expect(parseModuleFromHash('')).toBeNull()
    expect(parseModuleFromHash('#/')).toBeNull()
    expect(parseModuleFromHash('#/unknown')).toBeNull()
  })

  it('formats canonical hashes per module', () => {
    expect(formatModuleHash('prologue')).toBe('#/prologue')
    expect(formatModuleHash('radio')).toBe('#/radio')
    expect(formatModuleHash('post')).toBe('#/mailbox')
  })

  it('never formats a diorama route', () => {
    const modules: ModuleId[] = ['prologue', 'radio', 'post']
    expect(modules.map(formatModuleHash)).not.toContain('#/diorama')
  })

  it('recognizes #/admin hash routes exclusively', () => {
    expect(isAdminHash('#/admin')).toBe(true)
    expect(isAdminHash('#admin')).toBe(true)
    expect(isAdminHash('#/ADMIN')).toBe(true)
    expect(isAdminHash('#/radio')).toBe(false)
    expect(isAdminHash('')).toBe(false)
  })
})

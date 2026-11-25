import { describe, expect, it } from 'vitest'
import { formatModuleHash, isAdminHash, parseModuleFromHash } from './hashRoute'

describe('hashRoute', () => {
  it('parses valid module hashes case-insensitively', () => {
    expect(parseModuleFromHash('#/prologue')).toBe('prologue')
    expect(parseModuleFromHash('#prologue')).toBe('prologue')
    expect(parseModuleFromHash('#/radio')).toBe('radio')
    expect(parseModuleFromHash('#/mailbox')).toBe('post')
    expect(parseModuleFromHash('#/post')).toBe('post')
    expect(parseModuleFromHash('#/Diorama')).toBe('diorama')
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
    expect(formatModuleHash('diorama')).toBe('#/diorama')
  })

  it('recognizes #/admin hash routes exclusively', () => {
    expect(isAdminHash('#/admin')).toBe(true)
    expect(isAdminHash('#admin')).toBe(true)
    expect(isAdminHash('#/ADMIN')).toBe(true)
    expect(isAdminHash('#/radio')).toBe(false)
    expect(isAdminHash('')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three'
import { displayMaterial } from './model-materials'

describe('Sonata display materials', () => {
  it.each(['mat_0010_glass_ex.001', 'mat_0011_glass_ex'])(
    'replaces dark %s with transparent nonmetallic glass without altering the source',
    (name) => {
      const map = new Texture()
      const source = new MeshStandardMaterial({ name, map })
      const result = displayMaterial(source) as MeshPhysicalMaterial
      expect(result).toBeInstanceOf(MeshPhysicalMaterial)
      expect(result.map).toBeNull()
      expect(result.transparent).toBe(true)
      expect(result.opacity).toBeLessThan(1)
      expect(result.transmission).toBeGreaterThan(0)
      expect(result.metalness).toBe(0)
      expect(result.depthWrite).toBe(false)
      expect(source.map).toBe(map)
      expect(source.transparent).toBe(false)
    },
  )

  it('keeps tyre textures and opacity intact', () => {
    const map = new Texture()
    const source = new MeshStandardMaterial({ name: 'mat_0003_tire_j', map })
    const result = displayMaterial(source) as MeshStandardMaterial
    expect(result).not.toBe(source)
    expect(result.map).toBe(map)
    expect(result.transparent).toBe(false)
  })
})

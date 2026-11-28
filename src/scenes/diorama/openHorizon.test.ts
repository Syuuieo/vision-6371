import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { DioramaSceneId } from '../../services/albumStorage'
import { buildGizaCity } from './cities/giza'
import { buildGeorgiaCity } from './cities/georgia'
import { buildCore, buildKyoto } from './buildersC'
import { buildGriffithCity } from './cities/griffith'
import { buildAgraCity } from './cities/agra'
import { buildRapanuiCity } from './cities/rapanui'
import { buildParisCity } from './cities/paris'
import { buildIcelandCity } from './cities/iceland'
import { buildDaliCity } from './cities/dali'
import { buildHarbinCity } from './cities/harbin'
import { buildRome } from './buildersD'
import { WORLD_SCALE } from '../DioramaWorld'
import {
  buildHorizonRing,
  buildSculptedPlinth,
  createDioramaSkyDome,
  createDioramaWaterMaterial,
  createMiniPerson,
} from './materials'
import { DIORAMA_SCENES, type DioramaBuilderCtx, type DioramaHorizonStyle } from './types'

const builders: Record<DioramaSceneId, (ctx: DioramaBuilderCtx) => void> = {
  agra: buildAgraCity,
  rapanui: buildRapanuiCity,
  griffith: buildGriffithCity,
  giza: buildGizaCity,
  harbin: buildHarbinCity,
  georgia: buildGeorgiaCity,
  iceland: buildIcelandCity,
  kyoto: buildKyoto,
  core: buildCore,
  rome: buildRome,
  paris: buildParisCity,
  dali: buildDaliCity,
}

function createContext() {
  const group = new THREE.Group()
  const goalIds = new Set<string>()
  const ctx: DioramaBuilderCtx = {
    group,
    textures: {
      plasterBump: new THREE.CanvasTexture(),
      brickTex: new THREE.CanvasTexture(),
      brickBump: new THREE.CanvasTexture(),
      glowHalo: new THREE.CanvasTexture(),
      weatheredWoodTex: new THREE.CanvasTexture(),
      darkStoneTex: new THREE.CanvasTexture(),
      skyscraperFacadeTex: new THREE.CanvasTexture(),
      skyscraperEmissiveTex: new THREE.CanvasTexture(),
    },
    getMood: () => 'dusk',
    registerInteractive: (_mesh, options) => {
      if (options.encounterId) goalIds.add(options.encounterId)
    },
    discoverEncounter: (encounterId) => goalIds.add(encounterId),
    isEncounterDone: (encounterId) => goalIds.has(encounterId),
    bindWater: () => {},
    triggerRipple: () => {},
    setWaterBio: () => {},
    setFinaleTrigger: () => {},
    addTick: () => {},
    addMoodHook: () => {},
  }
  return { ctx, group, goalIds }
}

describe('open horizon worlds', () => {
  it('uses a 220m sky dome and world-space water horizon fog', () => {
    const sky = createDioramaSkyDome()
    const skyGeometry = sky.mesh.geometry as THREE.SphereGeometry
    expect(skyGeometry.parameters.radius).toBe(220)
    expect(skyGeometry.parameters.widthSegments).toBe(48)
    expect(skyGeometry.parameters.heightSegments).toBe(32)

    const { material, uniforms } = createDioramaWaterMaterial('#2f829c', '#133b56')
    expect(uniforms.uFadeRadius.value).toBe(56)
    expect(material.fragmentShader).toContain('length(vWorld.xz)')
    expect(material.fragmentShader).toContain('mix(waterCol, uFogColor, horizonFade)')
    expect(material.fragmentShader).not.toContain('edgeDist')
  })

  it('removes the floating cliff and basin walls from the shared ground builder', () => {
    const { ctx, group } = createContext()
    buildSculptedPlinth(ctx, {
      topColor: '#d9ccb9',
      sideColor: '#485a79',
      waterShallow: '#2f829c',
      waterDeep: '#133b56',
      waterSplitZ: 0.25,
    })

    let hasHorizonWater = false
    let waterHeight = Number.NaN
    let groundHeight = Number.NaN
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const geometry = object.geometry
      if (geometry instanceof THREE.PlaneGeometry && geometry.parameters.width === 66) {
        hasHorizonWater = object.material instanceof THREE.ShaderMaterial
        waterHeight = object.position.y
        if (object.material instanceof THREE.MeshStandardMaterial) {
          groundHeight = object.position.y
        }
      }
      if (geometry instanceof THREE.CylinderGeometry) {
        expect(
          geometry.parameters.radiusTop === 4.35 && geometry.parameters.radiusBottom === 1.45,
        ).toBe(false)
      }
      if (geometry instanceof THREE.BoxGeometry) {
        expect(geometry.parameters.width).not.toBe(7.36)
        expect(geometry.parameters.width).not.toBe(7.38)
      }
    })
    expect(hasHorizonWater).toBe(true)
    expect(waterHeight).toBeGreaterThan(groundHeight)
  })

  it.each<DioramaHorizonStyle>([
    'skyline',
    'mountains',
    'islands',
    'snowhills',
    'courtyard_trees',
    'cavern',
  ])('builds the %s horizon with instanced silhouettes', (style) => {
    const { ctx } = createContext()
    const ring = buildHorizonRing(ctx, style, '#f2c28b')
    expect(ring.userData.horizonStyle).toBe(style)
    expect(ring.children.some((child) => child instanceof THREE.InstancedMesh)).toBe(true)
  })

  it('assigns the requested horizon style to every city', () => {
    const expected: Record<DioramaSceneId, DioramaHorizonStyle> = {
      agra: 'skyline',
      rapanui: 'mountains',
      griffith: 'skyline',
      giza: 'mountains',
      harbin: 'snowhills',
      georgia: 'mountains',
      iceland: 'mountains',
      kyoto: 'mountains',
      core: 'cavern',
      rome: 'skyline',
      paris: 'skyline',
      dali: 'mountains',
    }
    for (const meta of DIORAMA_SCENES) expect(meta.horizonStyle).toBe(expected[meta.id])
  })

  it('uses the specified native-city hours and three encounter ids', () => {
    const expected: Partial<Record<DioramaSceneId, { hour: number; ids: string[] }>> = {
      agra: { hour: 6.25, ids: ['dome', 'minarets', 'pool'] },
      paris: { hour: 18.3, ids: ['tower', 'bridge', 'boat'] },
      iceland: { hour: 22.2, ids: ['lighthouse', 'aurora', 'whale'] },
      dali: { hour: 20.8, ids: ['lanterns', 'moon', 'boat'] },
      harbin: { hour: 17.6, ids: ['lamps', 'rose', 'bell'] },
    }
    for (const [id, spec] of Object.entries(expected)) {
      const meta = DIORAMA_SCENES.find((scene) => scene.id === id)!
      expect(meta.defaultHour).toBe(spec.hour)
      expect(meta.encounters.map((encounter) => encounter.id)).toEqual(spec.ids)
    }
  })

  it('keeps human silhouettes at true 1:1 scale', () => {
    const person = createMiniPerson('#35567c', '#7ef2c8', { hatHex: '#c94a40' })
    person.updateMatrixWorld(true)
    const height = new THREE.Box3().setFromObject(person).getSize(new THREE.Vector3()).y
    expect(height).toBeCloseTo(0.7, 3)
    expect(height * WORLD_SCALE).toBeCloseTo(1.68, 2)
  })

  it.each(DIORAMA_SCENES)('keeps $id buildable with all three goals and open ground', (meta) => {
    const { ctx, group, goalIds } = createContext()
    builders[meta.id](ctx)

    expect(group.children.length).toBeGreaterThan(0)
    for (const encounter of meta.encounters) expect(goalIds.has(encounter.id)).toBe(true)

    let hasOpenGround = false
    let hasForegroundDeck = false
    let hasHorizon = false
    group.traverse((object) => {
      if (object.userData.foregroundDeck) hasForegroundDeck = true
      if (object.name === `horizon-${meta.horizonStyle}`) {
        hasHorizon = true
        expect(object.userData.horizonVariant).toBe(meta.id)
      }
      if (
        object instanceof THREE.Mesh &&
        object.geometry instanceof THREE.PlaneGeometry &&
        object.geometry.parameters.width >= 66
      ) {
        hasOpenGround = true
      }
    })
    expect(hasOpenGround).toBe(true)
    expect(hasForegroundDeck).toBe(true)
    expect(hasHorizon).toBe(true)

    const [px, py, pz] = meta.walkView.pos
    const [, ly] = meta.walkView.look
    const elevated = meta.id === 'core'
    const nativeScene = ['agra', 'georgia', 'rapanui', 'griffith', 'giza', 'rome', 'kyoto', 'paris', 'iceland', 'dali', 'harbin'].includes(meta.id)
    if (nativeScene) {
      expect(meta.encounters).toHaveLength(3)
      expect(meta.defaultHour).toBeDefined()
      expect(py).toBeGreaterThanOrEqual(1.65)
      expect(py).toBeLessThanOrEqual(1.95)
      expect(pz).toBeGreaterThanOrEqual(6.5)
      expect(pz).toBeLessThanOrEqual(16)
      expect(Math.abs(px)).toBeLessThanOrEqual(6)
      expect(ly).toBeGreaterThanOrEqual(3.2)
      expect(ly).toBeLessThanOrEqual(6.5)
      expect(meta.walkView.fov).toBeGreaterThanOrEqual(50)
      expect(meta.walkView.fov).toBeLessThanOrEqual(60)
    } else {
      expect(py).toBeGreaterThanOrEqual(elevated ? 2.1 : 1.65)
      expect(py).toBeLessThanOrEqual(elevated ? 2.4 : 1.95)
      expect(pz).toBeGreaterThanOrEqual(6.5)
      expect(pz).toBeLessThanOrEqual(16)
      expect(Math.abs(px)).toBeLessThanOrEqual(6)
      expect(ly).toBeGreaterThanOrEqual(3.2)
      expect(ly).toBeLessThanOrEqual(6.5)
      expect(meta.walkView.fov).toBeGreaterThanOrEqual(50)
      expect(meta.walkView.fov).toBeLessThanOrEqual(60)
    }

    const bounds = new THREE.Box3().setFromObject(group)
    expect(Number.isFinite(bounds.min.x)).toBe(true)
    expect(Number.isFinite(bounds.max.y)).toBe(true)
  })
})

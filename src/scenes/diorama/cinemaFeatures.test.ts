import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildAgraCity } from './cities/agra'
import { buildParisCity } from './cities/paris'
import { buildIcelandCity } from './cities/iceland'
import { buildDaliCity } from './cities/dali'
import { buildHarbinCity } from './cities/harbin'
import { computeSolarProfile, createCinemaGodRayPass } from './cinemaPass'
import {
  buildFlowFieldSky,
  buildPainterlyRiver,
  buildPainterlySkyLayer,
  buildRiverLanterns,
  buildStarHaloTexture,
  buildStarHalos,
  buildStarlightWishShower,
  buildStarryConstellation,
  createPainterlyTextures,
} from './painterlyEngine'
import type { DioramaBuilderCtx } from './types'
import { DIORAMA_SCENES } from './types'
import type { DioramaSceneId } from '../../services/albumStorage'
import { DioramaWeatherSystem } from './weather'

describe('Phase 1 pure-3D cinema features', () => {
  it('computes smooth 24h solar profiles with normalized sunDir and valid nightFactor', () => {
    for (const hour of [5.0, 6.3, 12.0, 18.1, 22.5, 23.5]) {
      const sp = computeSolarProfile(hour)
      const len = Math.hypot(sp.sunDir[0], sp.sunDir[1], sp.sunDir[2])
      expect(len).toBeCloseTo(1, 3)
      expect(sp.nightFactor).toBeGreaterThanOrEqual(0)
      expect(sp.nightFactor).toBeLessThanOrEqual(1)
      expect(sp.godRayStrength).toBeGreaterThan(0)
    }
    expect(computeSolarProfile(12.0).nightFactor).toBe(0)
    expect(computeSolarProfile(23.5).nightFactor).toBe(1)
  })

  it('creates a ShaderPass for screen-space CinemaGodRayPass', () => {
    const { pass, uniforms } = createCinemaGodRayPass()
    expect(pass).toBeDefined()
    expect(uniforms.uSunScreenPos.value).toBeInstanceOf(THREE.Vector2)
    expect(uniforms.uGodRayIntensity.value).toBeGreaterThan(0)
  })

  it('transitions DioramaWeatherSystem across clear, rain, and snow cleanly', () => {
    const tex = new THREE.CanvasTexture()
    const weather = new DioramaWeatherSystem(tex)
    const anchor = new THREE.Vector3(0, 1.75, 11.4)

    expect(weather.getWeather()).toBe('clear')
    weather.update(1.0, 0.05, anchor, 0)
    expect(weather.getRainIntensity()).toBe(0)

    weather.setWeather('rain')
    expect(weather.getWeather()).toBe('rain')
    weather.update(1.5, 0.2, anchor, 0.2)
    expect(weather.getRainIntensity()).toBeGreaterThan(0)

    weather.setWeather('snow')
    expect(weather.getWeather()).toBe('snow')
    weather.update(2.0, 0.2, anchor, 0.1)

    weather.dispose()
    tex.dispose()
  })

  it.each<{ id: DioramaSceneId; build: (ctx: DioramaBuilderCtx) => void; ride: boolean }>([
    { id: 'agra', build: buildAgraCity, ride: true },
    { id: 'paris', build: buildParisCity, ride: true },
    { id: 'iceland', build: buildIcelandCity, ride: false },
    { id: 'dali', build: buildDaliCity, ride: true },
    { id: 'harbin', build: buildHarbinCity, ride: false },
  ])('wires safe walk sampling and vantage/ride anchors for $id', ({ id, build, ride }) => {
    const group = new THREE.Group()
    let sampler: ((x: number, z: number) => number | null) | null = null
    let rideAnchor: (() => { pos: THREE.Vector3 } | null) | null = null
    let vantage: { label: string; pos: [number, number, number]; yaw: number; pitch: number } | null = null

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
      registerInteractive: () => {},
      discoverEncounter: () => {},
      isEncounterDone: () => false,
      bindWater: () => {},
      triggerRipple: () => {},
      setWaterBio: () => {},
      setFinaleTrigger: () => {},
      addTick: () => {},
      addMoodHook: () => {},
      setWalkHeightSampler: (fn) => {
        sampler = fn
      },
      setRideAnchor: (fn) => {
        rideAnchor = fn
      },
      setVantageAnchor: (next) => {
        vantage = next
      },
    }

    build(ctx)

    expect(sampler).not.toBeNull()
    const meta = DIORAMA_SCENES.find((scene) => scene.id === id)!
    const spawnHeight = sampler!(meta.walkView.pos[0], meta.walkView.pos[2])
    expect(spawnHeight).not.toBeNull()
    expect(Number.isFinite(spawnHeight!)).toBe(true)
    const [waterX, waterZ] = id === 'harbin' ? [0, -220] : [100, 0]
    expect(sampler!(waterX, waterZ)).toBeNull()

    expect(vantage).not.toBeNull()
    expect(vantage!.label.length).toBeGreaterThan(0)
    expect(vantage!.pos.every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(vantage!.yaw)).toBe(true)
    expect(Number.isFinite(vantage!.pitch)).toBe(true)

    if (ride) {
      expect(rideAnchor).not.toBeNull()
      const anchor = rideAnchor!()
      expect(anchor).not.toBeNull()
      expect(anchor!.pos.toArray().every(Number.isFinite)).toBe(true)
    } else {
      expect(rideAnchor).toBeNull()
    }
  })

  it('builds Van Gogh painterly 3D engine layers (sky strokes, Big Dipper, river pillars, lanterns, wish shower)', () => {
    const parent = new THREE.Group()
    const glowTex = new THREE.CanvasTexture()
    const pTex = createPainterlyTextures()

    const sky = buildPainterlySkyLayer(parent, pTex.brushStrokeTex)
    expect(sky.instancedMesh.count).toBe(1500)
    sky.update(1.0, 0.05, 0.5)
    sky.setPalette(0.95, 21.5)

    const constellation = buildStarryConstellation(parent, pTex.starburstTex, glowTex)
    expect(constellation.bigDipperStars.length).toBe(7)
    constellation.triggerBigDipper()
    constellation.update(1.2, 0.1, 0.95)
    expect(constellation.getSwirlBoost()).toBeGreaterThan(0.5)

    const lightXs = Array.from({ length: 20 }, (_, i) => -68 + (i / 19) * 136)
    const river = buildPainterlyRiver(parent, pTex.brushStrokeTex, lightXs)
    expect(river.mesh.name).toBe('open-horizon-ground')
    expect(river.strokeInstanced.count).toBe(440)
    river.triggerRipplePulse(2, -12)
    river.setLightBoost(1.5)
    river.update(1.5, 0.1, 0.95)
    expect(river.uniforms.uWaveExcite.value).toBeGreaterThan(0.5)

    const lanterns = buildRiverLanterns(parent, glowTex)
    lanterns.release()
    lanterns.update(1.5, 0.5)
    expect(lanterns.group.children.length).toBe(24)

    const wish = buildStarlightWishShower(parent, glowTex)
    wish.trigger()
    wish.update(1.5, 0.2)
    expect(wish.group.children.length).toBeGreaterThan(1)

    pTex.dispose()
    glowTex.dispose()
  })

  it('builds flow-field sky v2 with differential vortex orbits and tree-ring star halos', () => {
    const parent = new THREE.Group()
    const glowTex = new THREE.CanvasTexture()
    const pTex = createPainterlyTextures()
    const haloTex = buildStarHaloTexture()

    const flowSky = buildFlowFieldSky(parent, pTex.brushStrokeTex, {
      count: 320,
      swirlCenters: [
        [-14, 36, -88],
        [16, 40, -84],
      ],
      palette: ['#0a1430', '#1e3a74', '#f4e8c8'],
      highlightRatio: 0.1,
    })
    expect(flowSky.instancedMesh.count).toBe(320)
    flowSky.update(1.0, 0.05, 0.6)
    flowSky.setNightFactor(0.92)
    flowSky.setNightFactor(0.1)

    const halos = buildStarHalos(parent, haloTex, glowTex, [
      { pos: [-12, 34, -86], scale: 8, rings: 2 },
      { pos: [16, 38, -84], scale: 7, rings: 3 },
    ])
    halos.update(1.0, 0.05, 0.95)
    // 星1：2 圈年轮 + 星2：3 圈年轮 + 每星 1 枚核心光点
    expect(halos.group.children.length).toBe(2 + 3 + 2)

    const lightXs = Array.from({ length: 20 }, (_, i) => -60 + (i / 19) * 120)
    const river = buildPainterlyRiver(parent, pTex.brushStrokeTex, lightXs, {
      accentBandHex: '#e8f1fb',
      bandX: 0.58,
      bandWidth: 5,
      accentStrength: 0.5,
    })
    river.setAccentBand(1.2)
    expect(river.uniforms.uAccentStrength.value).toBeCloseTo(1.2, 5)
    expect(river.mesh.material).toBeInstanceOf(THREE.ShaderMaterial)

    haloTex.dispose()
    pTex.dispose()
    glowTex.dispose()
  })
})

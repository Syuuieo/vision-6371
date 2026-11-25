import { useCallback, useEffect, useState } from 'react'
import {
  AdminApiError,
  adminDeleteEcho,
  adminDeleteVision,
  adminSetVisionVisibility,
  clearAdminSessionToken,
  fetchAdminOverview,
  loadAdminSessionToken,
  loadLocalAdminOverview,
  localAdminDeleteEcho,
  localAdminDeleteVision,
  localAdminSetVisibility,
  saveAdminSessionToken,
  type AdminErrorKind,
  type AdminMode,
  type AdminOverview,
  type AdminVisionSummary,
} from '../services/adminApi'
import type { VisionVisibility } from '../types/vision'

interface AdminConsoleProps {
  onExit: () => void
}

type AdminTab = 'visions' | 'echoes'

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '时间未知'
  return new Date(ms).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildSignalUrl(code: string): string {
  if (typeof window === 'undefined') return `?signal=${encodeURIComponent(code)}`
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.set('signal', code)
  return url.toString()
}

export function AdminConsole({ onExit }: AdminConsoleProps) {
  const [tokenInput, setTokenInput] = useState(() => loadAdminSessionToken())
  const [activeToken, setActiveToken] = useState('')
  const [mode, setMode] = useState<AdminMode | null>(null)
  const [authStatus, setAuthStatus] = useState<{ kind: AdminErrorKind; text: string } | null>(null)
  const [connecting, setConnecting] = useState(false)

  const [tab, setTab] = useState<AdminTab>('visions')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | VisionVisibility>('all')
  const [searchText, setSearchText] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [confirmDeleteVision, setConfirmDeleteVision] = useState<string | null>(null)
  const [confirmDeleteEcho, setConfirmDeleteEcho] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const loadData = useCallback(
    async (
      targetMode: AdminMode,
      token: string,
      vis: 'all' | VisionVisibility,
      q: string,
    ) => {
      if (targetMode === 'local') {
        setOverview(loadLocalAdminOverview({ visibility: vis, q }))
        return
      }
      setLoadingList(true)
      try {
        const next = await fetchAdminOverview(token, { visibility: vis, q })
        setOverview(next)
        setAuthStatus(null)
      } catch (error) {
        if (error instanceof AdminApiError) {
          if (error.kind === 'unauthorized' || error.kind === 'unconfigured') {
            clearAdminSessionToken()
            setMode(null)
            setActiveToken('')
            setAuthStatus({ kind: error.kind, text: error.message })
          } else {
            setActionNotice(error.message)
          }
        }
      } finally {
        setLoadingList(false)
      }
    },
    [],
  )

  useEffect(() => {
    const saved = loadAdminSessionToken().trim()
    if (!saved) return
    let alive = true
    void fetchAdminOverview(saved, { visibility: 'all', q: '' })
      .then((data) => {
        if (!alive) return
        setActiveToken(saved)
        setMode('cloud')
        setOverview(data)
        setAuthStatus(null)
      })
      .catch((error) => {
        if (!alive || !(error instanceof AdminApiError)) return
        if (error.kind === 'unauthorized') clearAdminSessionToken()
        setAuthStatus({ kind: error.kind, text: error.message })
      })
    return () => {
      alive = false
    }
  }, [])

  const handleCloudSignIn = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = tokenInput.trim()
    if (!trimmed) {
      setAuthStatus({ kind: 'unauthorized', text: '请输入站长管理密钥 ADMIN_TOKEN' })
      return
    }
    setConnecting(true)
    setAuthStatus(null)
    try {
      const data = await fetchAdminOverview(trimmed, {
        visibility: visibilityFilter,
        q: appliedQuery,
      })
      saveAdminSessionToken(trimmed)
      setActiveToken(trimmed)
      setMode('cloud')
      setOverview(data)
    } catch (error) {
      if (error instanceof AdminApiError) {
        setAuthStatus({ kind: error.kind, text: error.message })
      } else {
        setAuthStatus({ kind: 'offline', text: '无法连接到云端管理接口' })
      }
    } finally {
      setConnecting(false)
    }
  }

  const enterLocalMode = () => {
    setMode('local')
    setAuthStatus(null)
    setActionNotice(null)
    setOverview(loadLocalAdminOverview({ visibility: visibilityFilter, q: appliedQuery }))
  }

  const handleSignOut = () => {
    clearAdminSessionToken()
    setMode(null)
    setActiveToken('')
    setOverview(null)
    setConfirmDeleteVision(null)
    setConfirmDeleteEcho(null)
    setActionNotice(null)
  }

  const refreshNow = async () => {
    if (!mode) return
    setActionNotice(null)
    await loadData(mode, activeToken, visibilityFilter, appliedQuery)
  }

  const applyVisibilityFilter = async (nextVis: 'all' | VisionVisibility) => {
    setVisibilityFilter(nextVis)
    if (!mode) return
    await loadData(mode, activeToken, nextVis, appliedQuery)
  }

  const handleSearchSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextQ = searchText.trim()
    setAppliedQuery(nextQ)
    if (!mode) return
    await loadData(mode, activeToken, visibilityFilter, nextQ)
  }

  const clearSearch = async () => {
    setSearchText('')
    setAppliedQuery('')
    if (!mode) return
    await loadData(mode, activeToken, visibilityFilter, '')
  }

  const handleToggleVisibility = async (item: AdminVisionSummary) => {
    if (!mode) return
    const nextVis: VisionVisibility = item.visibility === 'public' ? 'private' : 'public'
    setBusyKey(`vis-${item.code}`)
    setActionNotice(null)
    try {
      if (mode === 'cloud') {
        await adminSetVisionVisibility(activeToken, item.code, nextVis)
      } else {
        localAdminSetVisibility(item.code, nextVis)
      }
      await loadData(mode, activeToken, visibilityFilter, appliedQuery)
      setActionNotice(
        `已将 #${item.code}（${item.city}）设为${nextVis === 'public' ? '公开展示' : '私密下架'}`,
      )
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : '切换可见性失败')
    } finally {
      setBusyKey(null)
    }
  }

  const handleDeleteVision = async (code: string) => {
    if (!mode) return
    setBusyKey(`del-v-${code}`)
    setActionNotice(null)
    try {
      if (mode === 'cloud') {
        await adminDeleteVision(activeToken, code)
      } else {
        localAdminDeleteVision(code)
      }
      setConfirmDeleteVision(null)
      await loadData(mode, activeToken, visibilityFilter, appliedQuery)
      setActionNotice(`已彻底删除视野 #${code} 及其下全部回声`)
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : '删除视野失败')
    } finally {
      setBusyKey(null)
    }
  }

  const handleDeleteEcho = async (visionCode: string, echoId: string) => {
    if (!mode) return
    setBusyKey(`del-e-${echoId}`)
    setActionNotice(null)
    try {
      if (mode === 'cloud') {
        await adminDeleteEcho(activeToken, echoId)
      } else {
        localAdminDeleteEcho(visionCode, echoId)
      }
      setConfirmDeleteEcho(null)
      await loadData(mode, activeToken, visibilityFilter, appliedQuery)
      setActionNotice('已删除该条回声留言')
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : '删除留言失败')
    } finally {
      setBusyKey(null)
    }
  }

  if (!mode || !overview) {
    return (
      <div className="no-scrollbar relative h-dvh w-full overflow-y-auto bg-[#070b14] px-4 py-10 text-[#eef1f8]">
        <div className="mx-auto flex min-h-full max-w-[460px] flex-col justify-center">
          <div className="cinema-surface rounded-[28px] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
                <span className="hud-label text-signal/85">WINDPOST · 站长后台</span>
              </div>
              <button
                type="button"
                onClick={onExit}
                className="rounded-full border border-white/15 px-3 py-1 font-serif text-[11.5px] text-white/70 transition hover:border-signal/55 hover:text-signal"
              >
                返回前台
              </button>
            </div>

            <h1 className="mt-4 font-serif text-[22px] font-normal tracking-[0.06em] text-[#fff8ee]">
              风信 · 内容管理后台
            </h1>
            <p className="mt-2 font-serif text-[13px] leading-[1.75] text-white/62">
              输入服务端环境变量 <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11.5px] text-signal">ADMIN_TOKEN</code> 登录云端数据库，用于审核全部公开/私密视野、下架或清理异常图片与留言。
            </p>

            <form onSubmit={handleCloudSignIn} className="mt-5 space-y-3">
              <label className="block">
                <span className="font-serif text-[12px] text-white/75">管理员密钥</span>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  autoComplete="current-password"
                  placeholder="请输入至少 8 位 ADMIN_TOKEN"
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-[#060c1a]/80 px-4 py-2.5 font-mono text-[13px] text-[#fff8ee] outline-none placeholder:font-serif placeholder:text-white/32 focus:border-signal/65"
                />
              </label>

              {authStatus && (
                <div
                  className={`rounded-2xl border px-3.5 py-2.5 font-serif text-[12px] leading-[1.65] ${
                    authStatus.kind === 'unauthorized'
                      ? 'border-ember/45 bg-ember/10 text-[#ffc4b8]'
                      : 'border-signal/35 bg-signal/[0.08] text-signal/95'
                  }`}
                >
                  {authStatus.text}
                </div>
              )}

              <button
                type="submit"
                disabled={connecting}
                className="btn-primary w-full justify-center disabled:opacity-60"
              >
                {connecting ? '正在校验密钥…' : '连接云端后台'}
              </button>
            </form>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-serif text-[11.5px] text-white/50">
                  本地预览或离线调试时，可直接管理本机已投递缓存
                </span>
                <button
                  type="button"
                  onClick={enterLocalMode}
                  className="rounded-full border border-white/18 bg-white/[0.04] px-3.5 py-1.5 font-serif text-[12px] text-white/82 transition hover:border-signal/50 hover:text-signal"
                >
                  进入本机数据管理模式
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { stats, visions, recentEchoes } = overview

  return (
    <div className="no-scrollbar relative h-dvh w-full overflow-y-auto bg-[#070b14] text-[#eef1f8]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080e1d]/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
            <span className="font-serif text-[16px] font-normal tracking-[0.06em] text-[#fff8ee]">
              风信 · 站长后台
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 font-serif text-[11px] ${
                mode === 'cloud'
                  ? 'border-signal/45 bg-signal/15 text-signal'
                  : 'border-white/18 bg-white/[0.05] text-white/75'
              }`}
            >
              {mode === 'cloud' ? '☁ 云端数据库' : '💻 本机存储'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshNow()}
              disabled={loadingList}
              className="rounded-full border border-white/16 bg-white/[0.04] px-3 py-1.5 font-serif text-[12px] text-white/80 transition hover:border-signal/55 hover:text-signal disabled:opacity-50"
            >
              {loadingList ? '刷新中…' : '刷新数据'}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-white/16 bg-white/[0.04] px-3 py-1.5 font-serif text-[12px] text-white/75 transition hover:border-ember/50 hover:text-[#ffb9ac]"
            >
              {mode === 'cloud' ? '退出登录' : '切换云端'}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="btn-primary !px-4 !py-1.5 !text-[12px]"
            >
              返回前台
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1160px] space-y-5 px-4 py-5 pb-12 sm:px-6">
        {actionNotice && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-signal/35 bg-signal/[0.08] px-4 py-2.5 font-serif text-[12.5px] text-signal">
            <span>{actionNotice}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-white/60 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* 概览统计卡片 */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            {
              label: '全部视野',
              value: `${stats.totalVisions}`,
              sub: `公开 ${stats.publicVisions} · 私密 ${stats.privateVisions}`,
            },
            {
              label: '累计心跳',
              value: `${stats.totalHearts}`,
              sub: '全站访客同频',
            },
            {
              label: '回声留言',
              value: `${stats.totalEchoes}`,
              sub: '电台交互回应',
            },
            {
              label: '覆盖城市',
              value: `${stats.citiesCount}`,
              sub: `含原声 ${stats.voiceVisions} 份`,
            },
            {
              label: '近 24 小时新增',
              value: `${stats.recent24h}`,
              sub: '实时投递动态',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3.5"
            >
              <div className="font-serif text-[11.5px] text-white/55">{card.label}</div>
              <div className="hud-value mt-1 text-[24px] leading-none text-[#fff8ee]">
                {card.value}
              </div>
              <div className="mt-1.5 font-serif text-[11px] text-signal/80">{card.sub}</div>
            </div>
          ))}
        </section>

        {/* 标签切换 + 搜索过滤 */}
        <section className="flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.025] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-white/12 bg-white/[0.04] p-0.5">
              {(
                [
                  ['visions', `视野列表 (${visions.length})`],
                  ['echoes', `回声留言 (${recentEchoes.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-full px-3.5 py-1.5 font-serif text-[12px] transition ${
                    tab === id
                      ? 'bg-signal font-medium text-[#170f07]'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'visions' && (
              <div className="flex rounded-full border border-white/12 bg-white/[0.03] p-0.5">
                {(
                  [
                    ['all', '全部'],
                    ['public', '仅公开'],
                    ['private', '仅私密'],
                  ] as const
                ).map(([vis, label]) => (
                  <button
                    key={vis}
                    type="button"
                    onClick={() => void applyVisibilityFilter(vis)}
                    className={`rounded-full px-3 py-1 font-serif text-[11.5px] transition ${
                      visibilityFilter === vis
                        ? 'bg-white/16 text-[#fff8ee]'
                        : 'text-white/55 hover:text-white/85'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索代号 / 城市 / 署名人 / 内容…"
              className="min-w-0 flex-1 rounded-full border border-white/14 bg-[#060c1a]/75 px-3.5 py-1.5 font-serif text-[12px] text-[#fff8ee] outline-none placeholder:text-white/35 focus:border-signal/60 sm:w-64"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border border-signal/45 bg-signal/15 px-3.5 py-1.5 font-serif text-[12px] text-signal transition hover:bg-signal/25"
            >
              筛选
            </button>
            {appliedQuery && (
              <button
                type="button"
                onClick={() => void clearSearch()}
                className="shrink-0 rounded-full border border-white/15 px-2.5 py-1.5 font-serif text-[11.5px] text-white/65 hover:text-white"
              >
                清除
              </button>
            )}
          </form>
        </section>

        {/* 视野审核列表 */}
        {tab === 'visions' && (
          <section className="space-y-3">
            {visions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center font-serif text-[13px] text-white/55">
                当前筛选条件下暂无已投递的视野记录。
              </div>
            ) : (
              visions.map((item) => {
                const isExpanded = expandedCode === item.code
                const confirmingDel = confirmDeleteVision === item.code
                return (
                  <article
                    key={item.code}
                    className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03] p-4 transition hover:border-white/22"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="aspect-video w-full shrink-0 rounded-xl border border-white/12 bg-black/40 object-cover sm:w-44"
                        loading="lazy"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] text-signal">
                              #{item.code}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 font-serif text-[10.5px] ${
                                item.visibility === 'public'
                                  ? 'border-signal/45 bg-signal/12 text-signal'
                                  : 'border-white/20 bg-white/[0.06] text-white/65'
                              }`}
                            >
                              {item.visibility === 'public' ? '公开电台' : '私密下架'}
                            </span>
                            <span className="font-serif text-[12px] text-white/65">
                              {item.city} · {item.tempC}°C
                            </span>
                            {item.hasVoice && (
                              <span className="rounded-full border border-white/15 px-2 py-0.5 font-serif text-[10px] text-white/70">
                                含原声
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-white/45">
                            {formatTime(item.publishedAt)}
                          </span>
                        </div>

                        <h2 className="mt-2 font-serif text-[16px] font-normal text-[#fff8ee]">
                          {item.title}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-serif text-[12px] text-white/62">
                          <span>署名：{item.sender}</span>
                          {item.weather && <span>天气：{item.weather}</span>}
                          {item.scentTag && <span>气味：{item.scentTag}</span>}
                          <span>♥ {item.hearts}</span>
                          <span>💬 {item.echoes.length} 条回声</span>
                        </div>

                        {item.letter && (
                          <p className="mt-2 rounded-xl border border-white/8 bg-[#060c1a]/55 px-3 py-2 font-serif text-[12.5px] leading-[1.7] text-white/80">
                            “{item.letter}”
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busyKey === `vis-${item.code}`}
                            onClick={() => void handleToggleVisibility(item)}
                            className="rounded-full border border-signal/40 bg-signal/10 px-3 py-1 font-serif text-[11.5px] text-signal transition hover:bg-signal/20 disabled:opacity-50"
                          >
                            {item.visibility === 'public' ? '下架设为私密' : '恢复公开电台'}
                          </button>
                          <a
                            href={buildSignalUrl(item.code)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/16 bg-white/[0.04] px-3 py-1 font-serif text-[11.5px] text-white/78 transition hover:border-signal/45 hover:text-signal"
                          >
                            新窗口查看
                          </a>
                          {item.echoes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedCode(isExpanded ? null : item.code)}
                              className="rounded-full border border-white/16 bg-white/[0.04] px-3 py-1 font-serif text-[11.5px] text-white/78 transition hover:border-white/35"
                            >
                              {isExpanded ? '收起回声' : `查看回声 (${item.echoes.length})`}
                            </button>
                          )}

                          {confirmingDel ? (
                            <div className="ml-auto flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteVision(null)}
                                className="rounded-full border border-white/16 px-2.5 py-1 font-serif text-[11px] text-white/65"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                disabled={busyKey === `del-v-${item.code}`}
                                onClick={() => void handleDeleteVision(item.code)}
                                className="rounded-full border border-ember/60 bg-ember/20 px-3 py-1 font-serif text-[11px] text-[#ffb9ac] hover:bg-ember/30 disabled:opacity-50"
                              >
                                确认永久删除
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteVision(item.code)}
                              className="ml-auto rounded-full border border-white/14 px-3 py-1 font-serif text-[11.5px] text-white/62 transition hover:border-ember/50 hover:text-[#ffb9ac]"
                            >
                              删除
                            </button>
                          )}
                        </div>

                        {isExpanded && item.echoes.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                            {item.echoes.map((echo) => {
                              const confirmingEcho = confirmDeleteEcho === echo.id
                              return (
                                <div
                                  key={echo.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#060c1a]/65 px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-serif text-[12.5px] text-white/85">
                                      {echo.message}
                                    </p>
                                    <span className="font-mono text-[10px] text-white/40">
                                      {formatTime(echo.createdAt)}
                                    </span>
                                  </div>
                                  {confirmingEcho ? (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteEcho(null)}
                                        className="rounded-full border border-white/16 px-2 py-0.5 font-serif text-[10.5px] text-white/65"
                                      >
                                        取消
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyKey === `del-e-${echo.id}`}
                                        onClick={() => void handleDeleteEcho(item.code, echo.id)}
                                        className="rounded-full border border-ember/55 bg-ember/18 px-2.5 py-0.5 font-serif text-[10.5px] text-[#ffb9ac]"
                                      >
                                        确认删除
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteEcho(echo.id)}
                                      className="rounded-full border border-white/14 px-2.5 py-0.5 font-serif text-[10.5px] text-white/58 hover:border-ember/50 hover:text-[#ffb9ac]"
                                    >
                                      删除留言
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </section>
        )}

        {/* 回声留言审核列表 */}
        {tab === 'echoes' && (
          <section className="space-y-2.5">
            {recentEchoes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center font-serif text-[13px] text-white/55">
                暂无回声留言记录。
              </div>
            ) : (
              recentEchoes.map((echo) => {
                const confirmingEcho = confirmDeleteEcho === echo.id
                return (
                  <div
                    key={echo.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-serif text-[11.5px] text-white/55">
                        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10.5px] text-signal">
                          #{echo.visionCode || 'UNKNOWN'}
                        </span>
                        <span>{echo.city}</span>
                        <span className="truncate">{echo.visionTitle}</span>
                        <span className="font-mono text-[10.5px] text-white/40">
                          · {formatTime(echo.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 font-serif text-[13.5px] leading-[1.7] text-[#fff8ee]">
                        {echo.message}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {confirmingEcho ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteEcho(null)}
                            className="rounded-full border border-white/16 px-2.5 py-1 font-serif text-[11px] text-white/65"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            disabled={busyKey === `del-e-${echo.id}`}
                            onClick={() => void handleDeleteEcho(echo.visionCode, echo.id)}
                            className="rounded-full border border-ember/60 bg-ember/20 px-3 py-1 font-serif text-[11px] text-[#ffb9ac]"
                          >
                            确认删除
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteEcho(echo.id)}
                          className="rounded-full border border-white/14 px-3 py-1 font-serif text-[11.5px] text-white/65 transition hover:border-ember/50 hover:text-[#ffb9ac]"
                        >
                          删除留言
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </section>
        )}
      </main>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  auth,
  linkGithubAccount,
  loadCloudArchive,
  saveCloudArchive,
  signInWithGoogle,
  signInWithGithub,
  signOutUser,
} from './firebase'

const VERSION = '26.16.0b'
const STORAGE_KEY = 'songArchive_data'

type Song = {
  id: string
  title: string
  artist: string
  link?: string
  note?: string
  day: number
  createdAt: string
  updatedAt?: string
}

type ArchiveData = {
  initialized: boolean
  currentDay: number
  songs: Song[]
  createdAt: string
}

type View = 'init' | 'home' | 'add' | 'history' | 'detail' | 'edit' | 'settings'
type Theme = 'light' | 'dark' | 'system'

type SortOption = 'date-desc' | 'date-asc' | 'day-desc' | 'day-asc'

const defaultData = (): ArchiveData => ({
  initialized: false,
  currentDay: 1,
  songs: [],
  createdAt: new Date().toISOString(),
})

function normalizeSong(value: unknown): Song | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>

  const dayValue =
    typeof record.day === 'number'
      ? record.day
      : typeof record.recordedDay === 'number'
        ? record.recordedDay
        : null

  if (
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.artist !== 'string' ||
    dayValue === null ||
    !Number.isInteger(dayValue) ||
    dayValue < 1 ||
    typeof record.createdAt !== 'string'
  ) {
    return null
  }

  if (record.link !== undefined && typeof record.link !== 'string') return null
  if (record.note !== undefined && typeof record.note !== 'string') return null
  if (record.updatedAt !== undefined && typeof record.updatedAt !== 'string') return null

  const song: Song = {
    id: record.id,
    title: record.title,
    artist: record.artist,
    day: dayValue,
    createdAt: record.createdAt,
  }

  if (typeof record.link === 'string' && record.link) song.link = record.link
  if (typeof record.note === 'string' && record.note) song.note = record.note
  if (typeof record.updatedAt === 'string') song.updatedAt = record.updatedAt

  return song
}

function parseArchiveData(value: unknown): ArchiveData | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.initialized !== 'boolean') return null
  if (
    typeof record.currentDay !== 'number' ||
    !Number.isInteger(record.currentDay) ||
    record.currentDay < 1
  ) {
    return null
  }
  if (!Array.isArray(record.songs)) return null

  const songs: Song[] = []
  for (const item of record.songs) {
    const song = normalizeSong(item)
    if (!song) return null
    songs.push(song)
  }

  const createdAt =
    typeof record.createdAt === 'string'
      ? record.createdAt
      : songs.length > 0
        ? songs.reduce((earliest, s) =>
            s.createdAt < earliest ? s.createdAt : earliest,
          songs[0].createdAt)
        : new Date().toISOString()

  return {
    initialized: record.initialized,
    currentDay: record.currentDay,
    songs,
    createdAt,
  }
}

function loadData(): ArchiveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed: unknown = JSON.parse(raw)
    const validated = parseArchiveData(parsed)
    if (!validated) return defaultData()
    return validated
  } catch {
    return defaultData()
  }
}

function getInitialAppState() {
  const data = loadData()
  return {
    data,
    view: data.initialized ? 'home' : 'init',
    settingsDayInput: String(data.currentDay),
  } satisfies {
    data: ArchiveData
    view: View
    settingsDayInput: string
  }
}

function formatBackupDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function downloadBackup(data: ArchiveData) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `SongArchive_Backup_${formatBackupDate(new Date())}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function persistData(data: ArchiveData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const THEME_STORAGE_KEY = 'songArchive_theme'

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'system'
}

function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

const styles = `
  html,
  body,
  #root {
    width: 100%;
    min-width: 0;
    min-height: 100%;
    margin: 0;
  }

  html {
    overflow-y: auto;
    -webkit-text-size-adjust: 100%;
  }

  body {
    min-height: 100%;
    overflow-x: hidden;
    background: #07101f;
    overscroll-behavior-x: none;
  }

  .sa-root {
    --sa-bg-start: #07101f;
    --sa-bg-end: #15122e;
    --sa-surface: rgba(20, 29, 56, 0.46);
    --sa-surface-strong: rgba(28, 38, 72, 0.68);
    --sa-surface-input: rgba(7, 14, 33, 0.34);
    --sa-surface-hover: rgba(101, 125, 211, 0.22);
    --sa-text: rgba(230, 236, 255, 0.74);
    --sa-text-bright: #ffffff;
    --sa-text-muted: rgba(220, 228, 255, 0.5);
    --sa-border: rgba(255, 255, 255, 0.13);
    --sa-border-bright: rgba(255, 255, 255, 0.28);
    --sa-accent: #a9c7ff;
    --sa-accent-strong: #d5e2ff;
    --sa-accent-soft: rgba(151, 190, 255, 0.24);
    --sa-accent-glow: rgba(118, 157, 255, 0.34);
    --sa-danger: #ff9b9c;
    --sa-danger-soft: rgba(255, 123, 128, 0.18);
    --sa-shadow: 0 18px 42px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    --sa-shadow-raised: 0 16px 36px rgba(4, 8, 28, 0.26), 0 0 0 1px rgba(255, 255, 255, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.13);
    --sa-touch: 2.875rem;
    --sa-tab-height: 4.55rem;
    --sa-bottom-space: calc(var(--sa-tab-height) + env(safe-area-inset-bottom) + 1.8rem);

    position: relative;
    isolation: isolate;
    min-height: 100dvh;
    min-height: 100svh;
    padding: max(1.05rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) var(--sa-bottom-space) max(1rem, env(safe-area-inset-left));
    overflow-x: hidden;
    color: var(--sa-text);
    touch-action: pan-y;
    overscroll-behavior-x: none;
    background:
      radial-gradient(58rem 35rem at -10% -14%, rgba(69, 164, 255, 0.33), transparent 58%),
      radial-gradient(44rem 33rem at 108% 16%, rgba(201, 108, 255, 0.3), transparent 60%),
      radial-gradient(36rem 28rem at 52% 112%, rgba(52, 226, 205, 0.16), transparent 63%),
      linear-gradient(145deg, var(--sa-bg-start) 0%, var(--sa-bg-end) 100%);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Microsoft JhengHei", sans-serif;
    letter-spacing: -0.01em;
    -webkit-tap-highlight-color: transparent;
  }

  .sa-root *,
  .sa-root *::before,
  .sa-root *::after {
    box-sizing: border-box;
  }

  .sa-root::before,
  .sa-root::after {
    position: fixed;
    z-index: -2;
    width: 15rem;
    height: 15rem;
    border-radius: 999px;
    filter: blur(26px);
    opacity: 0.42;
    content: '';
    pointer-events: none;
    animation: sa-drift 15s ease-in-out infinite alternate;
  }

  .sa-root::before {
    top: 18%;
    left: -7rem;
    background: rgba(64, 181, 255, 0.44);
  }

  .sa-root::after {
    right: -7rem;
    bottom: 16%;
    background: rgba(210, 105, 255, 0.34);
    animation-delay: -6s;
  }

  .sa-root.light {
    --sa-bg-start: #dceaff;
    --sa-bg-end: #f8f8ff;
    --sa-surface: rgba(255, 255, 255, 0.52);
    --sa-surface-strong: rgba(255, 255, 255, 0.74);
    --sa-surface-input: rgba(255, 255, 255, 0.55);
    --sa-surface-hover: rgba(130, 177, 255, 0.19);
    --sa-text: rgba(30, 44, 78, 0.78);
    --sa-text-bright: #12213f;
    --sa-text-muted: rgba(39, 56, 94, 0.54);
    --sa-border: rgba(255, 255, 255, 0.62);
    --sa-border-bright: rgba(255, 255, 255, 0.94);
    --sa-accent: #2864bd;
    --sa-accent-strong: #154c9b;
    --sa-accent-soft: rgba(73, 134, 230, 0.16);
    --sa-accent-glow: rgba(65, 135, 235, 0.25);
    --sa-danger: #c63e55;
    --sa-danger-soft: rgba(221, 76, 97, 0.12);
    --sa-shadow: 0 18px 42px rgba(44, 76, 138, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.86);
    --sa-shadow-raised: 0 16px 34px rgba(49, 85, 145, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .sa-liquid-orb {
    position: fixed;
    z-index: -1;
    width: 14rem;
    height: 14rem;
    border-radius: 44% 56% 63% 37% / 48% 40% 60% 52%;
    filter: blur(34px) saturate(130%);
    pointer-events: none;
    opacity: 0.42;
    mix-blend-mode: screen;
    animation: sa-orb-float 17s ease-in-out infinite;
  }

  .sa-orb-one {
    top: 6%;
    right: 2%;
    background: rgba(90, 150, 255, 0.42);
  }

  .sa-orb-two {
    bottom: 10%;
    left: 4%;
    width: 12rem;
    height: 12rem;
    background: rgba(148, 91, 255, 0.32);
    animation-delay: -5.5s;
  }

  .sa-orb-three {
    top: 43%;
    left: 48%;
    width: 10rem;
    height: 10rem;
    background: rgba(57, 232, 191, 0.22);
    animation-delay: -10.5s;
  }

  .sa-root.light .sa-liquid-orb {
    opacity: 0.34;
    mix-blend-mode: multiply;
  }

  .sa-grid,
  .sa-scanline {
    display: none;
  }

  .sa-page-stage {
    position: relative;
    z-index: 1;
    width: 100%;
    min-height: 0;
    flex: 1 0 auto;
    display: flex;
    justify-content: center;
    animation: sa-page-enter 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .sa-main {
    width: min(100%, 39rem);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0 auto;
    flex: 0 1 auto;
    padding: 0.35rem 0 1rem;
  }

  .sa-home-page {
    gap: 1.15rem;
  }

  .sa-home-header {
    gap: 0.22rem;
    padding: 0.2rem 0 0;
  }

  .sa-home-header .sa-title {
    font-size: clamp(2rem, 8vw, 2.45rem);
  }

  .sa-home-stats {
    gap: 0.65rem;
  }

  .sa-home-stats .sa-stat-card {
    min-height: 5.75rem;
    padding: 0.88rem 0.95rem;
  }

  .sa-home-recent {
    display: flex;
    flex-direction: column;
    gap: 0.62rem;
  }

  .sa-home-recent-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .sa-home-recent-list {
    gap: 0.55rem;
  }

  .sa-home-empty {
    margin: 0;
    padding: 0.9rem 1rem;
    border: 1px solid var(--sa-border);
    border-radius: 1rem;
    color: var(--sa-text-muted);
    background: rgba(255, 255, 255, 0.18);
    text-align: center;
  }

  .sa-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.65rem 0 0.3rem;
    text-align: center;
  }

  .sa-badge,
  .sa-section-title,
  .sa-label,
  .sa-version {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--sa-accent);
  }

  .sa-badge {
    padding: 0.34rem 0.7rem;
    border: 1px solid var(--sa-border);
    border-radius: 999px;
    background: linear-gradient(115deg, var(--sa-accent-soft), rgba(255, 255, 255, 0.035));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 6px 18px rgba(45, 80, 179, 0.08);
  }

  .sa-title {
    max-width: 100%;
    margin: 0;
    color: var(--sa-text-bright);
    font-size: clamp(1.72rem, 7vw, 2.35rem);
    font-weight: 750;
    line-height: 1.18;
    letter-spacing: -0.045em;
    overflow-wrap: anywhere;
    text-shadow: 0 1px 18px rgba(255, 255, 255, 0.1);
  }

  .sa-version {
    margin: 0;
    color: var(--sa-text-muted);
    letter-spacing: 0.04em;
  }

  .sa-subtitle,
  .sa-page-copy {
    margin: 0;
    color: var(--sa-text-muted);
    font-size: 0.9rem;
    line-height: 1.65;
  }

  .sa-page-copy {
    max-width: 31rem;
  }

  .sa-divider {
    width: 100%;
    height: 1px;
    margin: 0.12rem 0;
    background: linear-gradient(90deg, transparent, var(--sa-border-bright), transparent);
    opacity: 0.65;
  }

  .sa-card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
  }

  .sa-stat-card,
  .sa-meta-row,
  .sa-recent-item,
  .sa-history-item,
  .sa-account,
  .sa-detail-card,
  .sa-form,
  .sa-settings-group {
    border: 1px solid var(--sa-border);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.025)), var(--sa-surface);
    box-shadow: var(--sa-shadow);
    -webkit-backdrop-filter: blur(22px) saturate(180%);
    backdrop-filter: blur(22px) saturate(180%);
  }

  .sa-stat-card {
    position: relative;
    min-height: 6.25rem;
    padding: 1rem;
    border-radius: 1.35rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.45rem;
    overflow: hidden;
  }

  .sa-stat-card::after {
    width: 4.5rem;
    height: 4.5rem;
    position: absolute;
    content: '';
    align-self: flex-end;
    border-radius: 999px;
    background: radial-gradient(circle, var(--sa-accent-soft), transparent 68%);
    filter: blur(3px);
  }

  .sa-stat-card p,
  .sa-meta-row p {
    z-index: 1;
    margin: 0;
    color: var(--sa-text-muted);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .sa-stat-card span,
  .sa-meta-row span {
    z-index: 1;
    color: var(--sa-text-bright);
    font-size: 1.14rem;
    font-weight: 720;
    letter-spacing: -0.03em;
  }

  .sa-meta,
  .sa-actions,
  .sa-recent-list,
  .sa-init-sync {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.72rem;
  }

  .sa-meta-row {
    min-height: 3.4rem;
    padding: 0.75rem 0.9rem;
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .sa-meta-row span {
    font-size: 0.87rem;
    text-align: right;
  }

  .sa-section-title {
    margin: 0;
  }

  .sa-recent-list,
  .sa-history-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sa-recent-item {
    padding: 0.9rem 1rem;
    border-radius: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .sa-recent-item strong,
  .sa-history-btn strong,
  .sa-account strong,
  .sa-detail-row dd {
    color: var(--sa-text-bright);
    overflow-wrap: anywhere;
  }

  .sa-recent-item strong {
    font-size: 0.98rem;
  }

  .sa-recent-item span {
    color: var(--sa-text-muted);
    font-size: 0.8rem;
  }

  .sa-actions-row,
  .sa-auth-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .sa-btn {
    width: 100%;
    min-height: var(--sa-touch);
    padding: 0.78rem 1rem;
    border: 1px solid var(--sa-border);
    border-radius: 1rem;
    color: var(--sa-text-bright);
    background: linear-gradient(128deg, rgba(255, 255, 255, 0.19), rgba(255, 255, 255, 0.045)), var(--sa-surface-strong);
    box-shadow: var(--sa-shadow-raised);
    cursor: pointer;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 680;
    letter-spacing: -0.01em;
    text-align: center;
    transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease;
    touch-action: manipulation;
    -webkit-appearance: none;
    appearance: none;
    -webkit-backdrop-filter: blur(18px) saturate(175%);
    backdrop-filter: blur(18px) saturate(175%);
  }

  .sa-btn:hover:not(:disabled) {
    border-color: var(--sa-border-bright);
    background: linear-gradient(128deg, rgba(255, 255, 255, 0.27), rgba(255, 255, 255, 0.075)), var(--sa-surface-hover);
    box-shadow: 0 18px 34px rgba(15, 24, 62, 0.22), 0 0 0 4px var(--sa-accent-soft), inset 0 1px 0 rgba(255, 255, 255, 0.21);
  }

  .sa-btn:active:not(:disabled),
  .sa-tab-item:active {
    transform: scale(0.97);
  }

  .sa-btn:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .sa-btn:focus-visible,
  .sa-tab-item:focus-visible,
  .sa-input:focus-visible,
  .sa-select:focus-visible,
  .sa-textarea:focus-visible,
  .sa-history-btn:focus-visible {
    outline: 2px solid var(--sa-accent);
    outline-offset: 3px;
  }

  .sa-btn-ghost {
    color: var(--sa-text);
    background: rgba(255, 255, 255, 0.035);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
  }

  .sa-btn-danger {
    color: var(--sa-danger);
    border-color: rgba(255, 150, 157, 0.26);
    background: linear-gradient(135deg, rgba(255, 147, 156, 0.18), rgba(255, 255, 255, 0.03)), var(--sa-danger-soft);
  }

  .sa-btn-danger:hover:not(:disabled) {
    border-color: rgba(255, 171, 176, 0.58);
    box-shadow: 0 16px 32px rgba(100, 20, 39, 0.18), 0 0 0 4px rgba(255, 134, 143, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .sa-btn-sm {
    min-height: 2.55rem;
    padding: 0.57rem 0.75rem;
    font-size: 0.82rem;
  }

  .sa-form,
  .sa-settings-group {
    padding: 1rem;
    border-radius: 1.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.84rem;
  }

  .sa-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .sa-label {
    padding-left: 0.15rem;
    color: var(--sa-text-muted);
    letter-spacing: 0.025em;
  }

  .sa-input,
  .sa-select,
  .sa-textarea {
    width: 100%;
    min-height: var(--sa-touch);
    padding: 0.72rem 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.9rem;
    outline: none;
    color: var(--sa-text-bright);
    background: var(--sa-surface-input);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.14), 0 1px 0 rgba(255, 255, 255, 0.08);
    font: inherit;
    font-size: 0.95rem;
    transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
    -webkit-appearance: none;
    appearance: none;
    -webkit-backdrop-filter: blur(14px) saturate(160%);
    backdrop-filter: blur(14px) saturate(160%);
  }

  .sa-select {
    cursor: pointer;
    color-scheme: dark;
  }

  .sa-root.light .sa-select {
    color-scheme: light;
  }

  .sa-textarea {
    min-height: 6rem;
    resize: vertical;
    line-height: 1.55;
  }

  .sa-input::placeholder,
  .sa-textarea::placeholder {
    color: var(--sa-text-muted);
    opacity: 0.76;
  }

  .sa-input:focus,
  .sa-select:focus,
  .sa-textarea:focus {
    border-color: var(--sa-accent);
    background: rgba(255, 255, 255, 0.09);
    box-shadow: 0 0 0 4px var(--sa-accent-soft), inset 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .sa-root.light .sa-input:focus,
  .sa-root.light .sa-select:focus,
  .sa-root.light .sa-textarea:focus {
    background: rgba(255, 255, 255, 0.8);
  }

  .sa-error,
  .sa-success,
  .sa-empty {
    margin: 0;
    padding: 0.62rem 0.75rem;
    border-radius: 0.8rem;
    font-size: 0.83rem;
    line-height: 1.55;
    text-align: center;
  }

  .sa-error {
    color: var(--sa-danger);
    background: var(--sa-danger-soft);
  }

  .sa-success {
    color: var(--sa-accent-strong);
    background: var(--sa-accent-soft);
  }

  .sa-empty {
    color: var(--sa-text-muted);
  }

  .sa-account {
    padding: 0.95rem;
    border-radius: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .sa-account strong {
    font-size: 0.95rem;
  }

  .sa-account span {
    color: var(--sa-text-muted);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }

  .sa-account span:last-child {
    color: var(--sa-accent);
  }

  .sa-file-input {
    display: none;
  }

  .sa-detail-card {
    margin: 0;
    padding: 1rem;
    border-radius: 1.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sa-detail-row {
    display: grid;
    grid-template-columns: minmax(4.5rem, 0.5fr) minmax(0, 1.8fr);
    gap: 0.75rem;
    align-items: start;
  }

  .sa-detail-row dt {
    margin: 0;
    color: var(--sa-text-muted);
    font-size: 0.76rem;
    font-weight: 700;
  }

  .sa-detail-row dd {
    margin: 0;
    font-size: 0.91rem;
    line-height: 1.5;
  }

  .sa-detail-link {
    color: var(--sa-accent);
    text-decoration: none;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.18em;
  }

  .sa-detail-link:hover {
    color: var(--sa-accent-strong);
    text-decoration: underline;
  }

  .sa-filters {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.56rem;
  }

  .sa-filters .sa-field:last-child {
    grid-column: 1 / -1;
  }

  .sa-history-page {
    min-height: calc(100svh - env(safe-area-inset-top) - var(--sa-bottom-space) - 1.4rem);
    gap: 0.75rem;
  }

  .sa-history-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.15rem 0 0;
  }

  .sa-history-topbar .sa-btn {
    width: auto;
    flex: 0 0 auto;
  }

  .sa-history-heading {
    flex: 1;
    min-width: 0;
    text-align: right;
  }

  .sa-history-heading .sa-title {
    font-size: clamp(1.3rem, 5vw, 1.72rem);
  }

  .sa-history-heading .sa-subtitle {
    margin-top: 0.14rem;
    font-size: 0.76rem;
  }

  .sa-history-scroll {
    width: 100%;
    min-height: 0;
    flex: none;
    overflow: visible;
    padding: 0.1rem 0.12rem 0.9rem;
  }

  .sa-history-list {
    display: flex;
    flex-direction: column;
    gap: 0.72rem;
  }

  .sa-history-item {
    overflow: hidden;
    border-radius: 1.2rem;
    transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  }

  .sa-history-item:hover {
    border-color: var(--sa-border-bright);
    box-shadow: 0 15px 28px rgba(13, 25, 65, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }

  .sa-history-btn {
    width: 100%;
    min-height: 5.3rem;
    padding: 1rem 1.05rem;
    border: 0;
    color: inherit;
    background: transparent;
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: transform 160ms ease, background-color 160ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .sa-history-btn:active {
    transform: scale(0.985);
    background: rgba(255, 255, 255, 0.055);
  }

  .sa-history-btn strong,
  .sa-history-btn span {
    display: block;
  }

  .sa-history-btn strong {
    margin-bottom: 0.25rem;
    font-size: 1rem;
    font-weight: 720;
    line-height: 1.4;
  }

  .sa-history-btn span {
    color: var(--sa-text-muted);
    font-size: 0.81rem;
    line-height: 1.45;
  }

  .sa-history-date {
    margin-top: 0.12rem;
    font-size: 0.72rem !important;
    opacity: 0.76;
  }

  .sa-tab-bar {
    position: fixed;
    z-index: 20;
    left: 50%;
    bottom: max(0.62rem, env(safe-area-inset-bottom));
    width: min(calc(100% - 1.2rem), 34rem);
    min-height: var(--sa-tab-height);
    padding: 0.36rem;
    border: 1px solid var(--sa-border-bright);
    border-radius: 1.55rem;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: stretch;
    transform: translateX(-50%);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.21), rgba(255, 255, 255, 0.035)), rgba(15, 23, 53, 0.48);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.29), inset 0 1px 0 rgba(255, 255, 255, 0.24);
    -webkit-backdrop-filter: blur(24px) saturate(185%);
    backdrop-filter: blur(24px) saturate(185%);
  }

  .sa-root.light .sa-tab-bar {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.46));
  }

  .sa-root.light .sa-home-page .sa-stat-card,
  .sa-root.light .sa-home-page .sa-recent-item {
    border-color: rgba(255, 255, 255, 0.86);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.48));
    box-shadow: 0 14px 30px rgba(55, 91, 151, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.94);
  }

  .sa-tab-item {
    position: relative;
    min-height: 3.75rem;
    padding: 0.28rem 0.2rem;
    border: 0;
    border-radius: 1.08rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.12rem;
    color: var(--sa-text-muted);
    background: transparent;
    cursor: pointer;
    font: inherit;
    transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
    touch-action: manipulation;
  }

  .sa-tab-item.active {
    color: var(--sa-accent-strong);
    background: linear-gradient(140deg, rgba(255, 255, 255, 0.22), var(--sa-accent-soft));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 6px 18px var(--sa-accent-soft);
  }

  .sa-tab-item.active::before {
    position: absolute;
    top: 0.42rem;
    width: 0.32rem;
    height: 0.32rem;
    border-radius: 999px;
    background: var(--sa-accent);
    box-shadow: 0 0 12px var(--sa-accent-glow);
    content: '';
  }

  .sa-tab-icon {
    font-size: 1.18rem;
    font-weight: 750;
    line-height: 1;
  }

  .sa-tab-label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .sa-modal-overlay {
    position: fixed;
    z-index: 50;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(1.25rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right)) max(1.25rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
    background: rgba(4, 9, 26, 0.48);
    -webkit-backdrop-filter: blur(10px) saturate(130%);
    backdrop-filter: blur(10px) saturate(130%);
    animation: sa-fade 180ms ease both;
  }

  .sa-modal {
    width: min(100%, 25rem);
    padding: 1.2rem;
    border: 1px solid var(--sa-border-bright);
    border-radius: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.19), rgba(255, 255, 255, 0.055)), var(--sa-surface-strong);
    box-shadow: 0 26px 62px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.22);
    -webkit-backdrop-filter: blur(26px) saturate(185%);
    backdrop-filter: blur(26px) saturate(185%);
    animation: sa-modal-enter 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .sa-modal-title {
    margin: 0;
    color: var(--sa-text-bright);
    font-size: 1.08rem;
    letter-spacing: -0.025em;
    text-align: center;
  }

  .sa-modal-text {
    margin: 0;
    color: var(--sa-text);
    font-size: 0.86rem;
    line-height: 1.65;
    text-align: center;
  }

  .sa-modal-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .sa-footer {
    margin-top: 0.2rem;
    color: var(--sa-text-muted);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-align: center;
  }

  @keyframes sa-page-enter {
    from { opacity: 0; transform: translateY(0.9rem) scale(0.99); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes sa-modal-enter {
    from { opacity: 0; transform: translateY(0.9rem) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes sa-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes sa-drift {
    from { transform: translate3d(-1.5rem, -0.8rem, 0) scale(0.92); }
    to { transform: translate3d(2.2rem, 1.4rem, 0) scale(1.08); }
  }

  @keyframes sa-orb-float {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); }
    50% { transform: translate3d(1.8rem, -1.5rem, 0) scale(1.12) rotate(14deg); }
  }

  @media (max-width: 47.99rem) {
    .sa-root {
      padding-top: max(2.6rem, calc(env(safe-area-inset-top) + 0.85rem));
    }

    .sa-tab-bar {
      bottom: max(0.8rem, calc(env(safe-area-inset-bottom) + 0.4rem));
    }
  }

  @media (min-width: 42rem) {
    .sa-root {
      padding-top: max(1.7rem, env(safe-area-inset-top));
    }

    .sa-main {
      gap: 1.15rem;
    }

    .sa-form,
    .sa-settings-group {
      padding: 1.15rem;
    }

    .sa-history-page {
      min-height: calc(100svh - env(safe-area-inset-top) - var(--sa-bottom-space) - 2rem);
    }
  }

  @media (min-width: 48rem) {
    .sa-main {
      width: min(100%, 45rem);
    }

    .sa-card-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .sa-filters {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(9rem, 0.72fr);
    }

    .sa-filters .sa-field:last-child {
      grid-column: auto;
    }
  }

  @media (max-width: 23rem) {
    .sa-root {
      padding-inline: 0.68rem;
    }

    .sa-tab-bar {
      width: calc(100% - 0.7rem);
      border-radius: 1.25rem;
    }

    .sa-tab-label {
      font-size: 0.62rem;
    }

    .sa-actions-row,
    .sa-auth-actions {
      grid-template-columns: 1fr;
    }

    .sa-detail-row {
      grid-template-columns: 1fr;
      gap: 0.15rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sa-root *,
    .sa-root *::before,
    .sa-root *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`

type ConfirmAction =
  | { type: 'deleteSong'; songId: string; songTitle: string }
  | { type: 'resetDay' }
  | { type: 'resetInit' }
  | { type: 'importData'; data: ArchiveData }
  | { type: 'clearAll' }
  | { type: 'signOut' }

function getConfirmContent(action: ConfirmAction) {
  switch (action.type) {
    case 'deleteSong':
      return {
        title: '確定要刪除此歌曲嗎？',
        message: `確定要刪除「${action.songTitle}」嗎？此操作無法復原。`,
        confirmText: '確定刪除',
        danger: true,
      }
    case 'resetDay':
      return {
        title: '確定要重置天數嗎？',
        message: '目前天數將設為 1。',
        confirmText: '確定重置',
        danger: false,
      }
    case 'resetInit':
      return {
        title: '確定要重置初始化設定嗎？',
        message: '將回到初次設定畫面，歌曲資料會保留。',
        confirmText: '確定重置',
        danger: false,
      }
    case 'importData':
      return {
        title: '確定要匯入資料嗎？',
        message: '匯入將覆蓋目前資料，是否繼續？',
        confirmText: '確定匯入',
        danger: false,
      }
    case 'clearAll':
      return {
        title: '確定要清除所有資料嗎？',
        message: '此操作無法復原，所有歌曲紀錄、設定與資料將永久刪除。',
        confirmText: '確定清除',
        danger: true,
      }
    case 'signOut':
      return {
        title: '確定要登出嗎？',
        message: '登出後將停止同步雲端資料，但本機資料仍會保留。',
        confirmText: '確定登出',
        danger: false,
      }
  }
}

function ConfirmModal({
  action,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction
  onCancel: () => void
  onConfirm: () => void
}) {
  const { title, message, confirmText, danger } = getConfirmContent(action)

  return (
    <div
      className="sa-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="sa-modal">
        <h2 id="confirm-dialog-title" className="sa-modal-title">
          {title}
        </h2>
        <p className="sa-modal-text">{message}</p>
        <div className="sa-modal-actions">
          <button type="button" className="sa-btn sa-btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={`sa-btn${danger ? ' sa-btn-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

function Shell({
  children,
  overlay,
  activeView,
  onViewChange,
  theme,
}: {
  children: React.ReactNode
  overlay?: React.ReactNode
  activeView: View
  onViewChange: (view: View) => void
  theme: Theme
}) {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const showTabBar = activeView !== 'init' && activeView !== 'detail' && activeView !== 'edit'
  const tabs: Array<{ view: 'home' | 'add' | 'history' | 'settings'; label: string; icon: string }> = [
    { view: 'home', label: '首頁', icon: '⌂' },
    { view: 'add', label: '新增', icon: '＋' },
    { view: 'history', label: '紀錄', icon: '▤' },
    { view: 'settings', label: '設定', icon: '⚙' },
  ]

  return (
    <>
      <style>{styles}</style>
      <div className={`sa-root ${resolvedTheme}`}>
        <div className="sa-grid" aria-hidden="true" />
        <div className="sa-scanline" aria-hidden="true" />
        <div className="sa-liquid-orb sa-orb-one" aria-hidden="true" />
        <div className="sa-liquid-orb sa-orb-two" aria-hidden="true" />
        <div className="sa-liquid-orb sa-orb-three" aria-hidden="true" />
        <div className="sa-page-stage" key={activeView}>{children}</div>

        {showTabBar && (
          <nav className="sa-tab-bar" aria-label="主要導覽">
            {tabs.map((tab) => (
              <button
                key={tab.view}
                type="button"
                className={`sa-tab-item${activeView === tab.view ? ' active' : ''}`}
                aria-current={activeView === tab.view ? 'page' : undefined}
                onClick={() => onViewChange(tab.view)}
              >
                <span className="sa-tab-icon" aria-hidden="true">{tab.icon}</span>
                <span className="sa-tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        )}

        {overlay}
      </div>
    </>
  )
}

function App() {
  const [initialState] = useState(getInitialAppState)
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [data, setData] = useState<ArchiveData>(initialState.data)
  const dataRef = useRef(initialState.data)
  const [view, setView] = useState<View>(initialState.view)
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null)

  const [initDayInput, setInitDayInput] = useState('1')
  const [initError, setInitError] = useState('')
  const [initMessage, setInitMessage] = useState('')

  const [songTitle, setSongTitle] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [songLink, setSongLink] = useState('')
  const [songNote, setSongNote] = useState('')
  const [formError, setFormError] = useState('')

  const [searchTitle, setSearchTitle] = useState('')
  const [searchArtist, setSearchArtist] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('date-desc')

  const [settingsDayInput, setSettingsDayInput] = useState(initialState.settingsDayInput)
  const [settingsError, setSettingsError] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'error'>('local')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser)

        if (!nextUser) {
          setSyncStatus('local')
          setAuthReady(true)
          return
        }

        setSyncStatus('syncing')
        void loadCloudArchive(nextUser)
          .then((cloudValue) => {
            if (cloudValue === null) {
              return saveCloudArchive(nextUser, dataRef.current)
            }

            const cloudData = parseArchiveData(cloudValue)
            if (!cloudData) throw new Error('Invalid cloud archive')

            dataRef.current = cloudData
            setData(cloudData)
            persistData(cloudData)
            setInitDayInput(String(cloudData.currentDay))
            setSettingsDayInput(String(cloudData.currentDay))
            setView((currentView) => {
              if (currentView !== 'init') return currentView
              return cloudData.initialized ? 'home' : 'init'
            })
          })
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('error'))
          .finally(() => setAuthReady(true))
      }),
    [],
  )

  const selectedSong = useMemo(
    () => data.songs.find((s) => s.id === selectedSongId) ?? null,
    [data.songs, selectedSongId],
  )

  const activeView: View =
    (view === 'detail' || view === 'edit') && !selectedSong ? 'history' : view

  const recentSongs = useMemo(
    () =>
      [...data.songs]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [data.songs],
  )

  const filteredSongs = useMemo(() => {
    let list = [...data.songs]
    const titleQ = searchTitle.trim().toLowerCase()
    const artistQ = searchArtist.trim().toLowerCase()

    if (titleQ) list = list.filter((s) => s.title.toLowerCase().includes(titleQ))
    if (artistQ) list = list.filter((s) => s.artist.toLowerCase().includes(artistQ))

    list.sort((a, b) => {
      switch (sortOption) {
        case 'date-asc':
          return a.createdAt.localeCompare(b.createdAt)
        case 'day-desc':
          return b.day - a.day || b.createdAt.localeCompare(a.createdAt)
        case 'day-asc':
          return a.day - b.day || a.createdAt.localeCompare(b.createdAt)
        case 'date-desc':
        default:
          return b.createdAt.localeCompare(a.createdAt)
      }
    })

    return list
  }, [data.songs, searchTitle, searchArtist, sortOption])

  const updateData = (next: ArchiveData) => {
    dataRef.current = next
    setData(next)
    persistData(next)

    if (user) {
      setSyncStatus('syncing')
      void saveCloudArchive(user, next)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'))
    }
  }

  const parseDay = (value: string): number | null => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const num = Number(trimmed)
    if (!Number.isInteger(num) || num < 1) return null
    return num
  }

  const resetSongForm = () => {
    setSongTitle('')
    setSongArtist('')
    setSongLink('')
    setSongNote('')
    setFormError('')
  }



  const openEditSong = (song: Song) => {
    setSelectedSongId(song.id)
    setSongTitle(song.title)
    setSongArtist(song.artist)
    setSongLink(song.link ?? '')
    setSongNote(song.note ?? '')
    setFormError('')
    setView('edit')
  }

  const openSongDetail = (songId: string) => {
    setSelectedSongId(songId)
    setView('detail')
  }

  const handleInit = () => {
    const day = parseDay(initDayInput)
    if (day === null) {
      setInitError('請輸入大於 0 的整數天數')
      return
    }
    const now = new Date().toISOString()
    const next: ArchiveData = {
      initialized: true,
      currentDay: day,
      songs: data.songs,
      createdAt: data.createdAt || now,
    }
    updateData(next)
    setSettingsDayInput(String(day))
    setInitError('')
    setInitMessage('')
    setView('home')
  }

  const validateSongForm = (): boolean => {
    if (!songTitle.trim()) {
      setFormError('請輸入歌名')
      return false
    }
    if (!songArtist.trim()) {
      setFormError('請輸入歌手')
      return false
    }
    return true
  }

  const handleAddSong = () => {
    if (!validateSongForm()) return

    const now = new Date().toISOString()
    const song: Song = {
      id: crypto.randomUUID(),
      title: songTitle.trim(),
      artist: songArtist.trim(),
      day: data.currentDay,
      createdAt: now,
    }

    if (songLink.trim()) song.link = songLink.trim()
    if (songNote.trim()) song.note = songNote.trim()

    const nextDay = data.currentDay + 1
    updateData({
      ...data,
      currentDay: nextDay,
      songs: [song, ...data.songs],
    })
    setSettingsDayInput(String(nextDay))
    resetSongForm()
    setView('home')
  }

  const handleEditSong = () => {
    if (!selectedSongId || !validateSongForm()) return

    const now = new Date().toISOString()
    const songs = data.songs.map((s) => {
      if (s.id !== selectedSongId) return s
      const updated: Song = {
        ...s,
        title: songTitle.trim(),
        artist: songArtist.trim(),
        updatedAt: now,
      }
      if (songLink.trim()) {
        updated.link = songLink.trim()
      } else {
        delete updated.link
      }
      if (songNote.trim()) {
        updated.note = songNote.trim()
      } else {
        delete updated.note
      }
      return updated
    })

    updateData({ ...data, songs })
    resetSongForm()
    setView('history')
  }

  const handleDeleteSongRequest = (songId: string) => {
    const song = data.songs.find((s) => s.id === songId)
    if (!song) return
    setConfirmAction({ type: 'deleteSong', songId, songTitle: song.title })
  }

  const handleSaveDay = () => {
    const day = parseDay(settingsDayInput)
    if (day === null) {
      setSettingsError('請輸入大於 0 的整數天數')
      setSettingsMessage('')
      return
    }
    updateData({ ...data, currentDay: day })
    setSettingsError('')
    setSettingsMessage('目前天數已更新')
  }

  const handleResetDayRequest = () => {
    setConfirmAction({ type: 'resetDay' })
  }

  const handleResetInitRequest = () => {
    setConfirmAction({ type: 'resetInit' })
  }

  const handleClearAllRequest = () => {
    setConfirmAction({ type: 'clearAll' })
  }

  const handleGoogleSignIn = async () => {
    setSettingsError('')
    setSettingsMessage('')
    try {
      await signInWithGoogle()
    } catch {
      setSettingsError('Google 登入失敗，請稍後再試')
    }
  }

  const handleGithubSignIn = async () => {
    setSettingsError('')
    setSettingsMessage('')
    try {
      await signInWithGithub()
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : ''

      if (code === 'auth/account-exists-with-different-credential') {
        setSettingsError('此電子郵件已用其他方式登入過，請先用原本方式登入，再到設定連結 GitHub')
      } else {
        setSettingsError('GitHub 登入失敗，請稍後再試')
      }
    }
  }

  const handleGithubLink = async () => {
    if (!user) return
    setSettingsError('')
    setSettingsMessage('')
    try {
      const result = await linkGithubAccount(user)
      setUser(result.user)
      setSettingsMessage('GitHub 帳號已連結，之後可以直接使用 GitHub 登入')
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : ''

      if (code === 'auth/provider-already-linked') {
        setSettingsMessage('GitHub 帳號已經連結')
      } else if (code === 'auth/credential-already-in-use') {
        setSettingsError('這個 GitHub 帳號已連結到其他帳號')
      } else {
        setSettingsError('GitHub 帳號連結失敗，請稍後再試')
      }
    }
  }

  const handleSignOutRequest = () => {
    setConfirmAction({ type: 'signOut' })
  }

  const handleSignOut = async () => {
    setSettingsError('')
    setSettingsMessage('')
    try {
      await signOutUser()
      setSettingsMessage('已登出，目前使用本機資料')
    } catch {
      setSettingsError('登出失敗，請稍後再試')
    }
  }

  const handleConfirmCancel = () => {
    setConfirmAction(null)
  }

  const handleConfirmAction = () => {
    if (!confirmAction) return

    switch (confirmAction.type) {
      case 'deleteSong':
        updateData({ ...data, songs: data.songs.filter((s) => s.id !== confirmAction.songId) })
        setSelectedSongId(null)
        setView('history')
        break
      case 'resetDay':
        updateData({ ...data, currentDay: 1 })
        setSettingsDayInput('1')
        setSettingsError('')
        setSettingsMessage('天數已重置為 1')
        break
      case 'resetInit': {
        const next: ArchiveData = { ...data, initialized: false }
        updateData(next)
        setInitDayInput(String(data.currentDay))
        setInitError('')
        setSettingsMessage('')
        setSettingsError('')
        setView('init')
        break
      }
      case 'importData': {
        const validated = confirmAction.data
        updateData(validated)
        setSettingsDayInput(String(validated.currentDay))
        setInitDayInput(String(validated.currentDay))
        setInitError('')
        setFormError('')
        setSettingsError('')
        setSettingsMessage('資料已成功匯入')
        setView(validated.initialized ? 'home' : 'init')
        break
      }
      case 'clearAll': {
        const next = defaultData()
        clearStorage()
        dataRef.current = next
        setData(next)
        if (user) {
          setSyncStatus('syncing')
          void saveCloudArchive(user, next)
            .then(() => setSyncStatus('synced'))
            .catch(() => setSyncStatus('error'))
        }
        setInitDayInput('1')
        setSettingsDayInput('1')
        resetSongForm()
        setSearchTitle('')
        setSearchArtist('')
        setSortOption('date-desc')
        setSelectedSongId(null)
        setInitError('')
        setSettingsError('')
        setSettingsMessage('')
        setInitMessage('所有資料已清除')
        setView('init')
        break
      }
      case 'signOut':
        handleSignOut()
        break
    }

    setConfirmAction(null)
  }

  const handleExport = () => {
    downloadBackup(data)
    setSettingsError('')
    setSettingsMessage('資料已匯出')
  }

  const handleImportClick = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    let parsed: unknown
    try {
      const text = await file.text()
      parsed = JSON.parse(text)
    } catch {
      setSettingsError('備份檔格式錯誤')
      setSettingsMessage('')
      return
    }

    const validated = parseArchiveData(parsed)
    if (!validated) {
      setSettingsError('備份檔格式錯誤')
      setSettingsMessage('')
      return
    }

    setConfirmAction({ type: 'importData', data: validated })
  }

  const confirmOverlay = confirmAction ? (
    <ConfirmModal
      action={confirmAction}
      onCancel={handleConfirmCancel}
      onConfirm={handleConfirmAction}
    />
  ) : null

  const renderShell = (_title: string, children: React.ReactNode) => (
    <Shell 
      activeView={activeView} 
      onViewChange={(v) => {
        if (v === 'settings') {
          setSettingsDayInput(String(data.currentDay))
          setSettingsError('')
          setSettingsMessage('')
        }
        setView(v)
      }} 
      overlay={confirmOverlay} 
      theme={theme}
    >
      {children}
    </Shell>
  )

  const renderSongForm = (mode: 'add' | 'edit') => (
    <form
      className="sa-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (mode === 'add') handleAddSong()
        else handleEditSong()
      }}
    >
      <div className="sa-field">
        <label className="sa-label" htmlFor="song-title">
          歌名
        </label>
        <input
          id="song-title"
          className="sa-input"
          type="text"
          placeholder="輸入歌名"
          value={songTitle}
          onChange={(e) => {
            setSongTitle(e.target.value)
            setFormError('')
          }}
        />
      </div>
      <div className="sa-field">
        <label className="sa-label" htmlFor="song-artist">
          歌手
        </label>
        <input
          id="song-artist"
          className="sa-input"
          type="text"
          placeholder="輸入歌手"
          value={songArtist}
          onChange={(e) => {
            setSongArtist(e.target.value)
            setFormError('')
          }}
        />
      </div>
      <div className="sa-field">
        <label className="sa-label" htmlFor="song-link">
          連結（選填）
        </label>
        <input
          id="song-link"
          className="sa-input"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={songLink}
          onChange={(e) => setSongLink(e.target.value)}
        />
      </div>
      <div className="sa-field">
        <label className="sa-label" htmlFor="song-note">
          備註（選填）
        </label>
        <textarea
          id="song-note"
          className="sa-textarea"
          placeholder="輸入備註"
          value={songNote}
          onChange={(e) => setSongNote(e.target.value)}
        />
      </div>
      {mode === 'add' && (
        <p className="sa-subtitle" style={{ textAlign: 'center' }}>
          將記錄為第 {data.currentDay} 天
        </p>
      )}
      {formError && <p className="sa-error">{formError}</p>}
      <button type="submit" className="sa-btn">
        {mode === 'add' ? '儲存' : '儲存變更'}
      </button>
      <button
        type="button"
        className="sa-btn sa-btn-ghost"
        onClick={() => setView(mode === 'add' ? 'home' : 'detail')}
      >
        取消
      </button>
    </form>
  )

  if (activeView === 'init') {
    return renderShell(
      `系統初始化 · ${VERSION}`,
      <main className="sa-main">
        <header className="sa-header">
          <p className="sa-badge">系統初始化</p>
          <h1 className="sa-title">Song Archive</h1>
          <p className="sa-version">{VERSION}</p>
          <p className="sa-subtitle sa-page-copy">
            歡迎使用個人歌曲分享管理器，您可以先設定起始天數，或使用 Google / GitHub 登入同步雲端資料。
          </p>
        </header>
        <div className="sa-divider" aria-hidden="true" />
        <form
          className="sa-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleInit()
          }}
        >
          <div className="sa-field">
            <label className="sa-label" htmlFor="init-day">
              目前天數
            </label>
            <input
              id="init-day"
              className="sa-input"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="例如：171"
              value={initDayInput}
              onChange={(e) => {
                setInitDayInput(e.target.value)
                setInitError('')
                setInitMessage('')
              }}
            />
          </div>
          {initError && <p className="sa-error">{initError}</p>}
          {initMessage && <p className="sa-success">{initMessage}</p>}
          <button type="submit" className="sa-btn">
            開始使用
          </button>
        </form>

        <div className="sa-divider" aria-hidden="true" />

        <div className="sa-init-sync">
          <p className="sa-section-title">已有雲端備份？</p>
          <p className="sa-subtitle">登入後會自動讀取同一個帳號的雲端資料。</p>
          <div className="sa-actions sa-auth-actions">
            <button
              type="button"
              className="sa-btn"
              onClick={handleGoogleSignIn}
              disabled={!authReady || syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? '同步中...' : '透過 Google 登入同步'}
            </button>
            <button
              type="button"
              className="sa-btn sa-btn-ghost"
              onClick={handleGithubSignIn}
              disabled={!authReady || syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? '同步中...' : '透過 GitHub 登入同步'}
            </button>
          </div>
        </div>
      </main>,
    )
  }

  if (activeView === 'add') {
    return renderShell(
      `新增歌曲 · ${VERSION}`,
      <main className="sa-main">
          <header className="sa-header">
            <p className="sa-badge">資料錄入</p>
            <h1 className="sa-title">新增歌曲</h1>
          </header>
          <div className="sa-divider" aria-hidden="true" />
          {renderSongForm('add')}
        </main>,
    )
  }

  if (activeView === 'edit' && selectedSong && selectedSongId) {
    return renderShell(
      `編輯歌曲 · ${VERSION}`,
      <main className="sa-main">
          <header className="sa-header">
            <p className="sa-badge">資料編輯</p>
            <h1 className="sa-title">編輯歌曲</h1>
          </header>
          <div className="sa-divider" aria-hidden="true" />
          {renderSongForm('edit')}
        </main>,
    )
  }

  if (activeView === 'detail' && selectedSong) {
    return renderShell(
      `歌曲詳情 · ${VERSION}`,
      <main className="sa-main">
          <header className="sa-header">
            <p className="sa-badge">詳細資料</p>
            <h1 className="sa-title">{selectedSong.title}</h1>
          </header>
          <div className="sa-divider" aria-hidden="true" />
          <dl className="sa-detail-card">
            <div className="sa-detail-row">
              <dt>天數</dt>
              <dd>第 {selectedSong.day} 天</dd>
            </div>
            <div className="sa-detail-row">
              <dt>歌手</dt>
              <dd>{selectedSong.artist}</dd>
            </div>
            <div className="sa-detail-row">
              <dt>建立日期</dt>
              <dd>{formatDisplayDate(selectedSong.createdAt)}</dd>
            </div>
            {selectedSong.updatedAt && (
              <div className="sa-detail-row">
                <dt>最後更新</dt>
                <dd>{formatDisplayDate(selectedSong.updatedAt)}</dd>
              </div>
            )}
            {selectedSong.link && (
              <div className="sa-detail-row">
                <dt>連結</dt>
                <dd>
                  <a
                    className="sa-detail-link"
                    href={selectedSong.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {selectedSong.link}
                  </a>
                </dd>
              </div>
            )}
            {selectedSong.note && (
              <div className="sa-detail-row">
                <dt>備註</dt>
                <dd>{selectedSong.note}</dd>
              </div>
            )}
          </dl>
          <div className="sa-actions">
            <button type="button" className="sa-btn" onClick={() => openEditSong(selectedSong)}>
              編輯歌曲
            </button>
            <button
              type="button"
              className="sa-btn sa-btn-danger"
              onClick={() => handleDeleteSongRequest(selectedSong.id)}
            >
              刪除歌曲
            </button>
            <button type="button" className="sa-btn sa-btn-ghost" onClick={() => setView('history')}>
              返回歷史紀錄
            </button>
          </div>
        </main>,
    )
  }

  if (activeView === 'history') {
    return renderShell(
      `歷史紀錄 · ${VERSION}`,
      <main className="sa-main sa-history-page">
        <div className="sa-history-topbar">
          <button type="button" className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => setView('home')}>
            ← 首頁
          </button>
          <header className="sa-history-heading">
            <h1 className="sa-title">歷史紀錄</h1>
            <p className="sa-subtitle">共 {data.songs.length} 首歌曲</p>
          </header>
        </div>

        <div className="sa-divider" aria-hidden="true" />

        <div className="sa-filters">
          <div className="sa-field">
            <input
              className="sa-input"
              type="search"
              placeholder="搜尋歌名..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
            />
          </div>
          <div className="sa-field">
            <input
              className="sa-input"
              type="search"
              placeholder="搜尋歌手..."
              value={searchArtist}
              onChange={(e) => setSearchArtist(e.target.value)}
            />
          </div>
          <div className="sa-field">
            <select
              className="sa-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="排序方式"
            >
              <option value="date-desc">日期（新→舊）</option>
              <option value="date-asc">日期（舊→新）</option>
              <option value="day-desc">天數（高→低）</option>
              <option value="day-asc">天數（低→高）</option>
            </select>
          </div>
        </div>

        <div className="sa-history-scroll">
          {filteredSongs.length === 0 ? (
            <p className="sa-empty">
              {data.songs.length === 0 ? '尚無紀錄。' : '找不到符合條件的歌曲。'}
            </p>
          ) : (
            <ul className="sa-history-list">
              {filteredSongs.map((song) => (
                <li key={song.id} className="sa-history-item">
                  <button
                    type="button"
                    className="sa-history-btn"
                    onClick={() => openSongDetail(song.id)}
                  >
                    <strong>{song.title}</strong>
                    <span>第 {song.day} 天 · {song.artist}</span>
                    <span className="sa-history-date">{formatDisplayDate(song.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>,
    )
  }

  if (activeView === 'settings') {
    const linkedProviderIds = user?.providerData.map((provider) => provider.providerId) ?? []
    const isGithubLinked = linkedProviderIds.includes('github.com')
    const linkedProviderLabel =
      linkedProviderIds
        .map((providerId) =>
          providerId === 'google.com'
            ? 'Google'
            : providerId === 'github.com'
              ? 'GitHub'
              : providerId,
        )
        .join('、') || '尚未連結登入方式'
    const syncLabel = !authReady
      ? '正在確認登入狀態'
      : syncStatus === 'syncing'
        ? '正在同步'
        : syncStatus === 'synced'
          ? '雲端資料已同步'
          : syncStatus === 'error'
            ? '同步失敗'
            : '資料僅保存在此裝置'

    const handleThemeChange = (newTheme: Theme) => {
      setTheme(newTheme)
      saveTheme(newTheme)
    }

    return renderShell(
      `系統設定 · ${VERSION}`,
      <main className="sa-main">
          <header className="sa-header">
            <p className="sa-badge">系統設定</p>
            <h1 className="sa-title">設定</h1>
          </header>
          <div className="sa-divider" aria-hidden="true" />
          <div className="sa-settings-group">
            <p className="sa-section-title">外觀主題</p>
            <div className="sa-actions-row">
              <button
                type="button"
                className={`sa-btn sa-btn-sm${theme === 'light' ? '' : ' sa-btn-ghost'}`}
                onClick={() => handleThemeChange('light')}
              >
                淺色模式
              </button>
              <button
                type="button"
                className={`sa-btn sa-btn-sm${theme === 'dark' ? '' : ' sa-btn-ghost'}`}
                onClick={() => handleThemeChange('dark')}
              >
                深色模式
              </button>
            </div>
            <button
              type="button"
              className={`sa-btn sa-btn-sm${theme === 'system' ? '' : ' sa-btn-ghost'}`}
              onClick={() => handleThemeChange('system')}
            >
              跟隨系統
            </button>
          </div>
          <div className="sa-divider" aria-hidden="true" />
          <div className="sa-settings-group">
            <p className="sa-section-title">帳號與同步</p>
            <div className="sa-account">
              <strong>{user ? user.displayName || '已登入使用者' : '尚未登入'}</strong>
              <span>{user?.email ?? syncLabel}</span>
              {user && <span>已連結：{linkedProviderLabel}</span>}
              {user && <span>{syncLabel}</span>}
            </div>
            {user ? (
              <div className="sa-actions sa-auth-actions">
                {!isGithubLinked && (
                  <button
                    type="button"
                    className="sa-btn"
                    onClick={handleGithubLink}
                    disabled={!authReady || syncStatus === 'syncing'}
                  >
                    連結 GitHub 帳號
                  </button>
                )}
                <button type="button" className="sa-btn sa-btn-ghost" onClick={handleSignOutRequest}>
                  登出帳號
                </button>
              </div>
            ) : (
              <div className="sa-actions sa-auth-actions">
                <button
                  type="button"
                  className="sa-btn"
                  onClick={handleGoogleSignIn}
                  disabled={!authReady || syncStatus === 'syncing'}
                >
                  使用 Google 登入
                </button>
                <button
                  type="button"
                  className="sa-btn sa-btn-ghost"
                  onClick={handleGithubSignIn}
                  disabled={!authReady || syncStatus === 'syncing'}
                >
                  使用 GitHub 登入
                </button>
              </div>
            )}
          </div>
          <div className="sa-divider" aria-hidden="true" />
          <div className="sa-settings-group">
            <p className="sa-section-title">資料統計</p>
            <div className="sa-meta">
              <div className="sa-meta-row">
                <p>總歌曲數</p>
                <span>{data.songs.length} 首</span>
              </div>
              <div className="sa-meta-row">
                <p>目前天數</p>
                <span>第 {data.currentDay} 天</span>
              </div>
              <div className="sa-meta-row">
                <p>建立日期</p>
                <span>{formatDisplayDate(data.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="sa-divider" aria-hidden="true" />
          <div className="sa-settings-group">
            <p className="sa-section-title">天數管理</p>
            <form
              className="sa-form"
              onSubmit={(e) => {
                e.preventDefault()
                handleSaveDay()
              }}
            >
              <div className="sa-field">
                <label className="sa-label" htmlFor="settings-day">
                  修改目前天數
                </label>
                <input
                  id="settings-day"
                  className="sa-input"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={settingsDayInput}
                  onChange={(e) => {
                    setSettingsDayInput(e.target.value)
                    setSettingsError('')
                    setSettingsMessage('')
                  }}
                />
              </div>
              {settingsError && <p className="sa-error">{settingsError}</p>}
              {settingsMessage && <p className="sa-success">{settingsMessage}</p>}
              <button type="submit" className="sa-btn">
                儲存天數
              </button>
              <button type="button" className="sa-btn sa-btn-ghost" onClick={handleResetDayRequest}>
                重置天數
              </button>
            </form>
          </div>
          <div className="sa-divider" aria-hidden="true" />
          <div className="sa-settings-group">
            <p className="sa-section-title">資料備份與還原</p>
            <div className="sa-actions">
              <button type="button" className="sa-btn" onClick={handleExport}>
                匯出資料
              </button>
              <button type="button" className="sa-btn" onClick={handleImportClick}>
                匯入資料
              </button>
              <input
                ref={importInputRef}
                className="sa-file-input"
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
          </div>
          <div className="sa-divider" aria-hidden="true" />
          <div className="sa-settings-group">
            <p className="sa-section-title">資料管理</p>
            <div className="sa-actions">
              <button type="button" className="sa-btn" onClick={handleResetInitRequest}>
                重置初始化設定
              </button>
              <button type="button" className="sa-btn sa-btn-danger" onClick={handleClearAllRequest}>
                清除所有資料
              </button>
            </div>
          </div>
          <button type="button" className="sa-btn sa-btn-ghost" onClick={() => setView('home')}>
            返回首頁
          </button>
        </main>,
    )
  }

  return renderShell(
    `系統運行中 · ${VERSION}`,
    <main className="sa-main sa-home-page">
        <header className="sa-header sa-home-header">
          <p className="sa-badge">個人歌曲管理</p>
          <h1 className="sa-title">Song Archive</h1>
          <p className="sa-version">{VERSION}</p>
        </header>
        <div className="sa-card-grid sa-home-stats">
          <div className="sa-stat-card">
            <p>目前天數</p>
            <span>第 {data.currentDay} 天</span>
          </div>
          <div className="sa-stat-card">
            <p>總歌曲數</p>
            <span>{data.songs.length} 首</span>
          </div>
        </div>
        <>
            <div className="sa-divider" aria-hidden="true" />
            <div className="sa-home-recent">
              <div className="sa-home-recent-heading">
                <p className="sa-section-title">最近新增</p>
                {recentSongs.length > 0 && <span className="sa-version">{recentSongs.length} 筆</span>}
              </div>
              {recentSongs.length > 0 ? (
                <ul className="sa-recent-list sa-home-recent-list">
                {recentSongs.map((song) => (
                  <li key={song.id} className="sa-recent-item">
                    <strong>{song.title}</strong>
                    <span>
                      {song.artist} · 第 {song.day} 天
                    </span>
                  </li>
                ))}
                </ul>
              ) : (
                <p className="sa-empty sa-home-empty">尚無新增歌曲</p>
              )}
            </div>
        </>
      </main>,
  )
}

export default App

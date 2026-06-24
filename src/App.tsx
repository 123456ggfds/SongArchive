import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  auth,
  loadCloudArchive,
  saveCloudArchive,
  signInWithGoogle,
  signOutUser,
} from './firebase'

const VERSION = '26.11.6b'
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
  .sa-root {
    /* Default Dark Theme Variables */
    --sa-bg-deep: #050a14;
    --sa-bg-mid: #0a1628;
    --sa-bg-card: #0d1f3c;
    --sa-cyan: #38bdf8;
    --sa-cyan-dim: rgba(56, 189, 248, 0.15);
    --sa-cyan-glow: rgba(56, 189, 248, 0.45);
    --sa-text: #94a3b8;
    --sa-text-bright: #e2e8f0;
    --sa-border: rgba(56, 189, 248, 0.25);
    --sa-danger: #f87171;
    --sa-danger-dim: rgba(248, 113, 113, 0.15);
    --sa-touch: 2.75rem;
    --sa-gradient-top: rgba(30, 74, 138, 0.55);
    --sa-gradient-bottom: rgba(14, 116, 144, 0.2);
    --sa-scanline-opacity: 0.03;
    --sa-grid-opacity: 0.35;
    --sa-modal-bg: rgba(5, 10, 20, 0.8);

    min-height: 100dvh;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 1.25rem 1rem 2rem;
    padding-top: max(1.25rem, env(safe-area-inset-top));
    padding-bottom: max(2rem, env(safe-area-inset-bottom));
    padding-left: max(1rem, env(safe-area-inset-left));
    padding-right: max(1rem, env(safe-area-inset-right));
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, var(--sa-gradient-top), transparent),
      radial-gradient(ellipse 60% 40% at 100% 100%, var(--sa-gradient-bottom), transparent),
      linear-gradient(180deg, var(--sa-bg-deep) 0%, var(--sa-bg-mid) 50%, var(--sa-bg-deep) 100%);
    color: var(--sa-text);
    font-family: system-ui, 'Segoe UI', 'Microsoft JhengHei', sans-serif;
    position: relative;
    overflow-x: hidden;
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  .sa-root *,
  .sa-root *::before,
  .sa-root *::after {
    box-sizing: border-box;
  }

  .sa-grid {
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(var(--sa-border) 1px, transparent 1px),
      linear-gradient(90deg, var(--sa-border) 1px, transparent 1px);
    background-size: 2rem 2rem;
    mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%);
    pointer-events: none;
    opacity: var(--sa-grid-opacity);
  }

  .sa-scanline {
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, var(--sa-scanline-opacity)) 2px,
      rgba(0, 0, 0, var(--sa-scanline-opacity)) 4px
    );
    pointer-events: none;
  }

  .sa-main {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 28rem;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1.25rem;
    margin: auto 0;
  }

  .sa-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
  }

  .sa-badge {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    color: var(--sa-cyan);
    border: 1px solid var(--sa-border);
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    background: var(--sa-cyan-dim);
    box-shadow: 0 0 12px var(--sa-cyan-dim);
  }

  .sa-title {
    margin: 0;
    font-size: 1.65rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--sa-text-bright);
    text-shadow: 0 0 24px var(--sa-cyan-glow);
    line-height: 1.25;
  }

  .sa-version {
    margin: 0;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.85rem;
    color: var(--sa-cyan);
  }

  .sa-subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: var(--sa-text);
    line-height: 1.5;
  }

  .sa-card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
    width: 100%;
  }

  .sa-stat-card {
    padding: 0.85rem;
    background: rgba(13, 31, 60, 0.65);
    border: 1px solid var(--sa-border);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    box-shadow: 0 0 16px rgba(56, 189, 248, 0.06);
  }

  .sa-stat-card p {
    margin: 0;
    font-size: 0.75rem;
    color: var(--sa-text);
  }

  .sa-stat-card span {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--sa-cyan);
  }

  .sa-meta {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
  }

  .sa-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.65rem 0.85rem;
    background: rgba(13, 31, 60, 0.5);
    border: 1px solid var(--sa-border);
    border-radius: 6px;
  }

  .sa-meta-row p {
    margin: 0;
    font-size: 0.85rem;
  }

  .sa-meta-row span {
    color: var(--sa-cyan);
    font-weight: 600;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.85rem;
  }

  .sa-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--sa-cyan-glow), transparent);
  }

  .sa-section-title {
    margin: 0;
    font-size: 0.8rem;
    font-family: ui-monospace, Consolas, monospace;
    letter-spacing: 0.08em;
    color: var(--sa-cyan);
  }

  .sa-recent-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .sa-recent-item {
    padding: 0.75rem 0.85rem;
    background: rgba(13, 31, 60, 0.55);
    border: 1px solid var(--sa-border);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .sa-recent-item strong {
    color: var(--sa-text-bright);
    font-size: 0.9rem;
  }

  .sa-recent-item span {
    font-size: 0.75rem;
    color: var(--sa-text);
  }

  .sa-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .sa-actions-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }

  .sa-btn {
    width: 100%;
    min-height: var(--sa-touch);
    padding: 0.85rem 1.15rem;
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--sa-text-bright);
    background: linear-gradient(135deg, var(--sa-bg-card) 0%, rgba(13, 31, 60, 0.8) 100%);
    border: 1px solid var(--sa-border);
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    text-align: center;
    -webkit-appearance: none;
    appearance: none;
  }

  .sa-btn::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--sa-cyan);
    opacity: 0.6;
    transition: opacity 0.2s, box-shadow 0.2s;
  }

  .sa-btn:hover:not(:disabled) {
    border-color: var(--sa-cyan-glow);
    box-shadow: 0 0 20px var(--sa-cyan-dim), inset 0 0 20px rgba(56, 189, 248, 0.05);
  }

  .sa-btn:hover:not(:disabled)::before {
    opacity: 1;
    box-shadow: 0 0 8px var(--sa-cyan);
  }

  .sa-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .sa-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sa-btn:focus-visible {
    outline: 2px solid var(--sa-cyan);
    outline-offset: 2px;
  }

  .sa-btn-danger {
    color: #fecaca;
    border-color: rgba(248, 113, 113, 0.35);
    background: linear-gradient(135deg, rgba(60, 13, 13, 0.6) 0%, rgba(30, 10, 10, 0.8) 100%);
  }

  .sa-btn-danger::before {
    background: var(--sa-danger);
  }

  .sa-btn-danger:hover:not(:disabled) {
    border-color: rgba(248, 113, 113, 0.6);
    box-shadow: 0 0 20px var(--sa-danger-dim);
  }

  .sa-btn-ghost {
    background: transparent;
    font-size: 0.85rem;
    min-height: 2.5rem;
    padding: 0.6rem 1rem;
  }

  .sa-btn-ghost::before {
    display: none;
  }

  .sa-btn-sm {
    min-height: 2.5rem;
    padding: 0.6rem 0.85rem;
    font-size: 0.85rem;
  }

  .sa-footer {
    position: relative;
    z-index: 1;
    margin-top: 1.5rem;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: rgba(148, 163, 184, 0.4);
    text-align: center;
  }

  .sa-form {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    width: 100%;
  }

  .sa-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .sa-label {
    font-size: 0.8rem;
    font-family: ui-monospace, Consolas, monospace;
    color: var(--sa-cyan);
    letter-spacing: 0.04em;
  }

  .sa-input,
  .sa-select,
  .sa-textarea {
    width: 100%;
    padding: 0.75rem 0.9rem;
    font-size: 1rem;
    color: var(--sa-text-bright);
    background: rgba(5, 10, 20, 0.6);
    border: 1px solid var(--sa-border);
    border-radius: 6px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: inherit;
    -webkit-appearance: none;
    appearance: none;
  }

  .sa-textarea {
    min-height: 5rem;
    resize: vertical;
    line-height: 1.5;
  }

  .sa-input:focus,
  .sa-select:focus,
  .sa-textarea:focus {
    border-color: var(--sa-cyan-glow);
    box-shadow: 0 0 12px var(--sa-cyan-dim);
  }

  .sa-input::placeholder,
  .sa-textarea::placeholder {
    color: rgba(148, 163, 184, 0.45);
  }

  .sa-select {
    cursor: pointer;
    min-height: var(--sa-touch);
  }

  .sa-error {
    margin: 0;
    font-size: 0.8rem;
    color: var(--sa-danger);
    text-align: center;
  }

  .sa-success {
    margin: 0;
    font-size: 0.8rem;
    color: var(--sa-cyan);
    text-align: center;
  }

  .sa-history-list {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 32rem;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .sa-history-item {
    padding: 0;
    background: rgba(13, 31, 60, 0.6);
    border: 1px solid var(--sa-border);
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .sa-history-item:active {
    transform: scale(0.97);
    background: rgba(13, 31, 60, 0.8);
  }

  .sa-history-btn {
    width: 100%;
    padding: 1.25rem 1.15rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    color: inherit;
    font-family: inherit;
    min-height: 4.5rem;
  }

  .sa-history-btn strong {
    color: var(--sa-text-bright);
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.3;
    word-break: break-word;
    letter-spacing: 0.01em;
  }

  .sa-history-btn span {
    font-size: 0.85rem;
    font-family: ui-monospace, Consolas, monospace;
    color: var(--sa-text);
    line-height: 1.5;
    display: block;
    opacity: 0.9;
  }

  .sa-empty {
    margin: 0;
    text-align: center;
    font-size: 0.85rem;
    color: rgba(148, 163, 184, 0.6);
    padding: 1.25rem 0;
  }

  .sa-settings-group {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .sa-account {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.85rem;
    background: rgba(13, 31, 60, 0.5);
    border: 1px solid var(--sa-border);
    border-radius: 6px;
  }

  .sa-account strong {
    color: var(--sa-text-bright);
    font-size: 0.9rem;
  }

  .sa-account span {
    font-size: 0.75rem;
    color: var(--sa-text);
    word-break: break-word;
  }

  .sa-file-input {
    display: none;
  }

  .sa-detail-card {
    padding: 1rem;
    background: rgba(13, 31, 60, 0.55);
    border: 1px solid var(--sa-border);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .sa-detail-row {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .sa-detail-row dt {
    margin: 0;
    font-size: 0.7rem;
    font-family: ui-monospace, Consolas, monospace;
    color: var(--sa-cyan);
    letter-spacing: 0.06em;
  }

  .sa-detail-row dd {
    margin: 0;
    font-size: 0.9rem;
    color: var(--sa-text-bright);
    word-break: break-word;
  }

  .sa-detail-link {
    color: var(--sa-cyan);
    text-decoration: none;
  }

  .sa-detail-link:hover {
    text-decoration: underline;
  }

  .sa-filters {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    width: 100%;
  }

  .sa-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    padding-top: max(1.25rem, env(safe-area-inset-top));
    padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
    padding-left: max(1.25rem, env(safe-area-inset-left));
    padding-right: max(1.25rem, env(safe-area-inset-right));
    background: var(--sa-modal-bg);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .sa-modal {
    width: 100%;
    max-width: 22rem;
    padding: 1.25rem;
    background: linear-gradient(135deg, var(--sa-bg-card) 0%, rgba(13, 31, 60, 0.98) 100%);
    border: 1px solid var(--sa-border);
    border-radius: 8px;
    box-shadow: 0 0 32px rgba(56, 189, 248, 0.15);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sa-modal-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--sa-text-bright);
    text-align: center;
  }

  .sa-modal-text {
    margin: 0;
    font-size: 0.85rem;
    color: var(--sa-text);
    line-height: 1.65;
    text-align: center;
  }

  .sa-modal-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }

  .sa-modal-actions .sa-btn::before {
    display: none;
  }

  @media (min-width: 480px) {
    .sa-root {
      padding: 1.5rem;
      justify-content: center;
    }

    .sa-main {
      gap: 1.5rem;
    }

    .sa-title {
      font-size: 1.85rem;
    }
  }

  @media (min-width: 768px) {
    .sa-main {
      max-width: 32rem;
    }

    .sa-card-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .sa-filters {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.65rem;
    }
  }

  /* Light Theme Overrides */
  .sa-root.light {
    --sa-bg-deep: #f8fafc;
    --sa-bg-mid: #f1f5f9;
    --sa-bg-card: #ffffff;
    --sa-cyan: #0284c7;
    --sa-cyan-dim: rgba(2, 132, 199, 0.1);
    --sa-cyan-glow: rgba(2, 132, 199, 0.3);
    --sa-text: #475569;
    --sa-text-bright: #0f172a;
    --sa-border: rgba(2, 132, 199, 0.15);
    --sa-danger: #dc2626;
    --sa-danger-dim: rgba(220, 38, 38, 0.1);
    --sa-gradient-top: rgba(186, 230, 253, 0.4);
    --sa-gradient-bottom: rgba(165, 243, 252, 0.2);
    --sa-scanline-opacity: 0.015;
    --sa-grid-opacity: 0.2;
    --sa-modal-bg: rgba(248, 250, 252, 0.85);
  }

  .sa-root.light .sa-stat-card,
  .sa-root.light .sa-meta-row,
  .sa-root.light .sa-recent-item,
  .sa-root.light .sa-history-item,
  .sa-root.light .sa-account,
  .sa-root.light .sa-detail-card {
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .sa-root.light .sa-input,
  .sa-root.light .sa-select,
  .sa-root.light .sa-textarea {
    background: #ffffff;
  }

  .sa-root.light .sa-btn {
    background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .sa-root.light .sa-btn-danger {
    background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
  }

  .sa-root.light .sa-btn-ghost {
    background: transparent;
    box-shadow: none;
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
  footer,
  overlay,
  theme,
}: {
  children: React.ReactNode
  footer?: string
  overlay?: React.ReactNode
  theme: Theme
}) {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = theme === 'system' ? systemTheme : theme

  return (
    <>
      <style>{styles}</style>
      <div className={`sa-root ${resolvedTheme}`}>
        <div className="sa-grid" aria-hidden="true" />
        <div className="sa-scanline" aria-hidden="true" />
        {children}
        {overlay}
        {footer && <footer className="sa-footer">{footer}</footer>}
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
            setView(cloudData.initialized ? 'home' : 'init')
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

  const openAddSong = () => {
    resetSongForm()
    setSelectedSongId(null)
    setView('add')
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

  const renderShell = (footer: string, children: React.ReactNode) => (
    <Shell footer={footer} overlay={confirmOverlay} theme={theme}>
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
          <p className="sa-subtitle">歡迎使用個人歌曲分享管理器，請先設定您的起始天數或登入同步資料。</p>
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

        <div className="sa-divider" aria-hidden="true" style={{ margin: '2rem 0' }} />

        <div style={{ textAlign: 'center' }}>
          <p className="sa-subtitle" style={{ marginBottom: '1rem' }}>已有雲端備份？</p>
          <button
            type="button"
            className="sa-btn sa-btn-ghost"
            onClick={handleGoogleSignIn}
            disabled={syncStatus === 'syncing'}
          >
            {syncStatus === 'syncing' ? '同步中...' : '透過 Google 登入同步'}
          </button>
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
      <main className="sa-main">
          <header className="sa-header">
            <p className="sa-badge">資料庫</p>
            <h1 className="sa-title">歷史紀錄</h1>
            <p className="sa-subtitle">共 {data.songs.length} 首歌曲</p>
          </header>
          <div className="sa-divider" aria-hidden="true" />
          <div className="sa-filters">
            <div className="sa-field">
              <label className="sa-label" htmlFor="search-title">
                搜尋歌名
              </label>
              <input
                id="search-title"
                className="sa-input"
                type="search"
                placeholder="輸入歌名關鍵字"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
              />
            </div>
            <div className="sa-field">
              <label className="sa-label" htmlFor="search-artist">
                搜尋歌手
              </label>
              <input
                id="search-artist"
                className="sa-input"
                type="search"
                placeholder="輸入歌手關鍵字"
                value={searchArtist}
                onChange={(e) => setSearchArtist(e.target.value)}
              />
            </div>
          </div>
          <div className="sa-field">
            <label className="sa-label" htmlFor="sort-option">
              排序方式
            </label>
            <select
              id="sort-option"
              className="sa-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
            >
              <option value="date-desc">依日期（新到舊）</option>
              <option value="date-asc">依日期（舊到新）</option>
              <option value="day-desc">依天數（高到低）</option>
              <option value="day-asc">依天數（低到高）</option>
            </select>
          </div>
          {filteredSongs.length === 0 ? (
            <p className="sa-empty">
              {data.songs.length === 0 ? '尚無收錄紀錄，請先新增歌曲。' : '找不到符合條件的歌曲。'}
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
                    <span>
                      第 {song.day} 天 · {song.artist} · {formatDisplayDate(song.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="sa-btn sa-btn-ghost" onClick={() => setView('home')}>
            返回首頁
          </button>
        </main>,
    )
  }

  if (activeView === 'settings') {
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
            <p className="sa-section-title">Google 帳號與同步</p>
            <div className="sa-account">
              <strong>{user ? user.displayName || 'Google 使用者' : '尚未登入'}</strong>
              <span>{user?.email ?? syncLabel}</span>
              {user && <span>{syncLabel}</span>}
            </div>
            {user ? (
              <button type="button" className="sa-btn sa-btn-ghost" onClick={handleSignOutRequest}>
                登出 Google 帳號
              </button>
            ) : (
              <button
                type="button"
                className="sa-btn"
                onClick={handleGoogleSignIn}
                disabled={!authReady}
              >
                使用 Google 登入
              </button>
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
    <main className="sa-main">
        <header className="sa-header">
          <p className="sa-badge">個人歌曲管理</p>
          <h1 className="sa-title">Song Archive</h1>
          <p className="sa-version">{VERSION}</p>
        </header>
        <div className="sa-card-grid">
          <div className="sa-stat-card">
            <p>目前天數</p>
            <span>第 {data.currentDay} 天</span>
          </div>
          <div className="sa-stat-card">
            <p>總歌曲數</p>
            <span>{data.songs.length} 首</span>
          </div>
        </div>
        {recentSongs.length > 0 && (
          <>
            <div className="sa-divider" aria-hidden="true" />
            <div>
              <p className="sa-section-title">最近新增</p>
              <ul className="sa-recent-list">
                {recentSongs.map((song) => (
                  <li key={song.id} className="sa-recent-item">
                    <strong>{song.title}</strong>
                    <span>
                      {song.artist} · 第 {song.day} 天
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <div className="sa-divider" aria-hidden="true" />
        <nav className="sa-actions" aria-label="主要功能">
          <button type="button" className="sa-btn" onClick={openAddSong}>
            新增歌曲
          </button>
          <button type="button" className="sa-btn" onClick={() => setView('history')}>
            歷史紀錄
          </button>
          <button
            type="button"
            className="sa-btn"
            onClick={() => {
              setSettingsDayInput(String(data.currentDay))
              setSettingsError('')
              setSettingsMessage('')
              setView('settings')
            }}
          >
            設定
          </button>
        </nav>
      </main>,
  )
}

export default App

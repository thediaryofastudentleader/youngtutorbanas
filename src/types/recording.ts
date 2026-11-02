export type RecordingItem = {
  id: string
  name: string
  createdAt: number
  duration: number
  size: number
  mimeType: string
  blob: Blob
  chunkCount?: number
  chunksAvailable?: boolean
  recovered?: boolean
}

export type ChunkSession = {
  id: string
  name: string
  createdAt: number
  mimeType: string
  totalBytes: number
  chunkCount: number
}

export type RecordingChunk = {
  sessionId: string
  sequence: number
  recordedAt: number
  blob: Blob
}

export type QualityPreset = {
  id: string
  label: string
  shortLabel: string
  width: number
  height: number
  fps: number
  videoBitsPerSecond: number
}

export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: 'full-hd-high',
    label: 'Full HD · High quality',
    shortLabel: '1080p / 12 Mbps',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitsPerSecond: 12_000_000,
  },
  {
    id: 'full-hd-standard',
    label: 'Full HD · Smaller file',
    shortLabel: '1080p / 8 Mbps',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitsPerSecond: 8_000_000,
  },
  {
    id: 'hd',
    label: 'HD · Easier upload',
    shortLabel: '720p / 5 Mbps',
    width: 1280,
    height: 720,
    fps: 30,
    videoBitsPerSecond: 5_000_000,
  },
]

export function formatBytes(bytes = 0, digits = 1) {
  if (!bytes) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index > 2 ? digits : 0)} ${units[index]}`
}

export function formatDuration(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const remainder = whole % 60
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

import { openDB, type DBSchema } from 'idb'
import fixWebmDuration from 'fix-webm-duration'
import type { ChunkSession, RecordingChunk, RecordingItem } from '../types/recording'

interface RecorderDatabase extends DBSchema {
  recordings: {
    key: string
    value: RecordingItem
    indexes: { 'by-date': number }
  }
  sessions: {
    key: string
    value: ChunkSession
  }
  chunks: {
    key: [string, number]
    value: RecordingChunk
    indexes: { 'by-session': string }
  }
}

const database = Promise.resolve().then(() => openDB<RecorderDatabase>('young-agripreneurs-recorder', 1, {
  upgrade(db) {
    const recordings = db.createObjectStore('recordings', { keyPath: 'id' })
    recordings.createIndex('by-date', 'createdAt')
    db.createObjectStore('sessions', { keyPath: 'id' })
    const chunks = db.createObjectStore('chunks', { keyPath: ['sessionId', 'sequence'] })
    chunks.createIndex('by-session', 'sessionId')
  },
}))

export async function listRecordings() {
  return (await (await database).getAllFromIndex('recordings', 'by-date')).reverse()
}

export async function createChunkSession(name: string, mimeType: string) {
  const session: ChunkSession = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    mimeType,
    totalBytes: 0,
    chunkCount: 0,
  }
  await (await database).put('sessions', session)
  return session
}

export async function appendRecordingChunk(sessionId: string, sequence: number, blob: Blob, recordedAt = Date.now()) {
  const db = await database
  const tx = db.transaction(['chunks', 'sessions'], 'readwrite')
  await tx.objectStore('chunks').put({ sessionId, sequence, recordedAt, blob })
  const session = await tx.objectStore('sessions').get(sessionId)
  if (session) {
    session.chunkCount += 1
    session.totalBytes += blob.size
    await tx.objectStore('sessions').put(session)
  }
  await tx.done
}

async function getSessionChunks(sessionId: string) {
  return (await database).getAllFromIndex('chunks', 'by-session', sessionId)
}

export async function finalizeChunkSession(session: ChunkSession, duration: number) {
  const chunks = await getSessionChunks(session.id)
  if (!chunks.length) throw new Error('No recorded media was received. Try a short test recording.')
  const assembled = new Blob(chunks.sort((a, b) => a.sequence - b.sequence).map((chunk) => chunk.blob), {
    type: session.mimeType,
  })
  const recoveredDuration = Math.max(
    0,
    ...chunks.map((chunk) => Number.isFinite(chunk.recordedAt)
      ? (chunk.recordedAt - session.createdAt) / 1000
      : 0),
  )
  const effectiveDuration = duration > 0 ? duration : recoveredDuration
  const blob = effectiveDuration > 0
    ? await fixWebmDuration(assembled, effectiveDuration * 1000, { logger: false })
    : assembled
  const recording: RecordingItem = {
    id: crypto.randomUUID(),
    name: session.name,
    createdAt: session.createdAt,
    duration: effectiveDuration,
    size: blob.size,
    mimeType: session.mimeType,
    blob,
  }
  const db = await database
  const tx = db.transaction(['recordings', 'sessions', 'chunks'], 'readwrite')
  await tx.objectStore('recordings').put(recording)
  await tx.objectStore('sessions').delete(session.id)
  let cursor = await tx.objectStore('chunks').index('by-session').openKeyCursor(IDBKeyRange.only(session.id))
  while (cursor) {
    await tx.objectStore('chunks').delete(cursor.primaryKey)
    cursor = await cursor.continue()
  }
  await tx.done
  return recording
}

export async function listInterruptedSessions() {
  const sessions = await (await database).getAll('sessions')
  return sessions.filter((session) => session.chunkCount > 0).sort((a, b) => b.createdAt - a.createdAt)
}

export async function recoverInterruptedSession(session: ChunkSession) {
  return finalizeChunkSession({ ...session, name: `${session.name} · recovered` }, 0)
}

export async function discardInterruptedSession(sessionId: string) {
  const db = await database
  const tx = db.transaction(['sessions', 'chunks'], 'readwrite')
  await tx.objectStore('sessions').delete(sessionId)
  let cursor = await tx.objectStore('chunks').index('by-session').openKeyCursor(IDBKeyRange.only(sessionId))
  while (cursor) {
    await tx.objectStore('chunks').delete(cursor.primaryKey)
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function deleteRecording(recordingId: string) {
  await (await database).delete('recordings', recordingId)
}

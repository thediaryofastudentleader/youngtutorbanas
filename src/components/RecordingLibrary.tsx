import { useEffect, useRef, useState } from 'react'
import { Download, Play, RotateCcw, Trash2, Video, X } from 'lucide-react'
import type { ChunkSession, RecordingItem } from '../types/recording'
import { formatBytes, formatDuration } from '../types/recording'

function RecordingRow({ item, onDelete }: { item: RecordingItem; onDelete: (id: string) => void }) {
  const [url] = useState(() => URL.createObjectURL(item.blob))
  const [previewing, setPreviewing] = useState(false)
  const revokeTimer = useRef(0)

  useEffect(() => {
    window.clearTimeout(revokeTimer.current)
    return () => {
      revokeTimer.current = window.setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }, [url])

  return (
    <article className="recording-row">
      <div className="recording-row__main">
        <div className="file-mark" aria-hidden="true"><Video size={20} /></div>
        <div>
          <h3>{item.name}</h3>
          <p>
            {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            <span aria-hidden="true"> · </span>{formatBytes(item.size)}<span aria-hidden="true"> · </span>
            {item.duration ? formatDuration(item.duration) : 'Recovered session'}
          </p>
        </div>
      </div>
      <div className="recording-row__actions">
        <button className="button button--quiet" onClick={() => setPreviewing((value) => !value)}>
          {previewing ? <X size={16} /> : <Play size={16} />}{previewing ? 'Close' : 'Preview'}
        </button>
        {url && (
          <a className="button button--dark" href={url} download={`${item.name.replace(/[^a-z0-9-_ ]/gi, '')}.webm`}>
            <Download size={16} />Download
          </a>
        )}
        <button
          className="icon-button icon-button--danger"
          aria-label={`Delete ${item.name}`}
          title="Delete recording"
          onClick={() => {
            if (window.confirm('Delete this browser copy? Make sure you downloaded or uploaded it first.')) onDelete(item.id)
          }}
        >
          <Trash2 size={17} />
        </button>
      </div>
      {previewing && url && <video className="recording-preview" src={url} controls playsInline />}
    </article>
  )
}

type LibraryProps = {
  recordings: RecordingItem[]
  interrupted: ChunkSession[]
  onDelete: (id: string) => void
  onRecover: (session: ChunkSession) => void
  recoveringId: string | null
  onDiscard: (id: string) => void
  onRecord: () => void
}

export default function RecordingLibrary({
  recordings,
  interrupted,
  onDelete,
  onRecover,
  recoveringId,
  onDiscard,
  onRecord,
}: LibraryProps) {
  return (
    <section className="workspace-panel" aria-labelledby="library-title">
      <header className="workspace-heading">
        <div>
          <p className="micro-label">LOCAL RECORDING LIBRARY</p>
          <h1 id="library-title">Verify before you share.</h1>
          <p>Play each lesson, check speech and ink, then download a copy before uploading to YouTube.</p>
        </div>
        <button className="button button--accent" onClick={onRecord}><Video size={17} />New recording</button>
      </header>

      <div className="local-notice">
        <strong>Browser-local storage.</strong> These files do not sync to another device. Clearing site data can remove them;
        downloading a WebM copy is the backup step.
      </div>

      {interrupted.length > 0 && (
        <div className="recovery-section">
          <p className="micro-label">RECOVERY AVAILABLE</p>
          <h2>An earlier session did not close cleanly.</h2>
          <p>Chunks already written by the browser can be assembled into a playable file. Review it carefully; the last few seconds may be missing.</p>
          {interrupted.map((session) => (
            <div className="recovery-row" key={session.id}>
              <span>{session.name}<small>{session.chunkCount} chunks · {formatBytes(session.totalBytes)}</small></span>
              <button
                className="button button--dark"
                disabled={recoveringId !== null}
                onClick={() => onRecover(session)}
              >
                <RotateCcw size={16} />{recoveringId === session.id ? 'Recovering…' : 'Recover'}
              </button>
              <button className="icon-button icon-button--danger" aria-label={`Discard ${session.name}`} onClick={() => onDiscard(session.id)}><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="library-list">
        <div className="section-line"><span>{recordings.length} {recordings.length === 1 ? 'recording' : 'recordings'}</span></div>
        {recordings.length === 0 ? (
          <div className="empty-state">
            <Video size={30} strokeWidth={1.4} />
            <h2>No finished lessons yet</h2>
            <p>Start with the sample deck and record 30 seconds. Your finished file will appear here.</p>
            <button className="button button--dark" onClick={onRecord}>Open recorder</button>
          </div>
        ) : recordings.map((item) => <RecordingRow key={item.id} item={item} onDelete={onDelete} />)}
      </div>
    </section>
  )
}

import { useRef, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileScan,
  FileUp,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react'
import type { useClassroom } from '@/hooks/useClassroom'
import { aiSetupHint, usingSupabaseAi } from '@/providers/trpc'

type Classroom = ReturnType<typeof useClassroom>

function DocumentCard({
  title,
  document,
  page,
  onPage,
  disabled,
}: {
  title: string
  document: Classroom['paper']
  page: number
  onPage: (page: number) => void
  disabled: boolean
}) {
  if (!document) return null
  return (
    <div className="document-card">
      <div className="document-card__title">
        {document.scanned ? <FileScan size={16} /> : <FileCheck2 size={16} />}
        <span><strong>{title}</strong><small title={document.name}>{document.name}</small></span>
      </div>
      <div className="document-card__meta">
        <span>{document.pageCount} {document.pageCount === 1 ? 'page' : 'pages'}</span>
        <span>{document.scanned ? 'Scan / image' : 'Text found'}</span>
      </div>
      {document.pageCount > 1 && (
        <div className="document-page-nav">
          <button className="icon-button" aria-label={`Previous ${title.toLowerCase()} page`} onClick={() => onPage(Math.max(0, page - 1))} disabled={disabled || page === 0}><ChevronLeft size={16} /></button>
          <span>Page {page + 1} / {document.pageCount}</span>
          <button className="icon-button" aria-label={`Next ${title.toLowerCase()} page`} onClick={() => onPage(Math.min(document.pageCount - 1, page + 1))} disabled={disabled || page >= document.pageCount - 1}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  )
}

export default function ClassroomSidebar({ classroom, disabled }: { classroom: Classroom; disabled: boolean }) {
  const paperInput = useRef<HTMLInputElement>(null)
  const memoInput = useRef<HTMLInputElement>(null)
  const [paperText, setPaperText] = useState('')
  const [memoText, setMemoText] = useState('')
  const accept = '.pdf,image/png,image/jpeg,image/webp'

  return (
    <>
      <div className="classroom-upload-grid">
        <input ref={paperInput} type="file" accept={accept} hidden onChange={(event) => { void classroom.uploadPaper(event.target.files?.[0] ?? null); event.target.value = '' }} />
        <button className="button button--dark button--full" onClick={() => paperInput.current?.click()} disabled={disabled || classroom.busy !== null}>
          {classroom.busy === 'upload-paper' ? <LoaderCircle size={16} className="spin" /> : <FileUp size={16} />}Upload question paper
        </button>
        <input ref={memoInput} type="file" accept={accept} hidden onChange={(event) => { void classroom.uploadMemo(event.target.files?.[0] ?? null); event.target.value = '' }} />
        <button className="button button--quiet button--full" onClick={() => memoInput.current?.click()} disabled={disabled || classroom.busy !== null}>
          {classroom.busy === 'upload-memo' ? <LoaderCircle size={16} className="spin" /> : <FileUp size={16} />}Upload memo separately
        </button>
      </div>
      <p className="field-help">PDF, PNG, JPG or WebP · maximum 25 MB each</p>
      <DocumentCard title="Question paper" document={classroom.paper} page={classroom.paperPage} onPage={classroom.setPaperPage} disabled={disabled} />
      <DocumentCard title="Memo" document={classroom.memo} page={classroom.memoPage} onPage={classroom.setMemoPage} disabled={disabled} />
      <div className={classroom.aiStatusError ? 'ai-connection is-error' : 'ai-connection'}>
        <Bot size={16} />
        <span>
          <strong>{classroom.aiStatus ? `${classroom.aiStatus.provider} connected` : classroom.aiStatusError ? 'DeepSeek not connected' : 'Checking secure AI…'}</strong>
          <small>{classroom.aiStatus ? (classroom.aiStatus.supportsImages ? 'Text + scanned-page reading' : 'Text reading · scan support depends on model') : classroom.aiStatusError ? aiSetupHint : usingSupabaseAi ? 'Contacting Supabase Edge Functions…' : 'Contacting the secure server…'}</small>
        </span>
        {!classroom.aiStatusError && <CheckCircle2 size={15} />}
      </div>
      <details className="paste-fallback">
        <summary>Upload failing? Paste text instead</summary>
        <label>Paper text<textarea value={paperText} onChange={(event) => setPaperText(event.target.value)} placeholder="Paste the question paper here…" rows={4} /></label>
        <button className="text-button" onClick={() => classroom.usePastedPaper(paperText)} disabled={disabled}>Use pasted paper</button>
        <label>Memo text<textarea value={memoText} onChange={(event) => setMemoText(event.target.value)} placeholder="Paste the memo here…" rows={4} /></label>
        <button className="text-button" onClick={() => classroom.usePastedMemo(memoText)} disabled={disabled}>Use pasted memo</button>
      </details>
      <button className="text-button sample-classroom" onClick={classroom.loadSample} disabled={disabled}><RotateCcw size={13} />Load classroom practice question</button>
    </>
  )
}

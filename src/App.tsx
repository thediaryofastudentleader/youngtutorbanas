import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileUp,
  GraduationCap,
  HardDrive,
  Highlighter,
  Leaf,
  Library,
  Mic2,
  MicOff,
  MonitorUp,
  Maximize2,
  Minimize2,
  Pause,
  Pen,
  Play,
  Presentation,
  ScreenShare,
  ShieldCheck,
  Square,
  Undo2,
  Video,
} from 'lucide-react'
import LessonCanvas, { type InkTool, type Stroke } from './components/LessonCanvas'
import ClassroomCanvas from './components/ClassroomCanvas'
import ClassroomSidebar from './components/ClassroomSidebar'
import ClassroomToolbar from './components/ClassroomToolbar'
import RecordingLibrary from './components/RecordingLibrary'
import SetupGuide from './components/SetupGuide'
import { useClassroom } from './hooks/useClassroom'
import { SAMPLE_SLIDES } from './lib/sampleSlides'
import {
  lessonFilename,
  openPdf,
  preferredMimeType,
  protectStorage,
  renderPdfPage,
  storageStatus,
  type PdfDocument,
} from './lib/media'
import {
  appendRecordingChunk,
  createChunkSession,
  deleteRecording,
  discardInterruptedSession,
  finalizeChunkSession,
  listInterruptedSessions,
  listRecordings,
  recoverInterruptedSession,
} from './lib/recordingStore'
import {
  QUALITY_PRESETS,
  formatBytes,
  formatDuration,
  type ChunkSession,
  type RecordingItem,
} from './types/recording'
import './App.css'

type View = 'studio' | 'library' | 'guide'
type SourceMode = 'classroom' | 'slides' | 'screen' | 'camera'
type RecordState = 'idle' | 'starting' | 'recording' | 'paused' | 'finalizing'
type StorageInfo = { usage: number; quota: number; persisted: boolean; supported: boolean }

export default function App() {
  const [view, setView] = useState<View>('studio')
  const [sourceMode, setSourceMode] = useState<SourceMode>('classroom')
  const [qualityId, setQualityId] = useState(QUALITY_PRESETS[0].id)
  const quality = QUALITY_PRESETS.find((preset) => preset.id === qualityId) ?? QUALITY_PRESETS[0]
  const [slideUrls, setSlideUrls] = useState<string[]>(SAMPLE_SLIDES)
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null)
  const [deckName, setDeckName] = useState('Sample agricultural sciences lesson')
  const [page, setPage] = useState(0)
  const [source, setSource] = useState<CanvasImageSource | null>(null)
  const [screenConnected, setScreenConnected] = useState(false)
  const [tool, setTool] = useState<InkTool>('pen')
  const [annotations, setAnnotations] = useState<Record<string, Stroke[]>>({})
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [waitingForMic, setWaitingForMic] = useState(false)
  const [boardFocus, setBoardFocus] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [micReady, setMicReady] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [micLevel, setMicLevel] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [storage, setStorage] = useState<StorageInfo>({ usage: 0, quota: 0, persisted: false, supported: true })
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [interrupted, setInterrupted] = useState<ChunkSession[]>([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micFrameRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordStartingRef = useRef(false)
  const sessionRef = useRef<ChunkSession | null>(null)
  const chunkSequenceRef = useRef(0)
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve())
  const startedAtRef = useRef(0)
  const pausedAtRef = useRef(0)
  const pausedTotalRef = useRef(0)
  const durationRef = useRef(0)
  const objectUrlsRef = useRef<string[]>([])
  const stopRecordingRef = useRef<() => void>(() => undefined)

  const isActive = recordState === 'recording' || recordState === 'paused'
  const isBusy = isActive || recordState === 'starting' || recordState === 'finalizing'
  const pageCount = pdfDocument?.numPages ?? slideUrls.length
  const annotationKey = sourceMode === 'slides' ? `slide-${page}` : sourceMode
  const strokes = annotations[annotationKey] ?? []
  const classroom = useClassroom({
    onNotice: setNotice,
    onError: setError,
    onCameraCommand: changeCameraVisibility,
  })
  const workspaceTitle = sourceMode === 'classroom'
    ? classroom.paper?.name ?? 'Interactive question-paper classroom'
    : sourceMode === 'camera'
      ? 'Traditional classroom camera'
      : deckName

  const refreshLibrary = useCallback(async () => {
    try {
      const [items, sessions] = await Promise.all([listRecordings(), listInterruptedSessions()])
      setRecordings(items)
      setInterrupted(sessions)
    } catch {
      setError('Browser recording storage could not be opened. Allow site storage in Chrome or Edge, then reload before teaching.')
    }
  }, [])

  const refreshStorage = useCallback(async () => {
    try {
      setStorage(await storageStatus())
    } catch {
      setStorage({ usage: 0, quota: 0, persisted: false, supported: false })
    }
  }, [])

  useEffect(() => {
    void refreshLibrary()
    void refreshStorage()
    const interval = window.setInterval(() => void refreshStorage(), 30_000)
    return () => window.clearInterval(interval)
  }, [refreshLibrary, refreshStorage])

  useEffect(() => () => {
    if (pdfDocument) void pdfDocument.destroy()
  }, [pdfDocument])

  useEffect(() => {
    if (sourceMode === 'screen') {
      setSource(screenStreamRef.current ? videoRef.current : null)
      return
    }
    if (sourceMode === 'camera') {
      setSource(cameraStreamRef.current ? cameraVideoRef.current : null)
      return
    }
    if (sourceMode === 'classroom') {
      setSource(null)
      return
    }
    let cancelled = false
    setSource(null)
    if (pdfDocument) {
      renderPdfPage(pdfDocument, page + 1)
        .then((canvas) => { if (!cancelled) setSource(canvas) })
        .catch((reason: Error) => { if (!cancelled) setError(`Could not render this PDF page: ${reason.message}`) })
    } else if (slideUrls[page]) {
      const image = new Image()
      image.onload = () => { if (!cancelled) setSource(image) }
      image.onerror = () => { if (!cancelled) setError('This slide image could not be opened.') }
      image.src = slideUrls[page]
    }
    return () => { cancelled = true }
  }, [sourceMode, pdfDocument, slideUrls, page])

  useEffect(() => {
    if (!isActive) return
    const interval = window.setInterval(() => {
      const end = recordState === 'paused' ? pausedAtRef.current : performance.now()
      const seconds = Math.max(0, (end - startedAtRef.current - pausedTotalRef.current) / 1000)
      durationRef.current = seconds
      setElapsed(seconds)
    }, 250)
    return () => window.clearInterval(interval)
  }, [isActive, recordState])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isActive) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isActive])

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    cancelAnimationFrame(micFrameRef.current)
    void audioContextRef.current?.close()
  }, [])

  function monitorMicrophone(stream: MediaStream) {
    cancelAnimationFrame(micFrameRef.current)
    const AudioContextClass = window.AudioContext
    const context = audioContextRef.current ?? new AudioContextClass()
    audioContextRef.current = context
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    let lastUiUpdate = 0
    const update = (time: number) => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const normalized = (sample - 128) / 128
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / samples.length)
      if (time - lastUiUpdate >= 100) {
        setMicLevel(Math.min(100, Math.round(rms * 420)))
        lastUiUpdate = time
      }
      micFrameRef.current = requestAnimationFrame(update)
    }
    update(performance.now())
  }

  function explainMicFailure(reason: unknown): string {
    const name = reason instanceof DOMException ? reason.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Microphone permission was blocked. Click the lock/tune icon left of the address bar → Site settings → set Microphone to Allow → reload this page → press Start again.'
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'No microphone was found or it is in use by another app (Zoom, Teams, OBS). Close the other app, then press Start again.'
    }
    if (reason instanceof Error && /timed out/i.test(reason.message)) {
      return 'The microphone prompt was not answered in time. Look for the permission prompt near the address bar, choose Allow, then press Start again.'
    }
    return `Microphone access failed: ${reason instanceof Error ? reason.message : 'check Windows and browser permissions.'}`
  }

  async function ensureMicrophone() {
    if (micStreamRef.current?.getAudioTracks().some((track) => track.readyState === 'live')) {
      return micStreamRef.current
    }
    setWaitingForMic(true)
    const request = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    })
    let stream: MediaStream
    try {
      stream = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Microphone permission timed out')), 30_000)
        }),
      ])
    } catch (reason) {
      setWaitingForMic(false)
      if (reason instanceof Error && /timed out/i.test(reason.message)) {
        request.then((lateStream) => lateStream.getTracks().forEach((track) => track.stop())).catch(() => undefined)
      }
      throw reason
    }
    setWaitingForMic(false)
    micStreamRef.current = stream
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled
      track.addEventListener('ended', () => {
        micStreamRef.current = null
        setMicReady(false)
        setMicLevel(0)
        if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') {
          setError('The microphone disconnected. Recording was stopped so the lesson can be saved and checked.')
          stopRecordingRef.current()
        }
      }, { once: true })
    })
    setMicReady(true)
    monitorMicrophone(stream)
    return stream
  }

  async function testMicrophone() {
    setError('')
    try {
      await ensureMicrophone()
      await audioContextRef.current?.resume()
      setNotice('Microphone connected. Speak normally and watch the input level, then make a short recording to verify playback.')
    } catch (reason) {
      setError(explainMicFailure(reason))
    }
  }

  function toggleMicrophone() {
    const next = !micEnabled
    setMicEnabled(next)
    micStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next })
  }

  async function ensureCamera() {
    try {
      if (cameraStreamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) {
        setCameraReady(true)
        return cameraVideoRef.current
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: quality.fps, max: quality.fps },
        },
        audio: false,
      })
      cameraStreamRef.current = stream
      const video = cameraVideoRef.current
      if (!video) throw new Error('The camera preview is unavailable.')
      video.srcObject = stream
      await video.play()
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        cameraStreamRef.current = null
        setCameraReady(false)
        setCameraEnabled(false)
        if (sourceMode === 'camera') {
          setSource(null)
          if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') {
            setError('The camera disconnected. Recording was stopped so the available lesson can be saved.')
            stopRecordingRef.current()
          }
        }
      }, { once: true })
      setCameraReady(true)
      if (sourceMode === 'camera') setSource(video)
      return video
    } catch (reason) {
      setError(`Camera access failed: ${reason instanceof Error ? reason.message : 'check Windows and browser camera permissions.'}`)
      return null
    }
  }

  function changeCameraVisibility(visible: boolean) {
    if (!visible) {
      setCameraEnabled(false)
      return
    }
    void ensureCamera().then((video) => {
      if (video) {
        setCameraEnabled(true)
        setNotice(sourceMode === 'camera' ? 'Camera connected. Traditional teaching mode records only your camera and voice.' : 'Camera overlay is visible in the preview and will be included in the recording.')
      }
    })
  }

  async function connectScreen() {
    setError('')
    try {
      if (screenStreamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) {
        setSource(videoRef.current)
        setScreenConnected(true)
        return videoRef.current
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: quality.width },
          height: { ideal: quality.height },
          frameRate: { ideal: quality.fps, max: quality.fps },
        },
        audio: false,
      })
      screenStreamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('The screen preview is unavailable.')
      video.srcObject = stream
      await video.play()
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        screenStreamRef.current = null
        setScreenConnected(false)
        setSource(null)
        if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') stopRecordingRef.current()
      })
      setScreenConnected(true)
      setSource(video)
      setNotice('Screen connected. Keep this recorder visible only in the preview; choose your PowerPoint window or another display to avoid a mirror effect.')
      return video
    } catch (reason) {
      setError(`Screen capture was not started: ${reason instanceof Error ? reason.message : 'permission was not granted.'}`)
      return null
    }
  }

  function replaceDeck(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setNotice('')
    const fileArray = Array.from(files)
    if (fileArray[0].type === 'application/pdf' || fileArray[0].name.toLowerCase().endsWith('.pdf')) {
      void openPdf(fileArray[0])
        .then((document) => {
          objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
          objectUrlsRef.current = []
          setPdfDocument(document)
          setSlideUrls([])
          setDeckName(fileArray[0].name)
          setPage(0)
          setAnnotations({})
          setNotice(`Loaded ${document.numPages} slides from ${fileArray[0].name}.`)
        })
        .catch((reason: Error) => setError(`Could not open the PDF: ${reason.message}`))
      return
    }
    const images = fileArray.filter((file) => /^image\/(png|jpeg|webp)$/.test(file.type))
    if (!images.length) {
      setError('Choose one PDF or a set of PNG, JPG, or WebP slide images.')
      return
    }
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((file) => URL.createObjectURL(file))
    setPdfDocument(null)
    setSlideUrls(objectUrlsRef.current)
    setDeckName(images.length === 1 ? images[0].name : `${images.length} imported slide images`)
    setPage(0)
    setAnnotations({})
    setNotice(`Loaded ${images.length} slide ${images.length === 1 ? 'image' : 'images'}.`)
  }

  function loadSample() {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    setPdfDocument(null)
    setSlideUrls(SAMPLE_SLIDES)
    setDeckName('Sample agricultural sciences lesson')
    setPage(0)
    setAnnotations({})
    setError('')
  }

  async function startRecording() {
    if (recordState !== 'idle' || recordStartingRef.current) return
    recordStartingRef.current = true
    setRecordState('starting')
    setError('')
    setNotice('')
    try {
      if (!canvasRef.current || !('captureStream' in canvasRef.current)) throw new Error('Canvas recording is not supported in this browser.')
      const mimeType = preferredMimeType()
      if (!mimeType) throw new Error('This browser does not offer a compatible WebM recorder. Use a current version of Chrome or Edge, or record with OBS.')
      if (sourceMode === 'screen') {
        const video = await connectScreen()
        if (!video) {
          setRecordState('idle')
          return
        }
      } else if (sourceMode === 'camera') {
        const video = await ensureCamera()
        if (!video) {
          setRecordState('idle')
          return
        }
        setSource(video)
      } else if (sourceMode === 'slides' && !source) {
        throw new Error('Wait for the slide to finish loading, then try again.')
      }
      const microphone = await ensureMicrophone()
      await audioContextRef.current?.resume()
      const output = canvasRef.current.captureStream(quality.fps)
      microphone.getAudioTracks().forEach((track) => output.addTrack(track))
      const recorder = new MediaRecorder(output, {
        mimeType,
        videoBitsPerSecond: quality.videoBitsPerSecond,
        audioBitsPerSecond: 128_000,
      })
      const session = await createChunkSession(lessonFilename('').replace(/\.$/, ''), mimeType)
      sessionRef.current = session
      recorderRef.current = recorder
      chunkSequenceRef.current = 0
      chunkQueueRef.current = Promise.resolve()
      setElapsed(0)
      durationRef.current = 0
      pausedTotalRef.current = 0
      pausedAtRef.current = 0

      recorder.ondataavailable = (event) => {
        if (!event.data.size) return
        const sequence = chunkSequenceRef.current++
        const recordedAt = Date.now()
        chunkQueueRef.current = chunkQueueRef.current.then(() => appendRecordingChunk(session.id, sequence, event.data, recordedAt))
        chunkQueueRef.current.catch(() => {
          setError('A recording chunk could not be saved. Recording was stopped to preserve the chunks already stored. Check the recovery area in the library.')
          if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') stopRecordingRef.current()
        })
      }
      recorder.onerror = () => setError('The browser reported a recording error. Stop the lesson and preserve any recoverable chunks.')
      recorder.onstop = () => {
        setRecordState('finalizing')
        void chunkQueueRef.current
          .then(() => finalizeChunkSession(session, durationRef.current))
          .then(async () => {
            output.getVideoTracks().forEach((track) => track.stop())
            await Promise.all([refreshLibrary(), refreshStorage()])
            setNotice('Recording saved in this browser. Preview it and download a copy before uploading.')
            setRecordState('idle')
            setView('library')
          })
          .catch((reason: Error) => {
            setError(`The recording could not be finalized: ${reason.message}. Check the recovery area in the library.`)
            setRecordState('idle')
            void refreshLibrary()
          })
      }
      startedAtRef.current = performance.now()
      recorder.start(5000)
      setRecordState('recording')
      setNotice(sourceMode === 'classroom'
        ? 'Recording started. The question, green handwriting, and visible camera overlay will all be captured.'
        : sourceMode === 'camera'
          ? 'Recording started in traditional mode with camera and voice.'
          : 'Recording started. Speak naturally; use the pen or highlighter directly on the lesson preview.')
    } catch (reason) {
      setRecordState('idle')
      setError(explainMicFailure(reason))
    } finally {
      recordStartingRef.current = false
    }
  }

  function pauseRecording() {
    if (recorderRef.current?.state !== 'recording') return
    pausedAtRef.current = performance.now()
    recorderRef.current.pause()
    setRecordState('paused')
  }

  function resumeRecording() {
    if (recorderRef.current?.state !== 'paused') return
    pausedTotalRef.current += performance.now() - pausedAtRef.current
    recorderRef.current.resume()
    setRecordState('recording')
  }

  function stopRecording() {
    if (!recorderRef.current || !isActive) return
    const end = recordState === 'paused' ? pausedAtRef.current : performance.now()
    durationRef.current = Math.max(0, (end - startedAtRef.current - pausedTotalRef.current) / 1000)
    setRecordState('finalizing')
    recorderRef.current.stop()
  }
  stopRecordingRef.current = stopRecording

  async function handleRecover(session: ChunkSession) {
    setError('')
    try {
      await recoverInterruptedSession(session)
      await Promise.all([refreshLibrary(), refreshStorage()])
      setNotice('Recoverable chunks were assembled into a recording. Preview it carefully before use.')
    } catch (reason) {
      setError(`Recovery failed: ${reason instanceof Error ? reason.message : 'unknown error'}`)
    }
  }

  function toggleBoardFocus() {
    const next = !boardFocus
    setBoardFocus(next)
    if (next) {
      stageRef.current?.requestFullscreen?.().catch(() => undefined)
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    }
  }

  useEffect(() => {
    if (!boardFocus) return
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setBoardFocus(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBoardFocus(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [boardFocus])

  const availableMinutes = storage.quota
    ? Math.max(0, ((storage.quota - storage.usage) * 8) / (quality.videoBitsPerSecond + 128_000) / 60)
    : 0

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mark"><Leaf size={20} /></span><span><strong>Young Agripreneurs</strong><small>Lesson Recorder</small></span></div>
        <div className="header-center"><span className="status-dot" />Local-first production</div>
        <div className="header-meta"><span>{quality.shortLabel}</span><span>WEBM + VOICE</span></div>
      </header>

      <div className="app-body">
        <nav className="nav-rail" aria-label="Main navigation">
          <button className={view === 'studio' ? 'nav-button is-active' : 'nav-button'} onClick={() => setView('studio')} disabled={isBusy} aria-label="Recorder" title="Recorder"><Video size={20} /><span>Record</span></button>
          <button className={view === 'library' ? 'nav-button is-active' : 'nav-button'} onClick={() => setView('library')} disabled={isBusy} aria-label="Recording library" title="Recording library"><Library size={20} /><span>Library</span>{recordings.length > 0 && <b>{recordings.length}</b>}</button>
          <button className={view === 'guide' ? 'nav-button is-active' : 'nav-button'} onClick={() => setView('guide')} disabled={isBusy} aria-label="Setup guide" title="Setup guide"><BookOpenCheck size={20} /><span>Guide</span></button>
        </nav>

        <aside className="control-sidebar">
          <div className="sidebar-section">
            <p className="micro-label">LESSON SOURCE</p>
            <div className="segment-control segment-control--modes">
              <button className={sourceMode === 'classroom' ? 'is-selected' : ''} onClick={() => setSourceMode('classroom')} disabled={isBusy}><GraduationCap size={16} />Classroom</button>
              <button className={sourceMode === 'slides' ? 'is-selected' : ''} onClick={() => setSourceMode('slides')} disabled={isBusy}><Presentation size={16} />Slides</button>
              <button className={sourceMode === 'screen' ? 'is-selected' : ''} onClick={() => setSourceMode('screen')} disabled={isBusy}><ScreenShare size={16} />Screen</button>
              <button className={sourceMode === 'camera' ? 'is-selected' : ''} onClick={() => setSourceMode('camera')} disabled={isBusy}><Camera size={16} />Camera</button>
            </div>
            {sourceMode === 'classroom' && <ClassroomSidebar classroom={classroom} disabled={isBusy} />}
            {sourceMode === 'slides' && (
              <>
                <input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => replaceDeck(event.target.files)} />
                <button className="button button--dark button--full" onClick={() => fileInputRef.current?.click()} disabled={isBusy}><FileUp size={16} />Import PDF or images</button>
                <button className="text-button" onClick={loadSample} disabled={isBusy}>Load the sample deck</button>
              </>
            )}
            {sourceMode === 'screen' && <button className="button button--dark button--full" onClick={() => void connectScreen()} disabled={isBusy}><MonitorUp size={16} />{screenConnected ? 'Reconnect screen' : 'Connect screen'}</button>}
            {sourceMode === 'camera' && (
              <>
                <button className="button button--dark button--full" onClick={() => changeCameraVisibility(true)}><Camera size={16} />{cameraReady ? 'Camera connected' : 'Open classroom camera'}</button>
                <p className="field-help">Traditional mode records only your camera and voice—useful at a physical whiteboard.</p>
              </>
            )}
          </div>

          {sourceMode !== 'camera' && (
            <div className="sidebar-section camera-section">
              <p className="micro-label">CAMERA OVERLAY</p>
              <div className="mic-heading"><span className={cameraReady && cameraEnabled ? 'status-dot' : 'status-dot is-off'} />{cameraEnabled ? 'Face visible in recording' : cameraReady ? 'Camera hidden' : 'Camera not connected'}</div>
              <button className="button button--quiet button--full" onClick={() => changeCameraVisibility(!cameraEnabled)}>{cameraEnabled ? <CameraOff size={16} /> : <Camera size={16} />}{cameraEnabled ? 'Hide camera' : cameraReady ? 'Show camera' : 'Connect & show camera'}</button>
            </div>
          )}

          <div className="sidebar-section">
            <label className="field-label" htmlFor="quality">RECORDING QUALITY</label>
            <select id="quality" value={qualityId} onChange={(event) => setQualityId(event.target.value)} disabled={isBusy}>
              {QUALITY_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
            <p className="field-help">30 fps · {formatBytes((quality.videoBitsPerSecond + 128_000) * 450, 1)} estimated per hour</p>
          </div>

          <div className="sidebar-section">
            <p className="micro-label">MICROPHONE</p>
            <div className="mic-heading"><span className={micReady && micEnabled ? 'status-dot' : 'status-dot is-off'} />{micReady ? (micEnabled ? 'Input connected' : 'Input muted') : 'Not tested'}</div>
            <div className="level-track" aria-label={`Microphone input level ${micLevel}%`}><span style={{ transform: `scaleX(${micLevel / 100})` }} /></div>
            <div className="button-pair">
              <button className="button button--quiet" onClick={() => void testMicrophone()}><Mic2 size={16} />Test mic</button>
              <button className="icon-button" onClick={toggleMicrophone} disabled={!micReady} aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}>{micEnabled ? <Mic2 size={17} /> : <MicOff size={17} />}</button>
            </div>
          </div>

          <div className="sidebar-section storage-section">
            <p className="micro-label">BROWSER STORAGE</p>
            <div className="storage-number"><HardDrive size={17} /><strong>{storage.quota ? formatBytes(Math.max(0, storage.quota - storage.usage)) : 'Unknown'}</strong></div>
            <p>{storage.quota ? `Estimated browser quota remaining · about ${Math.floor(availableMinutes)} min at this preset` : 'This browser did not provide a storage estimate.'}</p>
            <p className={storage.persisted ? 'persisted-state' : 'warning-state'}>{storage.persisted ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}{storage.persisted ? 'Persistent storage granted' : 'Best-effort storage only'}</p>
            {!storage.persisted && <button className="text-button" onClick={() => void protectStorage().then(refreshStorage)}>Request persistent storage</button>}
          </div>
          <p className="sidebar-footnote">Export every important lesson. Browser storage is not cloud backup.</p>
        </aside>

        <main className="main-workspace">
          {(notice || error) && <div className={error ? 'app-notice is-error' : 'app-notice'} role={error ? 'alert' : 'status'}>{error ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>{error || notice}</span><button aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }}>×</button></div>}
          {view === 'studio' && (
            <section className="studio-panel" aria-labelledby="studio-title">
              <header className="studio-heading">
                <div><p className="micro-label">{sourceMode === 'classroom' ? 'INTERACTIVE TEACHING STUDIO' : sourceMode === 'camera' ? 'TRADITIONAL TEACHING MODE' : 'RECORDING STUDIO'}</p><h1 id="studio-title">{workspaceTitle}</h1></div>
                {sourceMode === 'slides' && (
                  <div className="slide-navigation">
                    <button className="icon-button" aria-label="Previous slide" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ChevronLeft size={19} /></button>
                    <span>{String(page + 1).padStart(2, '0')} / {String(pageCount).padStart(2, '0')}</span>
                    <button className="icon-button" aria-label="Next slide" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}><ChevronRight size={19} /></button>
                  </div>
                )}
              </header>

              <div ref={stageRef} className={boardFocus ? 'canvas-stage is-focus' : 'canvas-stage'}>
                <div className="stage-meta"><span>{sourceMode === 'classroom' ? 'SPLIT QUESTION + MEMO BOARD' : sourceMode === 'slides' ? `SLIDE ${page + 1}` : sourceMode === 'camera' ? 'CAMERA ONLY' : 'LIVE SCREEN'}</span><span>{quality.width} × {quality.height}</span></div>
                <button
                  className="stage-focus-button"
                  onClick={toggleBoardFocus}
                  aria-label={boardFocus ? 'Exit enlarged board view' : 'Enlarge board to fill the screen'}
                  title={boardFocus ? 'Exit enlarged view (Esc)' : 'Enlarge board to fill the screen'}
                >
                  {boardFocus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{boardFocus ? ' Exit' : ' Enlarge board'}
                </button>
                {sourceMode === 'classroom' ? (
                  <ClassroomCanvas
                    canvasRef={canvasRef}
                    width={quality.width}
                    height={quality.height}
                    paperCanvas={classroom.paperCanvas}
                    paperView={classroom.paperView}
                    paperName={classroom.paper?.name ?? 'Practice question'}
                    question={classroom.currentQuestion}
                    answerLines={classroom.answerLines}
                    writingProgress={classroom.writingProgress}
                    writingPlaying={classroom.writingPlaying}
                    busy={classroom.busy}
                    camera={cameraVideoRef.current}
                    cameraVisible={cameraEnabled}
                  />
                ) : (
                  <LessonCanvas
                    canvasRef={canvasRef}
                    source={source}
                    width={quality.width}
                    height={quality.height}
                    strokes={strokes}
                    onStrokesChange={(next) => setAnnotations((current) => ({ ...current, [annotationKey]: next }))}
                    tool={tool}
                    sourceLabel={sourceMode === 'slides' ? `Slide ${page + 1}` : sourceMode === 'camera' ? 'Traditional classroom camera' : 'Shared screen'}
                    camera={cameraVideoRef.current}
                    cameraVisible={sourceMode !== 'camera' && cameraEnabled}
                    mirrorSource={sourceMode === 'camera'}
                  />
                )}
                {isActive && <div className={recordState === 'paused' ? 'recording-badge is-paused' : 'recording-badge'}><span />{recordState === 'paused' ? 'PAUSED' : 'REC'} {formatDuration(elapsed)}</div>}
              </div>

              {(sourceMode === 'slides' || sourceMode === 'screen') && (
                <div className="annotation-toolbar" aria-label="Annotation tools">
                  <span className="toolbar-label">LIVE INK</span>
                  <button className={tool === 'pen' ? 'tool-button is-selected' : 'tool-button'} onClick={() => setTool('pen')}><Pen size={17} />Pen</button>
                  <button className={tool === 'highlighter' ? 'tool-button is-selected' : 'tool-button'} onClick={() => setTool('highlighter')}><Highlighter size={17} />Highlighter</button>
                  <span className="toolbar-divider" />
                  <button className="tool-button" onClick={() => setAnnotations((current) => ({ ...current, [annotationKey]: strokes.slice(0, -1) }))} disabled={!strokes.length}><Undo2 size={17} />Undo</button>
                  <button className="tool-button" onClick={() => setAnnotations((current) => ({ ...current, [annotationKey]: [] }))} disabled={!strokes.length}>Clear</button>
                  <span className="ink-hint">Draw directly on the preview</span>
                </div>
              )}
              {sourceMode === 'classroom' && <ClassroomToolbar classroom={classroom} />}

              <div className="record-bar">
                <div className="record-time"><span className={isActive && recordState !== 'paused' ? 'record-dot is-live' : 'record-dot'} /><div><strong>{formatDuration(elapsed)}</strong><small>{recordState === 'idle' ? 'Ready for a 30-second test' : recordState === 'starting' ? waitingForMic ? 'Approve the microphone prompt in the browser (near the address bar) — recording starts automatically once allowed.' : 'Preparing devices and local storage…' : recordState === 'finalizing' ? 'Saving recording…' : recordState === 'paused' ? 'Recording paused' : 'Recording in progress'}</small></div></div>
                <div className="record-actions">
                  {recordState === 'idle' && <button className="button button--record" onClick={() => void startRecording()}><Circle size={16} fill="currentColor" />Start recording</button>}
                  {recordState === 'starting' && <button className="button button--record" disabled>Preparing camera & microphone…</button>}
                  {isActive && <button className="button button--quiet" onClick={recordState === 'paused' ? resumeRecording : pauseRecording}>{recordState === 'paused' ? <Play size={16} /> : <Pause size={16} />}{recordState === 'paused' ? 'Resume' : 'Pause'}</button>}
                  {isActive && <button className="button button--dark" onClick={stopRecording}><Square size={15} fill="currentColor" />Stop & save</button>}
                  {recordState === 'finalizing' && <button className="button button--dark" disabled>Saving…</button>}
                </div>
              </div>
            </section>
          )}

          {view === 'library' && (
            <RecordingLibrary
              recordings={recordings}
              interrupted={interrupted}
              onDelete={(id) => void deleteRecording(id).then(refreshLibrary).then(refreshStorage)}
              onRecover={(session) => void handleRecover(session)}
              onDiscard={(id) => void discardInterruptedSession(id).then(refreshLibrary).then(refreshStorage)}
              onRecord={() => setView('studio')}
            />
          )}
          {view === 'guide' && <SetupGuide quality={quality} />}
        </main>
      </div>
      <video ref={videoRef} className="capture-video" muted playsInline aria-hidden="true" />
      <video ref={cameraVideoRef} className="capture-video" muted playsInline aria-hidden="true" />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { ClassroomQuestion } from '@contracts/classroom'
import { trpc } from '@/providers/trpc'
import {
  canvasImageData,
  extractPdfText,
  fileToCanvas,
  openPdf,
  renderPdfPage,
  type PdfDocument,
} from '@/lib/media'

export type TeachingDocument = {
  name: string
  kind: 'pdf' | 'image' | 'text'
  pdf: PdfDocument | null
  image: HTMLCanvasElement | null
  pageTexts: string[]
  pageCount: number
  scanned: boolean
}

export type PaperView = 'page' | 'question'
type BusyAction = 'upload-paper' | 'upload-memo' | 'questions' | 'answer' | null

const MAX_FILE_SIZE = 25 * 1024 * 1024
const SAMPLE_QUESTION: ClassroomQuestion = {
  id: 'sample-1',
  label: '1.1',
  prompt: 'A farmer plants 48 seedlings in each of 12 rows. Calculate the total number of seedlings and explain one way this calculation helps the farmer plan.',
  marks: 4,
  page: 1,
  answerLines: [
    { text: 'Total seedlings = seedlings per row × number of rows', kind: 'working' },
    { text: '= 48 × 12', kind: 'working' },
    { text: '= 576 seedlings', kind: 'result' },
    { text: 'The farmer can plan the space, water and labour needed.', kind: 'note' },
  ],
  answerGrounded: false,
}

function documentText(document: TeachingDocument) {
  return document.pageTexts
    .map((text, index) => `--- PAGE ${index + 1} ---\n${text}`)
    .join('\n\n')
    .slice(0, 100_000)
}

function validDocumentFile(file: File) {
  return file.type === 'application/pdf'
    || /\.pdf$/i.test(file.name)
    || /^image\/(png|jpeg|webp)$/.test(file.type)
}

async function readDocument(file: File): Promise<TeachingDocument> {
  if (!validDocumentFile(file)) {
    throw new Error('Choose a PDF, PNG, JPG, or WebP file. Word and PowerPoint files must first be exported as PDF.')
  }
  if (file.size > MAX_FILE_SIZE) throw new Error('This file is over 25 MB. Compress it or split the paper into smaller PDFs.')
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdf = await openPdf(file)
    const pageTexts = await extractPdfText(pdf)
    const scanned = pageTexts.every((text) => text.replace(/\s/g, '').length < 30)
    return {
      name: file.name,
      kind: 'pdf',
      pdf,
      image: null,
      pageTexts,
      pageCount: pdf.numPages,
      scanned,
    }
  }
  return {
    name: file.name,
    kind: 'image',
    pdf: null,
    image: await fileToCanvas(file),
    pageTexts: [''],
    pageCount: 1,
    scanned: true,
  }
}

async function pageImage(document: TeachingDocument, pageIndex: number) {
  if (document.image) return canvasImageData(document.image)
  if (!document.pdf) return ''
  const canvas = await renderPdfPage(document.pdf, pageIndex + 1, 1500)
  return canvasImageData(canvas)
}

type VoiceActions = {
  showQuestion: (number?: string) => void
  giveAnswer: () => void
  nextQuestion: () => void
  previousQuestion: () => void
  pauseWriting: () => void
  clearBoard: () => void
  showPaper: () => void
  setCamera: (visible: boolean) => void
}

type RecognitionEvent = {
  results: ArrayLike<{ 0: { transcript: string } }>
}

type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type RecognitionConstructor = new () => Recognition

function useVoiceCommands(actions: VoiceActions, onError: (message: string) => void) {
  const [listening, setListening] = useState(false)
  const [lastCommand, setLastCommand] = useState('')
  const recognitionRef = useRef<Recognition | null>(null)
  const actionsRef = useRef(actions)
  const errorRef = useRef(onError)
  const supported = typeof window !== 'undefined' && Boolean(
    (window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition,
  )

  useEffect(() => { actionsRef.current = actions }, [actions])
  useEffect(() => { errorRef.current = onError }, [onError])
  useEffect(() => () => recognitionRef.current?.stop(), [])

  function stopVoice() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  function startVoice() {
    const speechWindow = window as unknown as {
      SpeechRecognition?: RecognitionConstructor
      webkitSpeechRecognition?: RecognitionConstructor
    }
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Constructor) {
      errorRef.current('Voice commands are not supported in this browser. Every action remains available as a button.')
      return
    }
    const recognition = new Constructor()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-ZA'
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim() ?? ''
      if (!transcript) return
      const command = transcript.toLowerCase()
      setLastCommand(transcript)
      const number = command.match(/question\s+(\d+(?:\.\d+)?)/)?.[1]
      if (number) actionsRef.current.showQuestion(number)
      else if (/give.*answer|write.*answer|show.*answer/.test(command)) actionsRef.current.giveAnswer()
      else if (/next.*question/.test(command)) actionsRef.current.nextQuestion()
      else if (/previous.*question|back.*question/.test(command)) actionsRef.current.previousQuestion()
      else if (/read.*question|show.*question/.test(command)) actionsRef.current.showQuestion()
      else if (/pause.*writing|stop.*writing/.test(command)) actionsRef.current.pauseWriting()
      else if (/clear.*board|erase.*board/.test(command)) actionsRef.current.clearBoard()
      else if (/show.*paper|original.*paper/.test(command)) actionsRef.current.showPaper()
      else if (/camera.*on|show.*camera/.test(command)) actionsRef.current.setCamera(true)
      else if (/camera.*off|hide.*camera/.test(command)) actionsRef.current.setCamera(false)
    }
    recognition.onerror = () => {
      setListening(false)
      errorRef.current('Voice recognition stopped or misheard the command. Use the teaching buttons to continue.')
    }
    recognition.onend = () => setListening(false)
    try {
      recognition.start()
      setListening(true)
    } catch {
      errorRef.current('Voice recognition could not start. Check microphone permission or use the teaching buttons.')
    }
  }

  return { supported, listening, lastCommand, startVoice, stopVoice }
}

export function useClassroom(options: {
  onNotice: (message: string) => void
  onError: (message: string) => void
  onCameraCommand: (visible: boolean) => void
}) {
  const [paper, setPaper] = useState<TeachingDocument | null>(null)
  const [memo, setMemo] = useState<TeachingDocument | null>(null)
  const [paperPage, setPaperPage] = useState(0)
  const [memoPage, setMemoPage] = useState(0)
  const [paperCanvas, setPaperCanvas] = useState<HTMLCanvasElement | null>(null)
  const [paperView, setPaperView] = useState<PaperView>('question')
  const [questions, setQuestions] = useState<ClassroomQuestion[]>([SAMPLE_QUESTION])
  const [selectedQuestion, setSelectedQuestion] = useState(0)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [writingProgress, setWritingProgress] = useState(0)
  const [writingPlaying, setWritingPlaying] = useState(false)
  const [narrating, setNarrating] = useState(false)
  const optionsRef = useRef(options)
  const extractInFlightRef = useRef(false)
  const answerInFlightRef = useRef(false)
  const extractMutation = trpc.classroom.extractQuestions.useMutation()
  const answerMutation = trpc.classroom.writeAnswer.useMutation()
  const statusQuery = trpc.classroom.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false })

  const currentQuestion = questions[selectedQuestion] ?? null
  const answerLines = currentQuestion?.answerLines ?? []
  const totalCharacters = answerLines.reduce((total, line) => total + line.text.length, 0)

  useEffect(() => { optionsRef.current = options }, [options])

  useEffect(() => () => {
    if (paper?.pdf) void paper.pdf.destroy()
  }, [paper])

  useEffect(() => () => {
    if (memo?.pdf) void memo.pdf.destroy()
  }, [memo])

  useEffect(() => {
    let cancelled = false
    if (!paper) {
      setPaperCanvas(null)
      return
    }
    if (paper.image) {
      setPaperCanvas(paper.image)
      return
    }
    if (!paper.pdf) {
      setPaperCanvas(null)
      return
    }
    if (paper.pdf) {
      setPaperCanvas(null)
      void renderPdfPage(paper.pdf, paperPage + 1)
        .then((canvas) => { if (!cancelled) setPaperCanvas(canvas) })
        .catch(() => { if (!cancelled) optionsRef.current.onError('This page could not be rendered. Try another page or re-export the PDF.' ) })
    }
    return () => { cancelled = true }
  }, [paper, paperPage])

  useEffect(() => {
    if (!writingPlaying || writingProgress >= totalCharacters) return
    const timer = window.setTimeout(() => {
      const next = Math.min(totalCharacters, writingProgress + 1)
      setWritingProgress(next)
      if (next >= totalCharacters) setWritingPlaying(false)
    }, 34)
    return () => window.clearTimeout(timer)
  }, [writingPlaying, writingProgress, totalCharacters])

  function resetWriting() {
    setWritingProgress(0)
    setWritingPlaying(false)
    window.speechSynthesis?.cancel()
    setNarrating(false)
  }

  function clearMemoAnswers() {
    setQuestions((current) => current.map((question) => ({
      ...question,
      answerLines: [],
      answerGrounded: false,
    })))
    resetWriting()
  }

  async function uploadDocument(file: File | null, role: 'paper' | 'memo') {
    if (!file) return
    optionsRef.current.onError('')
    optionsRef.current.onNotice('')
    setBusy(role === 'paper' ? 'upload-paper' : 'upload-memo')
    try {
      const document = await readDocument(file)
      if (role === 'paper') {
        setPaper(document)
        setPaperPage(0)
        setPaperView(document.scanned ? 'page' : 'question')
        setQuestions([])
        setSelectedQuestion(0)
        resetWriting()
      } else {
        setMemo(document)
        setMemoPage(0)
        clearMemoAnswers()
      }
      optionsRef.current.onNotice(
        `${role === 'paper' ? 'Question paper' : 'Memo'} loaded: ${document.pageCount} ${document.pageCount === 1 ? 'page' : 'pages'}. ${document.scanned ? 'No usable text layer found; AI will read the selected page image.' : 'Embedded text found.'} Content is sent to AI only when you request reading or an answer.`,
      )
    } catch (reason) {
      optionsRef.current.onError(`Could not upload ${role}: ${reason instanceof Error ? reason.message : 'the file may be damaged or unsupported.'}`)
    } finally {
      setBusy(null)
    }
  }

  function usePastedText(text: string, role: 'paper' | 'memo') {
    const clean = text.trim()
    if (!clean) {
      optionsRef.current.onError(`Paste the ${role} text first.`)
      return
    }
    const document: TeachingDocument = {
      name: `Pasted ${role} text`,
      kind: 'text',
      pdf: null,
      image: null,
      pageTexts: [clean.slice(0, 100_000)],
      pageCount: 1,
      scanned: false,
    }
    if (role === 'paper') {
      setPaper(document)
      setPaperPage(0)
      setQuestions([])
      setSelectedQuestion(0)
      setPaperView('question')
      resetWriting()
    } else {
      setMemo(document)
      setMemoPage(0)
      clearMemoAnswers()
    }
    optionsRef.current.onNotice(`Pasted ${role} text is ready.`)
    optionsRef.current.onError('')
  }

  async function extractQuestions(requestedQuestion?: string): Promise<ClassroomQuestion | null> {
    if (!paper) {
      optionsRef.current.onError('Upload a question paper or paste its text first. The sample question is available for practice.')
      return null
    }
    if (extractInFlightRef.current || answerInFlightRef.current) return null
    extractInFlightRef.current = true
    setBusy('questions')
    optionsRef.current.onError('')
    try {
      const hasText = paper.pageTexts.some((text) => text.trim().length > 20)
      const paperImages = hasText ? [] : [await pageImage(paper, paperPage)]
      const result = await extractMutation.mutateAsync({
        paperText: hasText ? documentText(paper) : '',
        paperImages,
        requestedQuestion,
      })
      setQuestions(result.questions)
      setSelectedQuestion(0)
      setPaperView('question')
      resetWriting()
      optionsRef.current.onNotice(`${result.questions.length} ${result.questions.length === 1 ? 'question' : 'questions'} extracted with ${result.provider}. Check the wording against the original before teaching.`)
      return result.questions[0] ?? null
    } catch (reason) {
      optionsRef.current.onError(reason instanceof Error ? reason.message : 'Questions could not be extracted.')
      return null
    } finally {
      extractInFlightRef.current = false
      setBusy(null)
    }
  }

  async function showQuestion(requestedQuestion?: string): Promise<ClassroomQuestion | null> {
    if (requestedQuestion) {
      const index = questions.findIndex((question) => {
        const label = question.label.replace(/^question\s*/i, '')
        return label === requestedQuestion || label.startsWith(`${requestedQuestion}.`)
      })
      if (index >= 0) {
        setSelectedQuestion(index)
        setPaperView('question')
        resetWriting()
        return questions[index]
      }
      return extractQuestions(requestedQuestion)
    }
    if (currentQuestion) {
      setPaperView('question')
      return currentQuestion
    }
    return extractQuestions()
  }

  function readBoardAloud() {
    if (!('speechSynthesis' in window)) {
      optionsRef.current.onError('Narration is not available in this browser. Use the visual writing controls instead.')
      return
    }
    const speech = window.speechSynthesis
    speech.cancel()
    if (narrating) {
      setNarrating(false)
      return
    }
    const text = answerLines.map((line) => line.text).join('. ').trim()
    if (!text) {
      optionsRef.current.onNotice('Choose Give answer first. Narration can then read the prepared board aloud for free in this browser.')
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.onend = () => setNarrating(false)
    utterance.onerror = () => {
      setNarrating(false)
      optionsRef.current.onError('The browser voice stopped. Try again, or continue with the animated green writing.')
    }
    speech.speak(utterance)
    setNarrating(true)
    optionsRef.current.onNotice('Free browser narration started. It is not sent to DeepSeek and is not included in the video recording.')
  }

  async function giveAnswer() {
    if (answerInFlightRef.current || extractInFlightRef.current) return
    const question = await showQuestion()
    if (!question || answerInFlightRef.current) return
    answerInFlightRef.current = true
    try {
      if (question.answerLines?.length) {
        setWritingProgress(0)
        setWritingPlaying(true)
        return
      }
      setBusy('answer')
      optionsRef.current.onError('')
      const hasMemoText = memo?.pageTexts.some((text) => text.trim().length > 20) ?? false
      const memoImages = memo && !hasMemoText ? [await pageImage(memo, memoPage)] : []
      const result = await answerMutation.mutateAsync({
        label: question.label,
        prompt: question.prompt,
        memoText: memo && hasMemoText ? documentText(memo) : '',
        memoImages,
      })
      setQuestions((current) => current.map((item) => item.id === question.id
        ? { ...item, answerLines: result.lines, answerGrounded: result.grounded }
        : item))
      setWritingProgress(0)
      setWritingPlaying(true)
      optionsRef.current.onNotice(result.warning || (result.grounded ? 'Answer prepared from the uploaded memo. Writing started.' : 'Answer prepared. Writing started.'))
    } catch (reason) {
      optionsRef.current.onError(reason instanceof Error ? reason.message : 'The answer could not be prepared.')
    } finally {
      answerInFlightRef.current = false
      setBusy(null)
    }
  }

  function nextQuestion() {
    resetWriting()
    if (selectedQuestion < questions.length - 1) {
      setSelectedQuestion((value) => value + 1)
      setPaperView('question')
      return
    }
    if (paper?.scanned && paperPage < paper.pageCount - 1) {
      setPaperPage((value) => value + 1)
      setQuestions([])
      setSelectedQuestion(0)
      setPaperView('page')
      optionsRef.current.onNotice(`Moved to paper page ${paperPage + 2}. Choose Read this page to extract its questions.`)
      return
    }
    optionsRef.current.onNotice('This is the last extracted question. Upload the next page or use Read this page if more questions are visible.')
  }

  function previousQuestion() {
    resetWriting()
    if (selectedQuestion > 0) {
      setSelectedQuestion((value) => value - 1)
      setPaperView('question')
    } else if (paper?.scanned && paperPage > 0) {
      setPaperPage((value) => value - 1)
      setQuestions([])
      setSelectedQuestion(0)
      setPaperView('page')
    }
  }

  function selectQuestion(index: number) {
    if (index < 0 || index >= questions.length || index === selectedQuestion) return
    setSelectedQuestion(index)
    setPaperView('question')
    resetWriting()
  }

  function goToPaperPage(nextPage: number) {
    if (!paper) return
    const bounded = Math.max(0, Math.min(paper.pageCount - 1, nextPage))
    if (bounded === paperPage) return
    setPaperPage(bounded)
    if (paper.scanned) {
      setQuestions([])
      setSelectedQuestion(0)
      setPaperView('page')
      resetWriting()
    }
  }

  function nextBoardLine() {
    if (!answerLines.length) return
    let boundary = 0
    for (const line of answerLines) {
      boundary += line.text.length
      if (boundary > writingProgress) {
        setWritingProgress(boundary)
        setWritingPlaying(boundary < totalCharacters)
        return
      }
    }
    setWritingPlaying(false)
  }

  function loadSample() {
    setPaper(null)
    setMemo(null)
    setQuestions([SAMPLE_QUESTION])
    setSelectedQuestion(0)
    setPaperView('question')
    setPaperPage(0)
    resetWriting()
    optionsRef.current.onNotice('Sample question loaded. Choose Give answer to rehearse the green handwriting.')
    optionsRef.current.onError('')
  }

  const voice = useVoiceCommands({
    showQuestion: (number) => { void showQuestion(number) },
    giveAnswer: () => { void giveAnswer() },
    nextQuestion,
    previousQuestion,
    pauseWriting: () => setWritingPlaying(false),
    clearBoard: resetWriting,
    showPaper: () => setPaperView('page'),
    setCamera: (visible) => optionsRef.current.onCameraCommand(visible),
  }, options.onError)

  return {
    paper,
    memo,
    paperPage,
    memoPage,
    paperCanvas,
    paperView,
    questions,
    selectedQuestion,
    currentQuestion,
    answerLines,
    busy,
    writingProgress,
    writingPlaying,
    narrating,
    readBoardAloud,
    totalCharacters,
    aiStatus: statusQuery.data ?? null,
    aiStatusError: statusQuery.isError,
    voice,
    uploadPaper: (file: File | null) => uploadDocument(file, 'paper'),
    uploadMemo: (file: File | null) => uploadDocument(file, 'memo'),
    usePastedPaper: (text: string) => usePastedText(text, 'paper'),
    usePastedMemo: (text: string) => usePastedText(text, 'memo'),
    setPaperPage: goToPaperPage,
    setMemoPage,
    setPaperView,
    setSelectedQuestion: selectQuestion,
    showQuestion,
    readPaper: () => extractQuestions(),
    giveAnswer,
    nextQuestion,
    previousQuestion,
    nextBoardLine,
    toggleWriting: () => {
      if (writingProgress >= totalCharacters) setWritingProgress(0)
      setWritingPlaying((value) => !value)
    },
    clearBoard: resetWriting,
    loadSample,
  }
}

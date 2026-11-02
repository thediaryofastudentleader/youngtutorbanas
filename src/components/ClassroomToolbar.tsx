import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  FileText,
  LoaderCircle,
  Mic2,
  MicOff,
  Pause,
  PenLine,
  Play,
  ScanText,
  StepForward,
  Volume2,
} from 'lucide-react'
import type { useClassroom } from '@/hooks/useClassroom'

type Classroom = ReturnType<typeof useClassroom>

export default function ClassroomToolbar({ classroom }: { classroom: Classroom }) {
  const busy = classroom.busy === 'questions' || classroom.busy === 'answer'
  return (
    <div className="classroom-toolbar" aria-label="Guided classroom controls">
      <div className="classroom-toolbar__primary">
        <button className="tool-button" onClick={() => void classroom.readPaper()} disabled={!classroom.paper || busy}>
          {classroom.busy === 'questions' ? <LoaderCircle size={17} className="spin" /> : <ScanText size={17} />}Read {classroom.paper?.scanned ? 'this page' : 'paper'}
        </button>
        <button className="tool-button" onClick={() => void classroom.showQuestion()} disabled={busy}><BookOpenText size={17} />Show question</button>
        <button className="button button--accent" onClick={() => void classroom.giveAnswer()} disabled={busy}>
          {classroom.busy === 'answer' ? <LoaderCircle size={17} className="spin" /> : <PenLine size={17} />}Give answer
        </button>
        <span className="toolbar-divider" />
        <button className="icon-button" aria-label="Previous question" onClick={classroom.previousQuestion} disabled={busy || (!classroom.selectedQuestion && !classroom.paperPage)}><ChevronLeft size={18} /></button>
        {classroom.questions.length ? (
          <select
            className="question-position question-select"
            aria-label="Select question"
            value={classroom.selectedQuestion}
            onChange={(event) => classroom.setSelectedQuestion(Number(event.target.value))}
            disabled={busy}
          >
            {classroom.questions.map((question, index) => (
              <option key={question.id} value={index}>Q{question.label} · {index + 1}/{classroom.questions.length}</option>
            ))}
          </select>
        ) : <span className="question-position">—</span>}
        <button className="icon-button" aria-label="Next question" onClick={classroom.nextQuestion} disabled={busy}><ChevronRight size={18} /></button>
      </div>
      <div className="classroom-toolbar__secondary">
        <div className="mini-segment" aria-label="Question display">
          <button className={classroom.paperView === 'page' ? 'is-selected' : ''} onClick={() => classroom.setPaperView('page')} disabled={!classroom.paperCanvas}><FileText size={15} />Original</button>
          <button className={classroom.paperView === 'question' ? 'is-selected' : ''} onClick={() => classroom.setPaperView('question')}><Eye size={15} />Extracted</button>
        </div>
        <button className="tool-button" onClick={classroom.toggleWriting} disabled={!classroom.answerLines.length || busy}>
          {classroom.writingPlaying ? <Pause size={16} /> : <Play size={16} />}{classroom.writingPlaying ? 'Pause writing' : 'Write / resume'}
        </button>
        <button className="tool-button" onClick={classroom.nextBoardLine} disabled={!classroom.answerLines.length || busy}><StepForward size={16} />Next line</button>
        <button className="tool-button" onClick={classroom.readBoardAloud} disabled={!('speechSynthesis' in window) || busy} title="Uses the browser's free voice. It is not sent to DeepSeek and is not recorded in the video.">
          <Volume2 size={16} />{classroom.narrating ? 'Stop voiceover' : 'Speak board'}
        </button>
        <button className="tool-button" onClick={classroom.clearBoard} disabled={!classroom.answerLines.length}><Eraser size={16} />Clear board</button>
        <button
          className={classroom.voice.listening ? 'tool-button voice-button is-listening' : 'tool-button voice-button'}
          onClick={classroom.voice.listening ? classroom.voice.stopVoice : classroom.voice.startVoice}
          disabled={!classroom.voice.supported}
          title={classroom.voice.supported ? 'Try: “Question 2”, “Give the answer”, “Pause writing”, or “Camera off”.' : 'Speech recognition is unavailable in this browser; use the buttons.'}
        >
          {classroom.voice.listening ? <MicOff size={16} /> : <Mic2 size={16} />}{classroom.voice.listening ? 'Stop voice' : 'Voice commands'}
        </button>
      </div>
      <div className="voice-command-hint">
        <span>{classroom.voice.listening ? 'Listening for a teaching command…' : 'Manual controls are always available.'}</span>
        {classroom.voice.lastCommand && <span>Heard: “{classroom.voice.lastCommand}”</span>}
      </div>
    </div>
  )
}

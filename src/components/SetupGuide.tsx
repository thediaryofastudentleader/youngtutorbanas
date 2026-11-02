import { useMemo, useState } from 'react'
import { Check, ExternalLink, HardDrive, Mic2, MonitorUp, Upload } from 'lucide-react'
import type { QualityPreset } from '../types/recording'
import { formatBytes } from '../types/recording'

export default function SetupGuide({ quality }: { quality: QualityPreset }) {
  const [minutes, setMinutes] = useState(30)
  const [uploadMbps, setUploadMbps] = useState(5)
  const estimate = useMemo(() => {
    const safeMinutes = Math.max(1, Math.min(240, minutes || 1))
    const totalMbps = quality.videoBitsPerSecond / 1_000_000 + 0.128
    const bytes = (totalMbps * 1_000_000 * safeMinutes * 60) / 8
    const uploadSeconds = (bytes * 8) / (Math.max(0.5, uploadMbps || 0.5) * 1_000_000)
    return { bytes, uploadMinutes: uploadSeconds / 60 }
  }, [minutes, quality, uploadMbps])

  return (
    <section className="workspace-panel" aria-labelledby="setup-title">
      <header className="workspace-heading">
        <div>
          <p className="micro-label">RELIABLE LESSON ROUTINE</p>
          <h1 id="setup-title">Record first. Go live later.</h1>
          <p>Your internet connection should control when you upload—not whether you can teach.</p>
        </div>
      </header>

      <div className="routine-grid">
        <article><MonitorUp size={21} /><span>01</span><h2>Prepare</h2><p>Export PowerPoint to PDF for slide mode, or connect a screen for animations and other apps.</p></article>
        <article><Mic2 size={21} /><span>02</span><h2>Test</h2><p>Record 30 seconds with speech and ink. Play it back before teaching the full lesson.</p></article>
        <article><HardDrive size={21} /><span>03</span><h2>Verify</h2><p>Stop cleanly, open the recording in the library, then download a WebM copy.</p></article>
        <article><Upload size={21} /><span>04</span><h2>Upload</h2><p>Upload when Wi‑Fi is stable. Keep the local master until YouTube processing and playback are confirmed.</p></article>
      </div>

      <section className="classroom-guide" aria-labelledby="classroom-guide-title">
        <p className="micro-label">INTERACTIVE QUESTION-PAPER CLASSROOM</p>
        <h2 id="classroom-guide-title">Teach the question before revealing the memo.</h2>
        <div className="classroom-guide__grid">
          <article><span>01</span><h3>Upload separately</h3><p>Choose the question paper and memo in Classroom mode. For a scan, go to the relevant page and choose <strong>Read this page</strong>. If a file fails, paste its text instead.</p></article>
          <article><span>02</span><h3>Control the board</h3><p>Use <strong>Show question</strong>, then <strong>Give answer</strong> only when learners are ready. Pause, advance one line, clear, or rewrite the green handwriting at any time.</p></article>
          <article><span>03</span><h3>Use voice as a helper</h3><p>Try “Question 2”, “Give the answer”, “Pause writing”, and “Camera off”. Buttons always remain available if speech recognition mishears you.</p></article>
          <article><span>04</span><h3>Choose your presence</h3><p>Show or hide the camera overlay during classroom, slides, or screen mode. Choose Camera for traditional camera-and-voice teaching at a physical board.</p></article>
        </div>
        <p className="classroom-privacy">AI receives document text or a selected page image only when you request extraction or an answer. Remove private learner details and check every extracted question and AI answer against the original memo.</p>
      </section>

      <section className="budget-section" aria-labelledby="budget-title">
        <div>
          <p className="micro-label">STORAGE & UPLOAD ESTIMATOR</p>
          <h2 id="budget-title">Budget the lesson before recording.</h2>
          <p>Planning estimate at {quality.shortLabel}, plus 128 kbps audio. Actual WebM size varies with the picture and browser encoder.</p>
        </div>
        <div className="budget-controls">
          <label>Lesson length <span>{minutes} min</span><input type="range" min="1" max="120" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
          <label>Upload connection <span>{uploadMbps} Mbps</span><input type="range" min="1" max="50" value={uploadMbps} onChange={(event) => setUploadMbps(Number(event.target.value))} /></label>
        </div>
        <div className="budget-result">
          <div><span>Estimated file</span><strong>{formatBytes(estimate.bytes)}</strong></div>
          <div><span>Ideal upload time</span><strong>{estimate.uploadMinutes < 1 ? '<1 min' : `${Math.ceil(estimate.uploadMinutes)} min`}</strong></div>
        </div>
      </section>

      <section className="fallback-section">
        <p className="micro-label">PRODUCTION FALLBACKS</p>
        <h2>Use the simplest tool that passes the test.</h2>
        <div className="fallback-list">
          <a href="https://obsproject.com/" target="_blank" rel="noreferrer"><span><strong>OBS Studio</strong><small>Best primary option for controlled, high-quality local recording.</small></span><ExternalLink size={17} /></a>
          <a href="https://screenity.io/" target="_blank" rel="noreferrer"><span><strong>Screenity</strong><small>Quick browser-based capture with screen annotations.</small></span><ExternalLink size={17} /></a>
          <a href="https://support.microsoft.com/en-us/powerpoint/training/save-powerpoint-presentations-as-pdf-files" target="_blank" rel="noreferrer"><span><strong>PowerPoint → PDF</strong><small>Microsoft’s slide-export steps for this recorder’s slide mode.</small></span><ExternalLink size={17} /></a>
          <a href="https://studio.youtube.com" target="_blank" rel="noreferrer"><span><strong>YouTube Studio</strong><small>Upload the verified file when your connection is ready.</small></span><ExternalLink size={17} /></a>
        </div>
      </section>

      <div className="quality-note"><Check size={18} /><p><strong>Recommended starting point:</strong> 1080p at 30 fps. Choose 720p only when a real test shows performance, storage, or upload pressure.</p></div>
    </section>
  )
}

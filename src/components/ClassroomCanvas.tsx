import { useEffect, useRef, type RefObject } from 'react'
import type { BoardLine, ClassroomQuestion } from '@contracts/classroom'
import { drawCameraOverlay, drawSource, wrapCanvasText } from '@/lib/canvasDrawing'

type ClassroomCanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  width: number
  height: number
  paperCanvas: HTMLCanvasElement | null
  paperView: 'page' | 'question'
  paperName: string
  question: ClassroomQuestion | null
  answerLines: BoardLine[]
  writingProgress: number
  writingPlaying: boolean
  busy: string | null
  camera: HTMLVideoElement | null
  cameraVisible: boolean
}

type RenderState = Omit<ClassroomCanvasProps, 'canvasRef' | 'width' | 'height'>

type QuestionLayout = {
  source: ClassroomQuestion
  unit: number
  fontSize: number
  lineHeight: number
  lines: string[]
}

type BoardLayout = {
  source: BoardLine[]
  unit: number
  scale: number
  items: { line: BoardLine; wrapped: string[] }[]
}

function panel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  context.save()
  context.shadowColor = 'rgba(25, 39, 31, .12)'
  context.shadowBlur = 20
  context.shadowOffsetY = 8
  context.fillStyle = '#fffefb'
  context.beginPath()
  context.roundRect(x, y, width, height, 14)
  context.fill()
  context.restore()
}

export default function ClassroomCanvas({ canvasRef, width, height, ...props }: ClassroomCanvasProps) {
  const stateRef = useRef<RenderState>(props)
  const questionLayoutRef = useRef<QuestionLayout | null>(null)
  const boardLayoutRef = useRef<BoardLayout | null>(null)

  useEffect(() => {
    stateRef.current = props
  })

  useEffect(() => {
    let frame = 0
    let lastRender = 0
    const render = (time: number) => {
      if (time - lastRender < 1000 / 30) {
        frame = requestAnimationFrame(render)
        return
      }
      lastRender = time
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      const state = stateRef.current
      if (canvas && context) {
        const unit = width / 1920
        const margin = 38 * unit
        const headerHeight = 68 * unit
        const gap = 24 * unit
        const panelY = margin + headerHeight
        const panelHeight = height - panelY - margin
        const panelWidth = (width - margin * 2 - gap) / 2
        const leftX = margin
        const rightX = margin + panelWidth + gap

        context.fillStyle = '#e9e7df'
        context.fillRect(0, 0, width, height)
        context.fillStyle = '#193d32'
        context.fillRect(0, 0, width, headerHeight + margin * 0.55)
        context.fillStyle = '#f5f2e9'
        context.font = `600 ${18 * unit}px "Geist Sans", sans-serif`
        context.textBaseline = 'middle'
        context.fillText('YOUNG AGRIPRENEURS  /  GUIDED CLASSROOM', margin, (headerHeight + margin * 0.55) / 2)
        context.textAlign = 'right'
        context.font = `500 ${15 * unit}px "Geist Mono", monospace`
        const headerStatus = state.busy === 'questions'
          ? 'READING PAPER…'
          : state.busy === 'answer'
            ? 'PREPARING ANSWER…'
            : state.question
              ? `QUESTION ${state.question.label}`
              : 'READY FOR YOUR PAPER'
        context.fillText(headerStatus, width - margin, (headerHeight + margin * 0.55) / 2)
        context.textAlign = 'left'

        panel(context, leftX, panelY, panelWidth, panelHeight)
        panel(context, rightX, panelY, panelWidth, panelHeight)

        context.fillStyle = '#6f7771'
        context.font = `500 ${13 * unit}px "Geist Mono", monospace`
        context.fillText(
          state.paperView === 'page' ? 'ORIGINAL QUESTION PAPER' : 'EXTRACTED QUESTION',
          leftX + 26 * unit,
          panelY + 34 * unit,
        )
        context.fillText('MEMO / WHITEBOARD', rightX + 26 * unit, panelY + 34 * unit)
        context.fillStyle = '#188257'
        context.beginPath()
        context.arc(rightX + panelWidth - 34 * unit, panelY + 34 * unit, 5 * unit, 0, Math.PI * 2)
        context.fill()

        const contentY = panelY + 70 * unit
        const contentHeight = panelHeight - 96 * unit
        if (state.paperView === 'page' && state.paperCanvas) {
          context.save()
          context.beginPath()
          context.roundRect(leftX + 14 * unit, contentY, panelWidth - 28 * unit, contentHeight, 8 * unit)
          context.clip()
          context.fillStyle = '#f4f2ec'
          context.fillRect(leftX + 14 * unit, contentY, panelWidth - 28 * unit, contentHeight)
          drawSource(context, state.paperCanvas, {
            x: leftX + 20 * unit,
            y: contentY + 8 * unit,
            width: panelWidth - 40 * unit,
            height: contentHeight - 16 * unit,
          })
          context.restore()
        } else if (state.question) {
          const question = state.question
          context.fillStyle = '#173e32'
          context.font = `650 ${31 * unit}px "Geist Sans", sans-serif`
          context.fillText(`Question ${question.label}`, leftX + 30 * unit, contentY + 28 * unit)
          if (question.marks !== null) {
            context.textAlign = 'right'
            context.fillStyle = '#a24f38'
            context.font = `600 ${18 * unit}px "Geist Mono", monospace`
            context.fillText(`[${question.marks} marks]`, leftX + panelWidth - 30 * unit, contentY + 28 * unit)
            context.textAlign = 'left'
          }
          const textX = leftX + 30 * unit
          const textY = contentY + 88 * unit
          const maxWidth = panelWidth - 60 * unit
          const availableTextHeight = contentHeight - 112 * unit
          let layout = questionLayoutRef.current
          if (!layout || layout.source !== question || layout.unit !== unit) {
            let fontSize = 27
            let lineHeight = 42
            let fittedLines: string[] = []
            while (fontSize >= 12) {
              context.font = `400 ${fontSize * unit}px "Geist Sans", sans-serif`
              fittedLines = wrapCanvasText(context, question.prompt, maxWidth)
              lineHeight = fontSize * 1.55
              if (fittedLines.length * lineHeight * unit <= availableTextHeight) break
              fontSize -= 1
            }
            layout = { source: question, unit, fontSize, lineHeight, lines: fittedLines }
            questionLayoutRef.current = layout
          }
          context.font = `400 ${layout.fontSize * unit}px "Geist Sans", sans-serif`
          context.fillStyle = '#26372f'
          context.textBaseline = 'alphabetic'
          layout.lines.forEach((line, index) => {
            context.fillText(line, textX, textY + index * layout.lineHeight * unit)
          })
          context.textBaseline = 'middle'
          context.fillStyle = '#7d847e'
          context.font = `400 ${13 * unit}px "Geist Mono", monospace`
          context.fillText(
            `${state.paperName || 'Practice question'}${question.page ? `  ·  PAGE ${question.page}` : ''}  ·  CHECK AGAINST ORIGINAL`,
            leftX + 30 * unit,
            panelY + panelHeight - 26 * unit,
          )
        } else {
          context.fillStyle = '#7a837d'
          context.font = `400 ${24 * unit}px "Geist Sans", sans-serif`
          const emptyLines = wrapCanvasText(context, 'Upload a question paper, then choose Read paper. You can also show the original page here.', panelWidth - 90 * unit)
          emptyLines.forEach((line, index) => context.fillText(line, leftX + 36 * unit, contentY + 70 * unit + index * 40 * unit))
        }

        context.save()
        context.beginPath()
        context.roundRect(rightX + 14 * unit, contentY, panelWidth - 28 * unit, contentHeight, 8 * unit)
        context.clip()
        context.fillStyle = '#fbfaf4'
        context.fillRect(rightX + 14 * unit, contentY, panelWidth - 28 * unit, contentHeight)
        context.strokeStyle = 'rgba(35, 104, 74, .065)'
        context.lineWidth = 1 * unit
        for (let y = contentY + 56 * unit; y < contentY + contentHeight; y += 58 * unit) {
          context.beginPath()
          context.moveTo(rightX + 20 * unit, y)
          context.lineTo(rightX + panelWidth - 20 * unit, y)
          context.stroke()
        }

        if (!state.answerLines.length) {
          context.fillStyle = '#8a918a'
          context.font = `400 ${23 * unit}px "Geist Sans", sans-serif`
          const empty = wrapCanvasText(context, 'The answer stays hidden until you choose “Give answer”.', panelWidth - 100 * unit)
          empty.forEach((line, index) => context.fillText(line, rightX + 42 * unit, contentY + 72 * unit + index * 40 * unit))
        } else {
          const maxTextWidth = panelWidth - 84 * unit
          let boardLayout = boardLayoutRef.current
          if (!boardLayout || boardLayout.source !== state.answerLines || boardLayout.unit !== unit) {
            let scale = 1
            let items: { line: BoardLine; wrapped: string[] }[] = []
            while (scale >= 0.55) {
              items = state.answerLines.map((line) => {
                const fontSize = (line.kind === 'result' ? 34 : 30) * scale * unit
                context.font = `${line.kind === 'result' ? '700' : line.kind === 'note' ? 'italic 500' : '500'} ${fontSize}px "Segoe Print", "Comic Sans MS", cursive`
                return { line, wrapped: wrapCanvasText(context, line.text, maxTextWidth) }
              })
              const requiredHeight = items.reduce((total, item) => (
                total + item.wrapped.length * 47 * scale * unit + (item.line.kind === 'result' ? 19 : 12) * scale * unit
              ), 54 * unit)
              if (requiredHeight <= contentHeight - 24 * unit) break
              scale = Math.max(0.55, scale - 0.05)
            }
            boardLayout = { source: state.answerLines, unit, scale, items }
            boardLayoutRef.current = boardLayout
          }
          const boardScale = boardLayout.scale
          let characterOffset = 0
          let lineY = contentY + 54 * unit
          let pen: { x: number; y: number } | null = null
          for (const item of boardLayout.items) {
            const boardLine = item.line
            const wrapped = item.wrapped
            const fontSize = (boardLine.kind === 'result' ? 34 : 30) * boardScale * unit
            context.font = `${boardLine.kind === 'result' ? '700' : boardLine.kind === 'note' ? 'italic 500' : '500'} ${fontSize}px "Segoe Print", "Comic Sans MS", cursive`
            let consumed = 0
            for (const visualLine of wrapped) {
              if (lineY > contentY + contentHeight - 32 * unit) break
              const segmentStart = characterOffset + consumed
              const visible = Math.max(0, Math.min(visualLine.length, state.writingProgress - segmentStart))
              const shown = visualLine.slice(0, visible)
              context.fillStyle = boardLine.kind === 'result' ? '#08643f' : boardLine.kind === 'note' ? '#48735c' : '#168057'
              context.textBaseline = 'alphabetic'
              context.fillText(shown, rightX + 42 * unit, lineY)
              if (visible > 0 && visible < visualLine.length) {
                pen = { x: rightX + 42 * unit + context.measureText(shown).width + 8 * unit, y: lineY - 8 * unit }
              }
              if (boardLine.kind === 'result' && visible === visualLine.length) {
                context.save()
                context.strokeStyle = '#168057'
                context.lineWidth = 2.2 * boardScale * unit
                context.beginPath()
                context.moveTo(rightX + 40 * unit, lineY + 10 * unit)
                context.lineTo(rightX + 46 * unit + context.measureText(visualLine).width, lineY + 10 * unit)
                context.stroke()
                context.restore()
              }
              consumed += visualLine.length + 1
              lineY += 47 * boardScale * unit
            }
            characterOffset += boardLine.text.length
            lineY += (boardLine.kind === 'result' ? 19 : 12) * boardScale * unit
          }
          if (!pen && state.writingPlaying && state.writingProgress === 0) {
            pen = { x: rightX + 42 * unit, y: contentY + 46 * unit }
          }
          if (pen && state.writingPlaying) {
            const pulse = 1 + Math.sin(time / 130) * 0.12
            context.save()
            context.fillStyle = '#112e24'
            context.shadowColor = 'rgba(22,128,87,.35)'
            context.shadowBlur = 12 * unit
            context.beginPath()
            context.arc(pen.x, pen.y, 5 * unit * pulse, 0, Math.PI * 2)
            context.fill()
            context.restore()
          }
        }
        context.restore()

        context.fillStyle = state.question?.answerGrounded ? '#287252' : '#8a6b50'
        context.font = `500 ${12 * unit}px "Geist Mono", monospace`
        context.fillText(
          state.question?.answerGrounded ? 'GROUNDED IN UPLOADED MEMO' : 'AI DRAFT · TEACHER CHECK REQUIRED',
          rightX + 28 * unit,
          panelY + panelHeight - 24 * unit,
        )
        context.textAlign = 'right'
        const writingStatus = state.writingPlaying
          ? 'WRITING…'
          : state.answerLines.length && state.writingProgress > 0
            ? 'PAUSED / COMPLETE'
            : 'ANSWER HIDDEN'
        context.fillText(writingStatus, rightX + panelWidth - 28 * unit, panelY + panelHeight - 24 * unit)
        context.textAlign = 'left'

        if (state.cameraVisible) drawCameraOverlay(context, state.camera, width, height)
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="lesson-canvas classroom-canvas"
      aria-label="Interactive split classroom. The question paper is on the left and the animated green-pen memo board is on the right."
    />
  )
}

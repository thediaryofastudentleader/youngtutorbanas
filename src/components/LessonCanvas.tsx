import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { drawCameraOverlay, drawSource } from '@/lib/canvasDrawing'

export type InkTool = 'pen' | 'highlighter'
export type Point = { x: number; y: number }
export type Stroke = { tool: InkTool; points: Point[] }

type LessonCanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  source: CanvasImageSource | null
  width: number
  height: number
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
  tool: InkTool
  sourceLabel: string
  camera?: HTMLVideoElement | null
  cameraVisible?: boolean
  mirrorSource?: boolean
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
) {
  if (!stroke.points.length) return
  context.save()
  context.strokeStyle = stroke.tool === 'pen' ? '#ff6b4a' : '#ffe45c'
  context.lineWidth = (stroke.tool === 'pen' ? 5 : 24) * (height / 1080)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.globalAlpha = stroke.tool === 'pen' ? 1 : 0.38
  context.beginPath()
  context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height)
  stroke.points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height))
  if (stroke.points.length === 1) context.lineTo(stroke.points[0].x * width + 0.01, stroke.points[0].y * height)
  context.stroke()
  context.restore()
}

export default function LessonCanvas({
  canvasRef,
  source,
  width,
  height,
  strokes,
  onStrokesChange,
  tool,
  sourceLabel,
  camera = null,
  cameraVisible = false,
  mirrorSource = false,
}: LessonCanvasProps) {
  const sourceRef = useRef(source)
  const strokesRef = useRef(strokes)
  const cameraRef = useRef(camera)
  const cameraVisibleRef = useRef(cameraVisible)
  const mirrorSourceRef = useRef(mirrorSource)
  const activeStroke = useRef<Stroke | null>(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    sourceRef.current = source
  }, [source])

  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])

  useEffect(() => {
    cameraRef.current = camera
    cameraVisibleRef.current = cameraVisible
    mirrorSourceRef.current = mirrorSource
  }, [camera, cameraVisible, mirrorSource])

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
      if (canvas && context) {
        context.fillStyle = '#111915'
        context.fillRect(0, 0, width, height)
        const currentSource = sourceRef.current
        if (currentSource) {
          drawSource(context, currentSource, { x: 0, y: 0, width, height }, { mirror: mirrorSourceRef.current })
        } else {
          context.fillStyle = '#aeb9b0'
          context.font = `${Math.round(height / 30)}px "Geist Mono", monospace`
          context.textAlign = 'center'
          context.fillText('Preparing your lesson source…', width / 2, height / 2)
        }
        strokesRef.current.forEach((stroke) => drawStroke(context, stroke, width, height))
        if (activeStroke.current) drawStroke(context, activeStroke.current, width, height)
        if (cameraVisibleRef.current) drawCameraOverlay(context, cameraRef.current, width, height)
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, width, height])

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    }
  }

  function startStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    activeStroke.current = { tool, points: [pointFromEvent(event)] }
    setDrawing(true)
  }

  function continueStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!activeStroke.current) return
    activeStroke.current.points.push(pointFromEvent(event))
  }

  function finishStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!activeStroke.current) return
    activeStroke.current.points.push(pointFromEvent(event))
    const completed = activeStroke.current
    activeStroke.current = null
    setDrawing(false)
    onStrokesChange([...strokesRef.current, completed])
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`lesson-canvas ${drawing ? 'is-drawing' : ''}`}
      aria-label={`${sourceLabel}. Draw with the selected pen or highlighter.`}
      onPointerDown={startStroke}
      onPointerMove={continueStroke}
      onPointerUp={finishStroke}
      onPointerCancel={() => {
        activeStroke.current = null
        setDrawing(false)
      }}
    />
  )
}

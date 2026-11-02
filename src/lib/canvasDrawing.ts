export type Rect = { x: number; y: number; width: number; height: number }

export function sourceSize(source: CanvasImageSource) {
  const candidate = source as HTMLVideoElement & HTMLImageElement & HTMLCanvasElement
  return {
    width: candidate.videoWidth || candidate.naturalWidth || candidate.width,
    height: candidate.videoHeight || candidate.naturalHeight || candidate.height,
  }
}

export function drawSource(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  rect: Rect,
  options: { cover?: boolean; mirror?: boolean } = {},
) {
  const dimensions = sourceSize(source)
  if (!dimensions.width || !dimensions.height) return
  const scale = options.cover
    ? Math.max(rect.width / dimensions.width, rect.height / dimensions.height)
    : Math.min(rect.width / dimensions.width, rect.height / dimensions.height)
  const drawWidth = dimensions.width * scale
  const drawHeight = dimensions.height * scale
  context.save()
  if (options.mirror) {
    context.translate(rect.x + rect.width / 2, 0)
    context.scale(-1, 1)
    context.translate(-(rect.x + rect.width / 2), 0)
  }
  context.drawImage(
    source,
    rect.x + (rect.width - drawWidth) / 2,
    rect.y + (rect.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
  context.restore()
}

function roundedRect(context: CanvasRenderingContext2D, rect: Rect, radius: number) {
  context.beginPath()
  context.roundRect(rect.x, rect.y, rect.width, rect.height, radius)
}

export function drawCameraOverlay(
  context: CanvasRenderingContext2D,
  camera: HTMLVideoElement | null,
  canvasWidth: number,
  canvasHeight: number,
) {
  if (!camera || camera.readyState < 2) return
  const width = canvasWidth * 0.19
  const height = width * 0.5625
  const rect = {
    x: canvasWidth - width - canvasWidth * 0.025,
    y: canvasHeight - height - canvasHeight * 0.035,
    width,
    height,
  }
  context.save()
  context.shadowColor = 'rgba(0,0,0,.35)'
  context.shadowBlur = canvasWidth * 0.012
  roundedRect(context, rect, canvasWidth * 0.009)
  context.fillStyle = '#17221c'
  context.fill()
  context.shadowColor = 'transparent'
  context.clip()
  drawSource(context, camera, rect, { cover: true, mirror: true })
  context.restore()
  context.save()
  roundedRect(context, rect, canvasWidth * 0.009)
  context.strokeStyle = 'rgba(255,255,255,.78)'
  context.lineWidth = Math.max(2, canvasWidth * 0.0015)
  context.stroke()
  context.restore()
}

export function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let line = words[0]
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }
  return lines
}

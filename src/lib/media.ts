import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export type PdfDocument = pdfjs.PDFDocumentProxy

export async function openPdf(file: File) {
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
}

export async function renderPdfPage(document: PdfDocument, pageNumber: number, targetWidth = 1920) {
  const page = await document.getPage(pageNumber)
  const initial = page.getViewport({ scale: 1 })
  const scale = Math.min(2.5, targetWidth / initial.width)
  const viewport = page.getViewport({ scale })
  const canvas = window.document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('This browser could not create a slide canvas.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas: null, canvasContext: context, viewport }).promise
  return canvas
}

export async function extractPdfText(document: PdfDocument) {
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      text += item.str
      text += item.hasEOL ? '\n' : ' '
    }
    pages.push(text.replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').trim())
  }
  return pages
}

export async function fileToCanvas(file: File, maxDimension = 1920) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = window.document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    bitmap.close()
    throw new Error('This browser could not read the image.')
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

export function canvasImageData(canvas: HTMLCanvasElement, maxDimension = 1500) {
  let output = canvas
  if (Math.max(canvas.width, canvas.height) > maxDimension) {
    const scale = maxDimension / Math.max(canvas.width, canvas.height)
    output = window.document.createElement('canvas')
    output.width = Math.round(canvas.width * scale)
    output.height = Math.round(canvas.height * scale)
    output.getContext('2d')?.drawImage(canvas, 0, 0, output.width, output.height)
  }
  return output.toDataURL('image/jpeg', 0.84)
}

export function preferredMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export async function storageStatus() {
  if (!navigator.storage) return { usage: 0, quota: 0, persisted: false, supported: false }
  const [estimate, persisted] = await Promise.all([
    navigator.storage.estimate?.() ?? Promise.resolve({}),
    navigator.storage.persisted?.() ?? Promise.resolve(false),
  ])
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    persisted,
    supported: true,
  }
}

export async function protectStorage() {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist()
}

export function lessonFilename(extension = 'webm') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `Young-Agripreneurs-${timestamp}.${extension}`
}

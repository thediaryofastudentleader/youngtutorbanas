const slides = [
  {
    kicker: 'YOUNG AGRIPRENEURS · GRADE 12',
    title: 'Agricultural Sciences',
    subtitle: 'Past-paper workshop · record, verify, then share',
    footer: 'SAMPLE DECK  /  01',
    kind: 'title',
  },
  {
    kicker: 'PAST-PAPER STRATEGY',
    title: 'Read for the instruction',
    subtitle: 'Underline the command word. Identify the given values. Show every step of the calculation.',
    footer: 'SAMPLE DECK  /  02',
    kind: 'steps',
  },
  {
    kicker: 'BEFORE THE FULL LESSON',
    title: 'Make a 30-second test',
    subtitle: 'Check the slide, your voice and the ink. Play the exported file before you delete any local copy.',
    footer: 'SAMPLE DECK  /  03',
    kind: 'check',
  },
]

function slideSvg(slide: (typeof slides)[number]) {
  const detail = slide.kind === 'title'
    ? `<circle cx="1370" cy="510" r="250" fill="none" stroke="#d97958" stroke-width="2" opacity=".55"/>
       <circle cx="1370" cy="510" r="174" fill="none" stroke="#d97958" stroke-width="2" opacity=".3"/>
       <path d="M1240 570c90-10 125-72 143-175 35 93 94 140 179 145-92 33-147 92-177 184-22-83-67-135-145-154Z" fill="#d97958" opacity=".9"/>`
    : slide.kind === 'steps'
      ? `<g font-family="monospace" font-size="26" fill="#f5f3ec">
          <text x="1110" y="420">01  READ</text><text x="1110" y="510">02  PLAN</text><text x="1110" y="600">03  SOLVE</text>
        </g><path d="M1070 385h330M1070 475h330M1070 565h330" stroke="#728078" opacity=".5"/>`
      : `<g fill="none" stroke="#d97958" stroke-width="5"><rect x="1100" y="380" width="34" height="34"/><rect x="1100" y="480" width="34" height="34"/><rect x="1100" y="580" width="34" height="34"/><path d="m1107 395 10 10 22-29m-32 122 10 10 22-29m-32 122 10 10 22-29"/></g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <rect width="1600" height="900" fill="#17221d"/>
    <path d="M80 100h60M80 100v60M1520 800h-60m60 0v-60" stroke="#d97958" stroke-width="3"/>
    <text x="130" y="180" fill="#d97958" font-family="monospace" font-size="24" letter-spacing="3">${slide.kicker}</text>
    <text x="130" y="405" fill="#f5f3ec" font-family="Arial,sans-serif" font-weight="700" font-size="76">${slide.title}</text>
    <text x="130" y="485" fill="#b8c1b9" font-family="Arial,sans-serif" font-size="31">
      <tspan x="130" dy="0">${slide.subtitle.slice(0, 62)}</tspan>
      ${slide.subtitle.length > 62 ? `<tspan x="130" dy="48">${slide.subtitle.slice(62)}</tspan>` : ''}
    </text>
    ${detail}
    <text x="130" y="790" fill="#89958c" font-family="monospace" font-size="21" letter-spacing="2">${slide.footer}</text>
  </svg>`
}

export const SAMPLE_SLIDES = slides.map(
  (slide) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(slideSvg(slide))}`,
)

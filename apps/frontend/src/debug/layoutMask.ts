// Copy this script and paste it into the browser console to generate the layout mask.
const generateLayoutMask = () => {
  const panelSelectors = [
    { selector: '.board-container',                                      label: 'Chess Board' },
    { selector: '.board-section > div:last-of-type > div:first-child',   label: 'Player Info' },
    { selector: '.right-panel > div:first-child',                        label: 'Opponent Info' },
    { selector: '.board-section > div:last-of-type > div:nth-child(2)',  label: 'Skill Bar' },
    { selector: '.right-panel > div:nth-child(2)',                       label: 'Game Log' },
    { selector: '.right-panel > div:nth-child(3)',                       label: 'Captured Pieces' },
    { selector: '.timer-panel > .timer-circle:last-of-type',             label: 'My Timer' },
    { selector: '.timer-panel > .timer-circle:first-of-type',            label: 'Opponent Timer' },
  ];

  const panels: Array<{ selector: string; label: string; x: number; y: number; w: number; h: number }> = [];
  panelSelectors.forEach(({ selector, label }) => {
    const el = document.querySelector(selector);
    if (!el) { console.warn('Not found: ' + selector + ' for ' + label); return; }
    const r = el.getBoundingClientRect();
    panels.push({ selector, label, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  });

  console.table(panels);

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  panels.forEach(p => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(p.label + ' (' + p.w + 'x' + p.h + ')', p.x + 6, p.y + 18);
  });
  ctx.fillStyle = '#0000ff';
  ctx.font = '11px monospace';
  ctx.fillText(window.innerWidth + 'x' + window.innerHeight, 8, canvas.height - 8);

  const link = document.createElement('a');
  link.download = 'layout-mask-' + window.innerWidth + 'x' + window.innerHeight + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// Immediately execute when pasting into console
generateLayoutMask();

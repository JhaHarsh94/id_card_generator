/**
 * Card export: PNG, PDF and print.
 * ---------------------------------------------------------------------------
 * All three paths start from the SAME rendered DOM node, so what is downloaded
 * is exactly what the administrator sees - no re-layout, no font substitution.
 *
 * The card is rasterised once at EXPORT_SCALE and reused for the PDF and the
 * print window, which keeps the three outputs pixel-identical.
 */

import { toPng } from 'html-to-image';
import { CARD, EXPORT_SCALE } from '../config/cardDesign';

/** Show a failure the admin can act on, never a raw library error. */
function exportError(what) {
  return new Error(`The ${what} could not be generated. Please try again.`);
}

/**
 * Rasterise a card node to a PNG data URL at print resolution.
 * @param {HTMLElement} node  the .idcard element
 */
export async function cardToPngDataUrl(node) {
  if (!node) throw exportError('card image');

  try {
    return await toPng(node, {
      // 856 * 2.5 = 2140px wide, comfortably above 300 DPI for CR80.
      pixelRatio: EXPORT_SCALE,
      cacheBust: true,
      // Cards use background gradients; the browser cache must not serve a
      // stale, pre-fix stylesheet into the export.
      skipFonts: false,
      backgroundColor: '#FFFFFF',
    });
  } catch {
    throw exportError('card image');
  }
}

function safeFilename(member, extension) {
  const id = String(member?.memberId ?? 'card').replace(/[^A-Za-z0-9-]/g, '');
  const name = String(member?.fullName ?? '').trim().replace(/\s+/g, '-');
  const parts = [id, name].filter(Boolean);
  return `${parts.join('_') || 'id-card'}.${extension}`;
}

function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** High-resolution PNG download. */
export async function downloadCardPng(node, member) {
  const url = await cardToPngDataUrl(node);
  triggerDownload(url, safeFilename(member, 'png'));
  return url;
}

/**
 * Print-ready PDF at the exact physical card size.
 *
 * jsPDF's unit is chosen so 1 unit == 1 mm, giving a 85.60 x 53.98 mm page -
 * i.e. a true CR80 card that prints at 100% with no scaling.
 */
export async function downloadCardPdf(node, member) {
  const dataUrl = await cardToPngDataUrl(node);

  // Imported lazily: jsPDF is large and most sessions never export a card,
  // so it should not sit in the initial bundle.
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [CARD.widthMM, CARD.heightMM],
    compress: true,
  });

  // 0.5mm bleed on each side absorbs printer edge and rounding error.
  const bleed = 0.5;
  doc.addImage(
    dataUrl,
    'PNG',
    -bleed,
    -bleed,
    CARD.widthMM + bleed * 2,
    CARD.heightMM + bleed * 2,
  );

  doc.save(safeFilename(member, 'pdf'));
}

/**
 * Print a single card.
 *
 * A dedicated print window containing only the card image is used rather than a
 * global print stylesheet, so the dashboard, sidebar and buttons can never leak
 * into the output and the page size cannot be perturbed by app layout.
 */
export async function printCard(node, member, { organization } = {}) {
  const dataUrl = await cardToPngDataUrl(node);

  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) {
    throw new Error('The print window was blocked. Allow pop-ups for this site and try again.');
  }

  const title = String(member?.fullName ?? 'ID card');
  const org = String(organization?.name ?? '');

  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} - ${escapeHtml(org)}</title>
    <style>
      @page { size: ${CARD.widthMM}mm ${CARD.heightMM}mm; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${CARD.widthMM}mm; height: ${CARD.heightMM}mm; }
      body {
        display: grid;
        place-items: center;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      img {
        display: block;
        width: ${CARD.widthMM}mm;
        height: ${CARD.heightMM}mm;
        object-fit: fill;
      }
      @media screen {
        body { padding: 24px; background: #eceef4; }
        img { box-shadow: 0 10px 30px rgba(0,0,0,.25); }
      }
    </style>
  </head>
  <body>
    <img src="${dataUrl}" alt="${escapeHtml(title)}" onload="setTimeout(function(){window.focus();window.print()},120)" />
  </body>
</html>`);

  win.document.close();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Combined PDF for several cards, laid out 2x2 on A4.
 * Used by bulk generation (Phase 14).
 * @param {HTMLElement[]} nodes
 */
export async function downloadCardsCombinedPdf(nodes, members, organization) {
  if (!nodes?.length) throw exportError('combined PDF');

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const pageH = 297;
  const gap = 6;
  const margin = 10;
  const cardW = CARD.widthMM;
  const cardH = CARD.heightMM;

  const columns = Math.max(1, Math.floor((pageW - margin * 2 + gap) / (cardW + gap)));
  const rows = Math.max(1, Math.floor((pageH - margin * 2 + gap) / (cardH + gap)));
  const perPage = columns * rows;

  const offsetX = (pageW - (columns * cardW + (columns - 1) * gap)) / 2;
  const offsetY = (pageH - (rows * cardH + (rows - 1) * gap)) / 2;

  for (let i = 0; i < nodes.length; i += 1) {
    const page = Math.floor(i / perPage);
    if (page > 0) doc.addPage();

    const col = (i % perPage) % columns;
    const row = Math.floor((i % perPage) / columns);

    // Yield to the browser periodically so a large batch does not freeze the UI.
    // eslint-disable-next-line no-await-in-loop
    const img = await cardToPngDataUrl(nodes[i]);
    doc.addImage(
      img,
      'PNG',
      offsetX + col * (cardW + gap),
      offsetY + row * (cardH + gap),
      cardW,
      cardH,
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${String(organization?.idStart ?? 'cards')}_${nodes.length}-cards_${stamp}.pdf`);
}
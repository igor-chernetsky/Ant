import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

export interface CustomPdfSignatureParty {
  label: string;
  orgName?: string | null;
  signedAt?: Date | string | null;
  signatureDataUrl?: string | null;
}

export interface StampCustomPdfSignaturesInput {
  pdfBuffer: Buffer;
  left: CustomPdfSignatureParty;
  right: CustomPdfSignatureParty;
  title?: string;
}

/** Fixed signature block height (points). */
export const CUSTOM_PDF_SIGNATURE_BLOCK_HEIGHT = 168;
const MARGIN = 40;
const COL_GAP = 24;
const TITLE_SIZE = 12;
const LABEL_SIZE = 9;
const BODY_SIZE = 10;
const LINE_COLOR = rgb(0.25, 0.3, 0.38);
const TEXT_COLOR = rgb(0.12, 0.16, 0.22);
const MUTED_COLOR = rgb(0.4, 0.45, 0.52);

function toWinAnsiSafe(text: string): string {
  return text
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 0x20 && code <= 0x7e) return ch;
      if (code >= 0xa0 && code <= 0xff) return ch;
      return '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatSignedDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function embedSignatureImage(
  pdfDoc: PDFDocument,
  dataUrl: string | null | undefined,
) {
  if (!dataUrl?.trim()) return null;
  const match = /^data:(image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) return null;
  const mime = match[1]!.toLowerCase();
  const bytes = Buffer.from(match[2]!.replace(/\s+/g, ''), 'base64');
  try {
    if (mime.includes('png')) {
      return await pdfDoc.embedPng(bytes);
    }
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function drawPartyColumn(params: {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  x: number;
  yTop: number;
  width: number;
  party: CustomPdfSignatureParty;
  image: Awaited<ReturnType<typeof embedSignatureImage>>;
}) {
  const { page, font, bold, x, width, party, image } = params;
  let y = params.yTop;

  page.drawText(toWinAnsiSafe(party.label) || 'Party', {
    x,
    y,
    size: LABEL_SIZE,
    font: bold,
    color: MUTED_COLOR,
  });
  y -= 14;

  const org = toWinAnsiSafe(party.orgName?.trim() ?? '');
  if (org) {
    page.drawText(org.slice(0, 48), {
      x,
      y,
      size: BODY_SIZE,
      font: bold,
      color: TEXT_COLOR,
    });
    y -= 16;
  } else {
    y -= 4;
  }

  const imageHeight = 36;
  const imageWidth = Math.min(width, 140);
  if (image) {
    const dims = image.scale(
      Math.min(imageWidth / image.width, imageHeight / image.height),
    );
    page.drawImage(image, {
      x,
      y: y - dims.height,
      width: dims.width,
      height: dims.height,
    });
    y -= imageHeight + 4;
  } else {
    page.drawLine({
      start: { x, y: y - 8 },
      end: { x: x + width, y: y - 8 },
      thickness: 0.8,
      color: LINE_COLOR,
    });
    y -= 20;
  }

  page.drawText('Signature', {
    x,
    y,
    size: LABEL_SIZE,
    font,
    color: MUTED_COLOR,
  });
  y -= 16;

  const signed = formatSignedDate(party.signedAt);
  if (signed) {
    page.drawText(signed, {
      x,
      y,
      size: BODY_SIZE,
      font,
      color: TEXT_COLOR,
    });
  } else {
    page.drawLine({
      start: { x, y: y + 2 },
      end: { x: x + Math.min(width, 120), y: y + 2 },
      thickness: 0.8,
      color: LINE_COLOR,
    });
  }
  y -= 12;
  page.drawText('Date', {
    x,
    y,
    size: LABEL_SIZE,
    font,
    color: MUTED_COLOR,
  });
}

function drawSignatureBlock(params: {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  left: CustomPdfSignatureParty;
  right: CustomPdfSignatureParty;
  leftImage: Awaited<ReturnType<typeof embedSignatureImage>>;
  rightImage: Awaited<ReturnType<typeof embedSignatureImage>>;
  title: string;
  originY: number;
}) {
  const { page, font, bold, left, right, leftImage, rightImage, title } =
    params;
  const { width } = page.getSize();
  const contentWidth = width - MARGIN * 2;
  const colWidth = (contentWidth - COL_GAP) / 2;
  let y = params.originY + CUSTOM_PDF_SIGNATURE_BLOCK_HEIGHT - 18;

  page.drawText(toWinAnsiSafe(title) || 'Signatures', {
    x: MARGIN,
    y,
    size: TITLE_SIZE,
    font: bold,
    color: TEXT_COLOR,
  });
  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 0.6,
    color: LINE_COLOR,
  });
  y -= 18;

  drawPartyColumn({
    page,
    font,
    bold,
    x: MARGIN,
    yTop: y,
    width: colWidth,
    party: left,
    image: leftImage,
  });
  drawPartyColumn({
    page,
    font,
    bold,
    x: MARGIN + colWidth + COL_GAP,
    yTop: y,
    width: colWidth,
    party: right,
    image: rightImage,
  });
}

/**
 * Append a signature block on a dedicated new page.
 * Never draw on the last content page — addenda/contracts often already end
 * with an empty Signatures section, and we cannot reliably measure free space.
 */
export async function stampCustomPdfSignatures(
  input: StampCustomPdfSignaturesInput,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(input.pdfBuffer, {
    ignoreEncryption: true,
  });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const leftImage = await embedSignatureImage(
    pdfDoc,
    input.left.signatureDataUrl,
  );
  const rightImage = await embedSignatureImage(
    pdfDoc,
    input.right.signatureDataUrl,
  );
  const title = input.title?.trim() || 'Signatures';

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage?.getSize() ?? { width: 595, height: 842 };
  const needed = CUSTOM_PDF_SIGNATURE_BLOCK_HEIGHT + MARGIN * 2;
  const target = pdfDoc.addPage([width, Math.max(height, needed)]);

  drawSignatureBlock({
    page: target,
    font,
    bold,
    left: input.left,
    right: input.right,
    leftImage,
    rightImage,
    title,
    originY: MARGIN,
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

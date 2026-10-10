/**
 * Invoice PDF — docs/17-ROADMAP-PHASES.md Phase 7's "invoice PDF
 * generation." Rendered on demand from a real `OrderDetail` (never
 * pre-rendered/stored via S3 — that decision was made explicitly for this
 * pass: an `Invoice` row and object-storage caching are real future work,
 * not something this file fakes with a TODO).
 *
 * Deliberately plain: no logo, no letterhead, no colour — `pdf-lib` draws
 * raw text at hand-placed coordinates rather than through a layout engine,
 * since this is the only PDF this codebase generates so far and doesn't
 * justify pulling in a heavier templating layer. Visual polish (branding,
 * a real letterhead, multi-page item overflow handling beyond the simple
 * wrap below) is future work, flagged rather than faked.
 */
import "server-only";
// fontkit's Devanagari shaper is compiled with regenerator-style generators
// and expects this runtime as a global; without it, embedding fails.
import "regenerator-runtime/runtime";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatNPR } from "@/lib/money";
import { STORE_INVOICE_DETAILS } from "@/config/store";
import { NOTO_SANS_DEVANAGARI_BASE64 } from "./fonts/noto-sans-devanagari";
import type { OrderDetail } from "./order-lookup";

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.48);

interface Cursor {
  page: PDFPage;
  y: number;
}

/**
 * The PDF's standard Helvetica only covers Western characters, so the
 * Devanagari in a Nepali name or address (and the "रु" sign) would crash
 * the renderer. Text is split into Devanagari and non-Devanagari runs, and
 * each run is drawn in a font that has its glyphs.
 */
interface Fonts {
  latin: PDFFont;
  latinBold: PDFFont;
  devanagari: PDFFont;
}

const DEVANAGARI_RUN = /(\p{Script_Extensions=Devanagari}+)/u;
// Zero-width joiners only steer ligatures; dropping them keeps a run whole.
const ZERO_WIDTH_JOINERS = /\u200C|\u200D/g;

function runs(text: string, fonts: Fonts, bold: boolean): { text: string; font: PDFFont }[] {
  return text
    .replace(ZERO_WIDTH_JOINERS, "")
    .split(DEVANAGARI_RUN)
    .filter((part) => part.length > 0)
    .map((part) =>
      DEVANAGARI_RUN.test(part)
        ? { text: part, font: fonts.devanagari }
        : { text: toWinAnsi(part), font: bold ? fonts.latinBold : fonts.latin },
    );
}

/** Anything else Helvetica can't encode (emoji, other scripts) becomes "?" instead of crashing. */
function toWinAnsi(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2022\u2026]/gu, "?");
}

function textWidth(text: string, fonts: Fonts, size: number, bold = false): number {
  return runs(text, fonts, bold).reduce(
    (sum, run) => sum + run.font.widthOfTextAtSize(run.text, size),
    0,
  );
}

function drawText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    fonts: Fonts;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
  },
): void {
  let x = options.x;
  for (const run of runs(text, options.fonts, options.bold ?? false)) {
    page.drawText(run.text, {
      x,
      y: options.y,
      size: options.size,
      font: run.font,
      color: options.color ?? INK,
    });
    x += run.font.widthOfTextAtSize(run.text, options.size);
  }
}

/** "Rs. 79,900" — the usual form on Nepali bills, and plain ASCII. */
function money(paisa: number): string {
  return `Rs. ${formatNPR(paisa, { showSign: false })}`;
}

function truncateToWidth(text: string, fonts: Fonts, size: number, maxWidth: number): string {
  if (textWidth(text, fonts, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && textWidth(`${cut}...`, fonts, size) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

/** Builds the invoice as raw PDF bytes — callers (the `/order/[orderNumber]` download action) decide how to deliver them (this pass returns them base64-encoded through a Server Action rather than a streamed route, see that action's own doc comment). */
export interface InvoiceShopDetails {
  legalName: string;
  address: string;
  panVatNumber: string;
}

export async function renderInvoicePdf(
  detail: OrderDetail,
  shop: InvoiceShopDetails = STORE_INVOICE_DETAILS,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fonts: Fonts = {
    latin: await pdfDoc.embedFont(StandardFonts.Helvetica),
    latinBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    devanagari: await pdfDoc.embedFont(Buffer.from(NOTO_SANS_DEVANAGARI_BASE64, "base64"), {
      subset: true,
    }),
  };

  const cursor: Cursor = { page, y: PAGE_HEIGHT - MARGIN };
  const line = (
    text: string,
    size: number,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) => {
    drawText(page, text, { x: MARGIN, y: cursor.y, size, fonts, ...opts });
    cursor.y -= size * 1.5;
  };
  const right = (text: string, y: number, size: number, bold = false) => {
    const width = textWidth(text, fonts, size, bold);
    drawText(page, text, { x: PAGE_WIDTH - MARGIN - width, y, size, fonts, bold });
  };

  line(shop.legalName, 18, { bold: true });
  line(shop.address, 10, { color: MUTED });
  if (shop.panVatNumber) line(`PAN/VAT No. ${shop.panVatNumber}`, 10, { color: MUTED });
  cursor.y -= 10;
  line(shop.panVatNumber ? "TAX INVOICE" : "INVOICE", 13, { bold: true });
  cursor.y -= 4;
  line(`Order ${detail.orderNumber}`, 11);
  line(`Date: ${detail.placedAt.toISOString().slice(0, 10)}`, 10, { color: MUTED });
  cursor.y -= 10;

  const shipping = detail.addresses.find((a) => a.type === "SHIPPING");
  const billing = detail.addresses.find((a) => a.type === "BILLING") ?? shipping;
  if (billing) {
    line("Bill to", 11, { bold: true });
    line(billing.fullName, 10);
    line(billing.phone, 10);
    line(
      `${billing.streetAddress}, ${billing.municipality}${billing.ward ? ` (Ward ${billing.ward})` : ""}, ${billing.district}`,
      10,
    );
    cursor.y -= 10;
  }

  // Item table header.
  const COL_QTY = 330;
  const COL_UNIT = 380;
  const header = cursor.y;
  drawText(page, "Item", { x: MARGIN, y: header, size: 10, fonts, bold: true });
  drawText(page, "Qty", { x: COL_QTY, y: header, size: 10, fonts, bold: true });
  drawText(page, "Unit price", { x: COL_UNIT, y: header, size: 10, fonts, bold: true });
  right("Amount", header, 10, true);
  cursor.y -= 18;

  for (const item of detail.items) {
    const label = item.variantLabel
      ? `${item.productName} - ${item.variantLabel}`
      : item.productName;
    drawText(page, truncateToWidth(label, fonts, 10, COL_QTY - MARGIN - 10), {
      x: MARGIN,
      y: cursor.y,
      size: 10,
      fonts,
    });
    drawText(page, String(item.quantity), { x: COL_QTY, y: cursor.y, size: 10, fonts });
    drawText(page, money(item.unitPricePaisa), { x: COL_UNIT, y: cursor.y, size: 10, fonts });
    right(money(item.lineTotalPaisa), cursor.y, 10);
    cursor.y -= 16;
  }

  cursor.y -= 10;
  page.drawLine({
    start: { x: MARGIN, y: cursor.y },
    end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
    thickness: 0.5,
    color: MUTED,
  });
  cursor.y -= 20;

  // `formatNPR` rejects negative paisa (money is always non-negative per
  // `lib/money.ts`'s own invariant) — a discount row formats the positive
  // magnitude and prefixes "-" itself.
  const totalsRow = (
    label: string,
    amountPaisa: number,
    options: { emphasise?: boolean; negative?: boolean } = {},
  ) => {
    drawText(page, label, { x: COL_UNIT, y: cursor.y, size: 10, fonts, bold: options.emphasise });
    right(`${options.negative ? "-" : ""}${money(amountPaisa)}`, cursor.y, 10, options.emphasise);
    cursor.y -= 16;
  };

  totalsRow("Subtotal", detail.totals.subtotalPaisa);
  if (detail.totals.discountPaisa > 0)
    totalsRow("Discount", detail.totals.discountPaisa, { negative: true });
  totalsRow("Delivery", detail.totals.shippingPaisa);
  totalsRow("Total", detail.totals.totalPaisa, { emphasise: true });
  drawText(page, `Includes VAT (13%): ${money(detail.totals.taxPaisa)}`, {
    x: COL_UNIT,
    y: cursor.y,
    size: 9,
    fonts,
    color: MUTED,
  });
  cursor.y -= 18;
  totalsRow("Paid", detail.totals.paidPaisa);

  cursor.y -= 20;
  if (detail.payment) {
    line(
      `Payment method: ${detail.payment.provider === "COD" ? "Cash on Delivery" : "Bank Transfer"}`,
      10,
      { color: MUTED },
    );
  }
  line("Thank you for shopping with us.", 10, { color: MUTED });

  return pdfDoc.save();
}

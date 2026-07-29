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
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatNPR } from "@/lib/money";
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

function line(cursor: Cursor, text: string, font: PDFFont, size: number, color = INK): void {
  cursor.page.drawText(text, { x: MARGIN, y: cursor.y, size, font, color });
  cursor.y -= size * 1.5;
}

function lineRight(cursor: Cursor, text: string, font: PDFFont, size: number, color = INK): void {
  const width = font.widthOfTextAtSize(text, size);
  cursor.page.drawText(text, { x: PAGE_WIDTH - MARGIN - width, y: cursor.y, size, font, color });
}

/** Builds the invoice as raw PDF bytes — callers (the `/order/[orderNumber]` download action) decide how to deliver them (this pass returns them base64-encoded through a Server Action rather than a streamed route, see that action's own doc comment). */
export async function renderInvoicePdf(detail: OrderDetail): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const cursor: Cursor = { page, y: PAGE_HEIGHT - MARGIN };

  line(cursor, "City Computer Systems", bold, 18);
  line(cursor, "Kathmandu, Nepal", font, 10, MUTED);
  cursor.y -= 10;
  line(cursor, "TAX INVOICE", bold, 13);
  cursor.y -= 4;
  line(cursor, `Order ${detail.orderNumber}`, font, 11);
  line(cursor, `Placed ${detail.placedAt.toISOString().slice(0, 10)}`, font, 10, MUTED);
  line(cursor, `Status: ${detail.rawStatus}`, font, 10, MUTED);
  cursor.y -= 10;

  const shipping = detail.addresses.find((a) => a.type === "SHIPPING");
  const billing = detail.addresses.find((a) => a.type === "BILLING") ?? shipping;
  if (billing) {
    line(cursor, "Bill to", bold, 11);
    line(cursor, billing.fullName, font, 10);
    line(cursor, billing.phone, font, 10);
    line(
      cursor,
      `${billing.streetAddress}, ${billing.municipality}${billing.ward ? ` (Ward ${billing.ward})` : ""}, ${billing.district}`,
      font,
      10,
    );
    cursor.y -= 10;
  }

  // Item table header.
  line(cursor, "Item", bold, 10);
  cursor.y += 15; // header line already advanced the cursor; place qty/price/total on the same row.
  page.drawText("Qty", { x: 340, y: cursor.y, size: 10, font: bold, color: INK });
  page.drawText("Unit price", { x: 400, y: cursor.y, size: 10, font: bold, color: INK });
  page.drawText("Line total", { x: 490, y: cursor.y, size: 10, font: bold, color: INK });
  cursor.y -= 18;

  for (const item of detail.items) {
    const label = item.variantLabel
      ? `${item.productName} — ${item.variantLabel}`
      : item.productName;
    page.drawText(label.slice(0, 48), { x: MARGIN, y: cursor.y, size: 10, font, color: INK });
    page.drawText(String(item.quantity), { x: 340, y: cursor.y, size: 10, font, color: INK });
    page.drawText(formatNPR(item.unitPricePaisa), {
      x: 400,
      y: cursor.y,
      size: 10,
      font,
      color: INK,
    });
    page.drawText(formatNPR(item.lineTotalPaisa), {
      x: 490,
      y: cursor.y,
      size: 10,
      font,
      color: INK,
    });
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
  // magnitude and prefixes "-" itself, same convention as
  // `OrderSummaryPanel`'s own discount line.
  const totalsRow = (
    label: string,
    amountPaisa: number,
    options: { emphasise?: boolean; negative?: boolean } = {},
  ) => {
    const f = options.emphasise ? bold : font;
    page.drawText(label, { x: 400, y: cursor.y, size: 10, font: f, color: INK });
    const formatted = `${options.negative ? "-" : ""}${formatNPR(amountPaisa)}`;
    lineRight({ page, y: cursor.y }, formatted, f, 10);
    cursor.y -= 16;
  };

  totalsRow("Subtotal", detail.totals.subtotalPaisa);
  if (detail.totals.discountPaisa > 0)
    totalsRow("Discount", detail.totals.discountPaisa, { negative: true });
  totalsRow("Shipping", detail.totals.shippingPaisa);
  totalsRow("Total", detail.totals.totalPaisa, { emphasise: true });
  line(
    { page, y: cursor.y },
    `Includes VAT (13%): ${formatNPR(detail.totals.taxPaisa)}`,
    font,
    9,
    MUTED,
  );
  cursor.y -= 14;
  totalsRow("Paid", detail.totals.paidPaisa);

  cursor.y -= 20;
  if (detail.payment) {
    line(
      cursor,
      `Payment method: ${detail.payment.provider === "COD" ? "Cash on Delivery" : "Bank Transfer"}`,
      font,
      10,
      MUTED,
    );
  }

  return pdfDoc.save();
}

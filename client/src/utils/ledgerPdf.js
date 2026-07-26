import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDateDisplay, formatNum } from './format'

function money(value) {
  return `Rs ${formatNum(value)}`
}

function downloadPdf(doc, filename) {
  doc.save(filename)
}

/** Simple customer shop ledger PDF */
export function downloadCustomerLedgerPdf({
  routeName,
  shop,
  summary,
  bills,
  payments,
}) {
  const doc = new jsPDF()
  let y = 14

  doc.setFontSize(16)
  doc.text('Qanooni Polymers — Customer Ledger', 14, y)
  y += 8
  doc.setFontSize(11)
  doc.text(`Route: ${routeName || '—'}`, 14, y)
  y += 6
  doc.text(`Shop: ${shop?.shopName || '—'}`, 14, y)
  y += 6
  doc.text(`Owner: ${shop?.ownerName || '—'}  |  Contact: ${shop?.contactNumber || '—'}`, 14, y)
  y += 6
  doc.text(`Address: ${shop?.address || '—'}`, 14, y)
  y += 8
  doc.text(
    `Total Billed: ${money(summary?.totalBilled)}   |   Total Paid: ${money(summary?.totalPaid)}   |   Remaining: ${money(summary?.remaining)}`,
    14,
    y,
  )
  y += 6

  autoTable(doc, {
    startY: y + 2,
    head: [['Date', 'Ordered', 'Bill', 'Status']],
    body: (bills || []).map((bill) => [
      formatDateDisplay(bill.date),
      (bill.lines || []).join('; ') || '—',
      money(bill.amount),
      bill.payStatus === 'paid' ? 'Paid' : bill.payStatus === 'partial' ? 'Partial' : 'Unpaid',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [21, 128, 61] },
  })

  const afterBills = doc.lastAutoTable?.finalY || y + 20
  doc.setFontSize(12)
  doc.text('Payments', 14, afterBills + 10)

  autoTable(doc, {
    startY: afterBills + 12,
    head: [['Date', 'Amount', 'Note']],
    body: (payments || []).map((p) => [
      formatDateDisplay(p.date),
      money(p.amount),
      p.note || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [21, 128, 61] },
  })

  const safeName = String(shop?.shopName || 'shop').replace(/[^\w\-]+/g, '_')
  downloadPdf(doc, `customer-ledger-${safeName}.pdf`)
}

/** Simple supplier purchase/payment ledger PDF */
export function downloadSupplierLedgerPdf({
  supplier,
  summary,
  purchases,
  payments,
}) {
  const doc = new jsPDF()
  let y = 14

  doc.setFontSize(16)
  doc.text('Qanooni Polymers — Supplier Ledger', 14, y)
  y += 8
  doc.setFontSize(11)
  doc.text(`Supplier: ${supplier?.name || '—'}`, 14, y)
  y += 6
  doc.text(`Contact: ${supplier?.contact || '—'}`, 14, y)
  y += 8
  doc.text(
    `Purchased: ${money(summary?.totalPurchased)}   |   Paid: ${money(summary?.totalPaid)}   |   Due: ${money(summary?.remaining)}   |   Advance: ${money(summary?.advance)}`,
    14,
    y,
  )
  y += 6

  autoTable(doc, {
    startY: y + 2,
    head: [['Date', 'Material', 'Bags', 'KG', 'Rate/kg', 'Total', 'Status']],
    body: (purchases || []).map((row) => [
      formatDateDisplay(row.date),
      row.materialName || '—',
      formatNum(row.bags, 0),
      formatNum(row.kg),
      money(row.pricePerKg),
      money(row.totalAmount),
      row.payStatus === 'paid' ? 'Paid' : row.payStatus === 'partial' ? 'Partial' : 'Unpaid',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [21, 128, 61] },
  })

  const afterPurchases = doc.lastAutoTable?.finalY || y + 20
  doc.setFontSize(12)
  doc.text('Payments / Advances', 14, afterPurchases + 10)

  autoTable(doc, {
    startY: afterPurchases + 12,
    head: [['Date', 'Amount', 'Note']],
    body: (payments || []).map((p) => [
      formatDateDisplay(p.date),
      money(p.amount),
      p.note || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [21, 128, 61] },
  })

  const safeName = String(supplier?.name || 'supplier').replace(/[^\w\-]+/g, '_')
  downloadPdf(doc, `supplier-ledger-${safeName}.pdf`)
}

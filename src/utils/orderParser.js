// src/utils/orderParser.js
//
// Parses the structured order number printed on sample barcodes:
//
//   CBT/3801/20-104-06/000631/07/2026-1
//   └┬┘ └┬─┘ └───┬───┘ └──┬─┘ └┬┘ └─┬──┘
//  prefix│   lab segment  no.lab bln thn-sampel
//        └ kode organisasi
//
// Mirrors backend src/utils/order.parser.js (which only extracts the lab
// code) but returns the full breakdown for UI display.

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * @param {string} orderNo
 * @returns {null | {
 *   labCode: string,      // "06"
 *   labNo: string,        // "000631" (as printed)
 *   labNoShort: string,   // "631" (leading zeros stripped)
 *   month: string,        // "07"
 *   monthName: string,    // "Juli"
 *   year: string,         // "2026"
 *   sampleSeq: string,    // "1"
 * }}
 */
export function parseOrderNo(orderNo) {
  if (!orderNo || typeof orderNo !== "string") return null;
  // Tolerant of prefix variations — anchors on the lab segment onward:
  // 20-104-XX / <no.lab> / <MM> / <YYYY>-<seq>
  const m = orderNo
    .trim()
    .match(/20-104-(\d{2})\/(\d+)\/(\d{1,2})\/(\d{4})-(\d+)\s*$/);
  if (!m) return null;

  const [, labCode, labNo, monthRaw, year, sampleSeq] = m;
  const monthIdx = parseInt(monthRaw, 10) - 1;
  return {
    labCode,
    labNo,
    labNoShort: String(parseInt(labNo, 10)),
    month: monthRaw.padStart(2, "0"),
    monthName: MONTH_NAMES[monthIdx] || monthRaw,
    year,
    sampleSeq,
  };
}

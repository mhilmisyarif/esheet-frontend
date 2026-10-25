// src/utils/spreadsheetEngine.js
//
// 2D Spreadsheet engine supporting:
// - Cell coordinate parsing (A1, C2, E7)
// - Cell range expansion (C2:C6, A1:D1)
// - Formula evaluation with cell coordinates & ranges (=C2 * D2, =SUM(C2:C6), =AVERAGE(...))
// - Seamless bidirectional conversion to/from TableTemplate database definition

import {
  indexToColLetter,
  colLetterToIndex,
  tokenizeFormula,
} from "./tableFormulas.js";

export function toCellKey(r, c) {
  return `${r},${c}`;
}

export function fromCellKey(key) {
  const [r, c] = String(key).split(",").map((n) => parseInt(n, 10));
  return { r: isNaN(r) ? 0 : r, c: isNaN(c) ? 0 : c };
}

export function toCellName(r, c) {
  return `${indexToColLetter(c)}${r + 1}`;
}

export function fromCellName(name) {
  if (!name || typeof name !== "string") return null;
  const match = name.trim().toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  const c = colLetterToIndex(match[1]);
  const r = parseInt(match[2], 10) - 1;
  return { r, c };
}

/**
 * Expand a range like "C2:C6" or "A1:B2" into an array of cell coordinates [{r, c}, ...]
 */
export function expandRange(rangeStr) {
  if (!rangeStr || !rangeStr.includes(":")) return [];
  const [startName, endName] = rangeStr.split(":").map((s) => s.trim());
  const start = fromCellName(startName);
  const end = fromCellName(endName);
  if (!start || !end) return [];

  const minR = Math.min(start.r, end.r);
  const maxR = Math.max(start.r, end.r);
  const minC = Math.min(start.c, end.c);
  const maxC = Math.max(start.c, end.c);

  const coords = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      coords.push({ r, c });
    }
  }
  return coords;
}

/**
 * Evaluate a single formula in the context of the spreadsheet cells.
 * e.g. "=C2 * D2", "=SUM(E2:E6)", "=IF(E2 <= 60, 'L', 'G')"
 */
export function evaluateSpreadsheetFormula(expr, cells = {}) {
  if (!expr) return "";
  let s = String(expr).trim();
  if (s.startsWith("=")) s = s.slice(1).trim();
  if (!s) return "";

  // Helper to get numeric or string value of a cell
  function getCellValue(r, c) {
    const key = toCellKey(r, c);
    const cell = cells[key];
    if (!cell) return null;
    const v = cell.computed !== undefined ? cell.computed : cell.v;
    if (v === undefined || v === null || v === "") return null;
    const n = parseFloat(v);
    return isNaN(n) ? v : n;
  }

  // Tokenize
  const regex =
    /\s*(<=|>=|<>|!=|==|[<>=+\-*/^(),]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Z]+[0-9]+:[A-Z]+[0-9]+|[a-zA-Z_][a-zA-Z0-9_\-]*|\d+(?:\.\d+)?)\s*/gy;
  const tokens = [];
  let match;
  while ((match = regex.exec(s)) !== null) {
    tokens.push(match[1]);
  }
  if (tokens.length === 0) return "";

  let pos = 0;
  function peek() {
    return tokens[pos];
  }
  function consume(expected) {
    const tok = tokens[pos];
    if (expected && tok !== expected) {
      throw new Error(`Expected "${expected}" but got "${tok}"`);
    }
    pos++;
    return tok;
  }

  function parseExpression() {
    return parseComparison();
  }

  function parseComparison() {
    let left = parseAddSub();
    while (["<=", ">=", "<>", "!=", "==", "=", "<", ">"].includes(peek())) {
      const op = consume();
      const right = parseAddSub();
      if (left === null || right === null) return null;
      switch (op) {
        case "<=": left = left <= right; break;
        case ">=": left = left >= right; break;
        case "<": left = left < right; break;
        case ">": left = left > right; break;
        case "==":
        case "=": left = left == right; break;
        case "<>":
        case "!=": left = left != right; break;
      }
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseMulDiv();
      if (left === null || right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseMulDiv() {
    let left = parsePower();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parsePower();
      if (left === null || right === null) return null;
      if (op === "/" && right === 0) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parsePower() {
    let left = parseUnary();
    while (peek() === "^") {
      consume("^");
      const right = parseUnary();
      if (left === null || right === null) return null;
      left = Math.pow(left, right);
    }
    return left;
  }

  function parseUnary() {
    if (peek() === "-") {
      consume("-");
      const val = parseUnary();
      return val === null ? null : -val;
    }
    if (peek() === "+") {
      consume("+");
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) return null;

    // Parentheses
    if (tok === "(") {
      consume("(");
      const val = parseExpression();
      consume(")");
      return val;
    }

    // Number
    if (/^\d+(\.\d+)?$/.test(tok)) {
      consume();
      return parseFloat(tok);
    }

    // String literal
    if (
      (tok.startsWith('"') && tok.endsWith('"')) ||
      (tok.startsWith("'") && tok.endsWith("'"))
    ) {
      consume();
      return tok.slice(1, -1);
    }

    // Range argument (e.g. C2:C6)
    if (tok.includes(":")) {
      consume();
      const coords = expandRange(tok);
      return coords
        .map(({ r, c }) => getCellValue(r, c))
        .filter((n) => typeof n === "number" && !isNaN(n));
    }

    // Identifier: function call or single cell reference
    const id = consume();

    // Function call
    if (peek() === "(") {
      consume("(");
      const args = [];
      if (peek() !== ")") {
        args.push(parseExpression());
        while (peek() === ",") {
          consume(",");
          args.push(parseExpression());
        }
      }
      consume(")");

      // Flatten arguments in case a range was passed
      const flatArgs = args.flat();
      const fn = id.toUpperCase();

      switch (fn) {
        case "SUM":
        case "JUMLAH": {
          const nums = flatArgs.filter((a) => typeof a === "number" && !isNaN(a));
          return nums.length === 0 ? 0 : nums.reduce((acc, v) => acc + v, 0);
        }
        case "AVERAGE":
        case "AVG":
        case "RATA2": {
          const nums = flatArgs.filter((a) => typeof a === "number" && !isNaN(a));
          return nums.length === 0 ? 0 : nums.reduce((acc, v) => acc + v, 0) / nums.length;
        }
        case "MIN": {
          const nums = flatArgs.filter((a) => typeof a === "number" && !isNaN(a));
          return nums.length === 0 ? null : Math.min(...nums);
        }
        case "MAX": {
          const nums = flatArgs.filter((a) => typeof a === "number" && !isNaN(a));
          return nums.length === 0 ? null : Math.max(...nums);
        }
        case "ABS": {
          const a = flatArgs[0];
          return typeof a === "number" ? Math.abs(a) : null;
        }
        case "ROUND": {
          const a = flatArgs[0];
          const dec = typeof flatArgs[1] === "number" ? flatArgs[1] : 2;
          if (typeof a !== "number") return null;
          return Number(Math.round(Number(a + "e" + dec)) + "e-" + dec);
        }
        case "IF": {
          const cond = args[0];
          return cond ? args[1] : args[2];
        }
        default:
          return null;
      }
    }

    // Single Cell Reference (e.g. C2, A1)
    const cellCoord = fromCellName(id);
    if (cellCoord) {
      return getCellValue(cellCoord.r, cellCoord.c);
    }

    return null;
  }

  try {
    const res = parseExpression();
    if (res === null || res === undefined) return "";
    return typeof res === "number" ? parseFloat(res.toFixed(4)) : res;
  } catch {
    return "";
  }
}

/**
 * Re-evaluate all formula cells in the spreadsheet.
 * Resolves dependencies in multiple passes.
 */
export function evaluateAllCells(cells = {}) {
  const next = JSON.parse(JSON.stringify(cells));

  for (const key of Object.keys(next)) {
    const cell = next[key];
    if (cell) {
      if (cell.f) {
        cell.computed = evaluateSpreadsheetFormula(cell.f, next);
      } else {
        if (cell.v !== undefined && cell.v !== null && cell.v !== "") {
          cell.computed = cell.v;
        } else {
          delete cell.computed;
        }
      }
    }
  }

  // 2 passes to resolve chained formulas (e.g. Total = Qty * Price, Overall = SUM(Total))
  for (let pass = 0; pass < 2; pass++) {
    for (const key of Object.keys(next)) {
      const cell = next[key];
      if (cell && cell.f) {
        cell.computed = evaluateSpreadsheetFormula(cell.f, next);
      }
    }
  }

  return next;
}

/**
 * Convert Spreadsheet Grid State -> TableTemplate Definition for PostgreSQL.
 * Maintains 100% backward compatibility for Word export and database queries!
 */
export function spreadsheetToTemplateDefinition(grid, title = "Tabel Pengujian") {
  const { rowCount = 8, colCount = 5, cells = {}, merges = [], colMeta = {} } = grid;

  // Extract columns (row 0 as header)
  const columns = [];
  for (let c = 0; c < colCount; c++) {
    const headerCell = cells[toCellKey(0, c)] || {};
    const meta = colMeta[c] || {};
    const colId = meta.id || `c-${c}`;

    columns.push({
      id: colId,
      header: String(headerCell.v ?? `Kolom ${indexToColLetter(c)}`).trim(),
      width: meta.width || 120,
      inputType: meta.inputType || "text",
      editable: meta.editable ?? (c > 0 && !meta.formula && !meta.isResult),
      formula: meta.formula || null,
      passRule: meta.passRule || null,
      isResult: meta.isResult || false,
      lockAutoResult: meta.lockAutoResult ?? true,
    });
  }

  // Extract fixed data rows (row 1 to rowCount - 1)
  const fixedRows = [];
  for (let r = 1; r < rowCount; r++) {
    const rowId = `r-${r}`;
    const rowCells = {};
    for (let c = 0; c < colCount; c++) {
      const cell = cells[toCellKey(r, c)];
      const colId = columns[c].id;
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== "") {
        rowCells[colId] = cell.v;
      }
    }
    // Only include row if it has at least some data or is within initial rows
    if (Object.keys(rowCells).length > 0 || r < 5) {
      fixedRows.push({ id: rowId, cells: rowCells });
    }
  }

  // Extract header groups from merges in row 0 (for Word export)
  const headerGroups = [];
  (merges || []).forEach((m) => {
    if (m.r === 0 && m.cSpan > 1) {
      const groupColIds = [];
      for (let c = m.c; c < m.c + m.cSpan && c < colCount; c++) {
        const colId = columns[c]?.id || `c-${c}`;
        groupColIds.push(colId);
      }
      const titleCell = cells[toCellKey(0, m.c)];
      const groupTitle = String(titleCell?.v || "").trim();
      if (groupColIds.length > 0 && groupTitle) {
        headerGroups.push({
          title: groupTitle,
          colIds: groupColIds,
        });
      }
    }
  });

  return {
    layout: "table",
    spreadsheetGrid: grid,
    sections: [
      {
        type: "table",
        label: title,
        allowAddRows: true,
        headerGroups,
        columns,
        fixedRows,
        merges,
      },
    ],
  };
}

/**
 * Rehydrate spreadsheet grid for an instance by merging template definition and saved instance data.
 */
export function getSpreadsheetGridForInstance(templateDef, instData = {}) {
  // 1. Get base template grid
  const baseGrid = templateDef?.spreadsheetGrid
    ? JSON.parse(JSON.stringify(templateDef.spreadsheetGrid))
    : templateDefinitionToSpreadsheet(templateDef);

  // 2. If instance has saved spreadsheetGrid with cells, overlay them
  if (instData?.spreadsheetGrid?.cells) {
    const savedCells = instData.spreadsheetGrid.cells;
    const mergedCells = { ...baseGrid.cells };

    Object.keys(savedCells).forEach((key) => {
      if (mergedCells[key]) {
        // Overlay value and formula if any
        mergedCells[key] = {
          ...mergedCells[key],
          v: savedCells[key].v ?? mergedCells[key].v,
          ...(savedCells[key].f !== undefined ? { f: savedCells[key].f } : {}),
          ...(savedCells[key].computed !== undefined ? { computed: savedCells[key].computed } : {}),
        };
        // Clean up computed if no formula
        if (!mergedCells[key].f) {
          if (mergedCells[key].v !== undefined && mergedCells[key].v !== null && mergedCells[key].v !== "") {
            mergedCells[key].computed = mergedCells[key].v;
          } else {
            delete mergedCells[key].computed;
          }
        }
      } else {
        // Cell might be in an added row or column
        mergedCells[key] = savedCells[key];
      }
    });

    const rowCount = Math.max(
      baseGrid.rowCount || 6,
      instData.spreadsheetGrid.rowCount || 0
    );
    const colCount = Math.max(
      baseGrid.colCount || 4,
      instData.spreadsheetGrid.colCount || 0
    );

    return {
      ...baseGrid,
      rowCount,
      colCount,
      cells: evaluateAllCells(mergedCells),
    };
  }

  // 3. Otherwise if instance has saved sections (e.g. legacy data), overlay section rows
  if (instData?.sections?.[0]?.rows && templateDef?.sections?.[0]?.columns) {
    const cols = templateDef.sections[0].columns;
    const rows = instData.sections[0].rows;
    const mergedCells = { ...baseGrid.cells };

    Object.keys(rows).forEach((rowId) => {
      const rowMatch = rowId.match(/^r-(\d+)$/);
      const rIdx = rowMatch ? parseInt(rowMatch[1], 10) : -1;
      if (rIdx >= 0 && rIdx < baseGrid.rowCount) {
        const rowCells = rows[rowId]?.cells || {};
        cols.forEach((col, cIdx) => {
          if (rowCells[col.id] !== undefined && rowCells[col.id] !== "") {
            const key = toCellKey(rIdx, cIdx);
            if (mergedCells[key]) {
              mergedCells[key] = {
                ...mergedCells[key],
                v: rowCells[col.id],
              };
            }
          }
        });
      }
    });

    return {
      ...baseGrid,
      cells: evaluateAllCells(mergedCells),
    };
  }

  // 4. Default: base grid evaluated
  return {
    ...baseGrid,
    cells: evaluateAllCells(baseGrid.cells || {}),
  };
}

/**
 * Synchronize spreadsheet grid edits back into instance data JSONB.
 * Generates both `spreadsheetGrid` (for full fidelity grid recreation)
 * and `sections` (for 100% backward compatibility with Word export / PDF / resolveInstance).
 */
export function syncSpreadsheetToInstanceData(grid, templateDef, existingData = {}) {
  const { rowCount = 8, colCount = 5, cells = {} } = grid;
  const cols = templateDef?.sections?.[0]?.columns || [];

  const rowsData = {};
  for (let r = 1; r < rowCount; r++) {
    const rowId = `r-${r}`;
    const rowCells = {};
    const manualResults = {};

    for (let c = 0; c < colCount; c++) {
      const colId = cols[c]?.id || `c-${c}`;
      const cell = cells[toCellKey(r, c)];
      if (cell) {
        const val = cell.f
          ? (cell.computed !== undefined ? cell.computed : "")
          : (cell.v !== undefined && cell.v !== null && cell.v !== "" ? cell.v : (cell.computed ?? ""));
        if (val !== undefined && val !== null) {
          rowCells[colId] = val;
        }
        if (cell.isResult || cols[c]?.isResult) {
          manualResults[colId] = val;
        }
      }
    }

    if (Object.keys(rowCells).length > 0) {
      rowsData[rowId] = {
        cells: rowCells,
        manualResults,
      };
    }
  }

  return {
    ...existingData,
    spreadsheetGrid: grid,
    sections: {
      0: {
        rows: rowsData,
      },
    },
  };
}

/**
 * Convert TableTemplate Definition from PostgreSQL -> Spreadsheet Grid State.
 */
export function templateDefinitionToSpreadsheet(definition) {
  if (!definition) return createDefaultSpreadsheetGrid();

  // If already saved with spreadsheetGrid, return directly
  if (definition.spreadsheetGrid) {
    return definition.spreadsheetGrid;
  }

  // Otherwise convert legacy section (table or key_value) into grid
  const section = definition.sections?.[0];
  if (!section) return createDefaultSpreadsheetGrid();

  if (section.type === "key_value") {
    const rows = section.rows || [];
    const rowCount = Math.max(rows.length + 1, 6);
    const colCount = 3;
    const cells = {
      "0,0": { v: "Parameter", bold: true, align: "center", bg: "#F1F5F9" },
      "0,1": { v: "Nilai Pengujian", bold: true, align: "center", bg: "#F1F5F9" },
      "0,2": { v: "Hasil", bold: true, align: "center", bg: "#F1F5F9" },
    };

    rows.forEach((r, idx) => {
      cells[toCellKey(idx + 1, 0)] = { v: r.label, align: "left" };
      cells[toCellKey(idx + 1, 1)] = { v: "", editable: true, align: "center" };
      cells[toCellKey(idx + 1, 2)] = { v: "", isResult: true, align: "center" };
    });

    return {
      rowCount,
      colCount,
      cells: evaluateAllCells(cells),
      merges: [],
      colMeta: {
        0: { width: 220, editable: false },
        1: { width: 140, editable: true },
        2: { width: 90, editable: false, isResult: true },
      },
    };
  }

  // Standard table section
  const cols = section.columns || [];
  const fixedRows = section.fixedRows || [];
  const colCount = Math.max(cols.length, 4);
  const rowCount = Math.max(fixedRows.length + 1, 6);
  const cells = {};
  const colMeta = {};

  cols.forEach((c, idx) => {
    cells[toCellKey(0, idx)] = {
      v: c.header,
      bold: true,
      align: "center",
      bg: "#F1F5F9",
    };
    colMeta[idx] = {
      id: c.id,
      width: c.width || 120,
      editable: c.editable ?? true,
      formula: c.formula || null,
      passRule: c.passRule || null,
      isResult: c.isResult || false,
      lockAutoResult: c.lockAutoResult ?? true,
    };
  });

  fixedRows.forEach((r, rIdx) => {
    cols.forEach((c, cIdx) => {
      const v = r.cells?.[c.id] ?? "";
      cells[toCellKey(rIdx + 1, cIdx)] = {
        v,
        f: c.formula && typeof c.formula === "string" ? c.formula : "",
        editable: c.editable && !c.formula && !c.isResult,
        isResult: c.isResult || false,
        align: "center",
      };
    });
  });

  return {
    rowCount,
    colCount,
    cells: evaluateAllCells(cells),
    merges: section.merges || [],
    colMeta,
  };
}

export function createDefaultSpreadsheetGrid() {
  const rowCount = 8;
  const colCount = 5;
  const cells = {
    "0,0": { v: "No", bold: true, align: "center", bg: "#F8FAFC" },
    "0,1": { v: "Titik / Parameter Uji", bold: true, align: "left", bg: "#F8FAFC" },
    "0,2": { v: "Suhu Awal (°C)", bold: true, align: "center", bg: "#F8FAFC" },
    "0,3": { v: "Suhu Akhir (°C)", bold: true, align: "center", bg: "#F8FAFC" },
    "0,4": { v: "Kenaikan (K)", bold: true, align: "center", bg: "#F8FAFC" },

    "1,0": { v: 1, align: "center" },
    "1,1": { v: "Lilitan Motor", align: "left" },
    "1,2": { v: 25, align: "center" },
    "1,3": { v: 65, align: "center" },
    "1,4": { f: "=D2 - C2", align: "center", bold: true },

    "2,0": { v: 2, align: "center" },
    "2,1": { v: "Bodi Luar", align: "left" },
    "2,2": { v: 25, align: "center" },
    "2,3": { v: 45, align: "center" },
    "2,4": { f: "=D3 - C3", align: "center", bold: true },
  };

  return {
    rowCount,
    colCount,
    cells: evaluateAllCells(cells),
    merges: [],
    colMeta: {
      0: { width: 50, editable: false },
      1: { width: 220, editable: false },
      2: { width: 120, editable: true },
      3: { width: 120, editable: true },
      4: { width: 120, editable: false, formula: "=D2 - C2" },
    },
  };
}

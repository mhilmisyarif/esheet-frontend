// src/utils/tableFormulas.js
//
// Pure functions — no React, no API calls.
// Used by both TemplateBuilder (preview) and TableInstanceEditor (live eval).

/**
 * Evaluate all computed columns for a single table row.
 * Returns a new cells object with computed values filled in.
 *
 * @param {object} cells        - raw cell values from instance data { colId: value }
 * @param {Array}  columns      - column definitions from template section
 * @returns {object}            - cells with computed values added
 */
export function resolveComputedCells(cells, columns) {
    const resolved = { ...cells };

    // Build a lookup from colId → numeric value (for formula evaluation)
    const numVal = (colId) => {
        const v = resolved[colId];
        if (v === undefined || v === null || v === '') return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
    };

    // Two-pass: first resolve formulas, then resolve result columns
    // (result may depend on a formula column)

    // Pass 1 — formula columns.
    // Two shapes: binary { op, a, b } and aggregate { op, cols: [...] }.
    // (Keep in sync with esheet-backend/src/lib/tableResolve.js)
    columns.forEach(col => {
        if (!col.formula || col.editable) return;
        const f = col.formula;

        let result = null;

        if (Array.isArray(f.cols)) {
            // Aggregate over N columns, ignoring empty/non-numeric cells
            const nums = f.cols.map(numVal).filter(n => n !== null);
            if (nums.length === 0) {
                resolved[col.id] = '';
                return;
            }
            const total = nums.reduce((s, n) => s + n, 0);
            result = f.op === 'sum' ? total : total / nums.length; // default: average
        } else {
            const a = numVal(f.a);
            const b = numVal(f.b);
            if (a === null || b === null) {
                resolved[col.id] = '';
                return;
            }
            switch (f.op) {
                case 'add': result = a + b; break;
                case 'subtract': result = a - b; break;
                case 'multiply': result = a * b; break;
                case 'divide': result = b !== 0 ? a / b : null; break;
                default: result = null;
            }
        }

        resolved[col.id] = result !== null ? parseFloat(result.toFixed(4)) : '';
    });

    // Pass 2 — result (L/TB/G) columns
    columns.forEach(col => {
        if (!col.isResult || !col.passRule) return;

        const rule = col.passRule;
        const v = numVal(rule.col);

        if (v === null) {
            resolved[col.id] = '';
            return;
        }

        let passes = false;
        switch (rule.op) {
            case 'lte': passes = v <= rule.threshold; break;
            case 'gte': passes = v >= rule.threshold; break;
            case 'lt': passes = v < rule.threshold; break;
            case 'gt': passes = v > rule.threshold; break;
            case 'eq': passes = v === rule.threshold; break;
            case 'range': passes = v >= rule.rangeMin && v <= rule.rangeMax; break;
            default: passes = false;
        }

        resolved[col.id] = passes ? 'L' : 'G';
    });

    return resolved;
}

/**
 * Resolve all rows in a table section, returning cells with computed values.
 *
 * @param {Array}  rows      - array of { rowId, cells } from instance data
 * @param {Array}  columns   - column definitions
 * @returns {Array}          - same structure with computed cells filled
 */
export function resolveTableSection(rows, columns) {
    return rows.map(row => ({
        ...row,
        cells: resolveComputedCells(row.cells || {}, columns),
    }));
}

/**
 * Build a human-readable formula string for display in TemplateBuilder.
 * e.g. { op: "subtract", a: "c-suhu", b: "c-ambient" } → "c-suhu − c-ambient"
 */
export function formulaToString(formula, columns) {
    if (!formula) return '';
    const colLabel = (id) => {
        const col = columns.find(c => c.id === id);
        return col ? col.header : id;
    };
    if (Array.isArray(formula.cols)) {
        const fn = formula.op === 'sum' ? 'JUMLAH' : 'RATA2';
        return `${fn}(${formula.cols.map(colLabel).join(', ')})`;
    }
    const opSymbol = {
        add: '+',
        subtract: '−',
        multiply: '×',
        divide: '÷',
    };
    return `${colLabel(formula.a)} ${opSymbol[formula.op] || '?'} ${colLabel(formula.b)}`;
}

/**
 * Build a human-readable pass rule string.
 * e.g. { col: "c-dt", op: "lte", threshold: 60 } → "c-dt ≤ 60"
 */
export function passRuleToString(passRule, columns) {
    if (!passRule) return '';
    const col = columns.find(c => c.id === passRule.col);
    const colLabel = col ? col.header : passRule.col;
    const opSymbol = {
        lte: '≤', gte: '≥', lt: '<', gt: '>', eq: '=',
        range: 'in range',
    };
    if (passRule.op === 'range') {
        return `${passRule.rangeMin} ≤ ${colLabel} ≤ ${passRule.rangeMax}`;
    }
    return `${colLabel} ${opSymbol[passRule.op] || passRule.op} ${passRule.threshold}`;
}

/**
 * Generate a unique ID for a new column or row.
 */
export function genId(prefix = 'c') {
    return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Get all column IDs that are editable (not computed, not result).
 */
export function getEditableColumns(columns) {
    return columns.filter(c => c.editable && !c.isResult);
}

/**
 * Determine the overall result for a table section instance:
 * - "G" if any result cell is "G"
 * - "L" if all result cells are "L"
 * - "" if any result cell is empty
 * - "TB" otherwise
 */
export function getSectionOverallResult(rows, columns) {
    const resultCols = columns.filter(c => c.isResult);
    if (resultCols.length === 0) return '';

    const results = rows.flatMap(row =>
        resultCols.map(col => row.cells?.[col.id] || '')
    );

    if (results.some(r => r === 'G')) return 'G';
    if (results.some(r => r === '')) return '';
    if (results.every(r => r === 'L')) return 'L';
    return 'TB';
}

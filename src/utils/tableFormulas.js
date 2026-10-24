// src/utils/tableFormulas.js
//
// Pure functions — no React, no API calls.
// Used by TemplateBuilder, SpreadsheetTemplateDesigner, ExcelTableEditor, TableInstanceEditor, and KlausulButirTable.
// Mirrors esheet-backend/src/lib/tableResolve.js (keep in sync).

/**
 * Convert 0-based column index to Excel letter (0 -> A, 1 -> B, 25 -> Z, 26 -> AA).
 */
export function indexToColLetter(index) {
    if (typeof index !== 'number' || index < 0) return '';
    let s = '';
    let n = index;
    while (n >= 0) {
        s = String.fromCharCode((n % 26) + 65) + s;
        n = Math.floor(n / 26) - 1;
    }
    return s;
}

/**
 * Convert Excel column letter to 0-based index ('A' -> 0, 'Z' -> 25, 'AA' -> 26).
 */
export function colLetterToIndex(letter) {
    if (!letter || typeof letter !== 'string') return -1;
    const up = letter.trim().toUpperCase();
    if (!/^[A-Z]+$/.test(up)) return -1;
    let index = 0;
    for (let i = 0; i < up.length; i++) {
        index = index * 26 + (up.charCodeAt(i) - 64);
    }
    return index - 1;
}

/**
 * Tokenize an Excel formula expression.
 */
export function tokenizeFormula(str) {
    const regex = /\s*(<=|>=|<>|!=|==|[<>=+\-*/^(),]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\[[^\]]+\]|[a-zA-Z_][a-zA-Z0-9_\-]*|\d+(?:\.\d+)?)\s*/gy;
    const tokens = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        tokens.push(match[1]);
    }
    return tokens;
}

/**
 * Safe, robust recursive-descent expression parser for Excel-like formulas.
 * Supports: +, -, *, /, ^, comparisons (<=, >=, <>, !=, ==, =, <, >),
 * literals, and functions (SUM, AVERAGE, MIN, MAX, ABS, ROUND, IF).
 * Zero dependencies, no eval(), safe from code injection.
 */
export function parseAndEvaluate(expr, resolveVar) {
    if (!expr) return null;
    let s = String(expr).trim();
    if (s.startsWith('=')) s = s.slice(1).trim();
    if (!s) return null;

    const tokens = tokenizeFormula(s);
    if (tokens.length === 0) return null;

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
        while (['<=', '>=', '<>', '!=', '==', '=', '<', '>'].includes(peek())) {
            const op = consume();
            const right = parseAddSub();
            if (left === null || right === null) return null;
            switch (op) {
                case '<=': left = left <= right; break;
                case '>=': left = left >= right; break;
                case '<': left = left < right; break;
                case '>': left = left > right; break;
                case '==':
                case '=': left = left == right; break;
                case '<>':
                case '!=': left = left != right; break;
            }
        }
        return left;
    }

    function parseAddSub() {
        let left = parseMulDiv();
        while (peek() === '+' || peek() === '-') {
            const op = consume();
            const right = parseMulDiv();
            if (left === null || right === null) return null;
            left = op === '+' ? left + right : left - right;
        }
        return left;
    }

    function parseMulDiv() {
        let left = parsePower();
        while (peek() === '*' || peek() === '/') {
            const op = consume();
            const right = parsePower();
            if (left === null || right === null) return null;
            if (op === '/' && right === 0) return null;
            left = op === '*' ? left * right : left / right;
        }
        return left;
    }

    function parsePower() {
        let left = parseUnary();
        while (peek() === '^') {
            consume('^');
            const right = parseUnary();
            if (left === null || right === null) return null;
            left = Math.pow(left, right);
        }
        return left;
    }

    function parseUnary() {
        if (peek() === '-') {
            consume('-');
            const val = parseUnary();
            return val === null ? null : -val;
        }
        if (peek() === '+') {
            consume('+');
            return parseUnary();
        }
        return parsePrimary();
    }

    function parsePrimary() {
        const tok = peek();
        if (!tok) return null;

        // Parentheses
        if (tok === '(') {
            consume('(');
            const val = parseExpression();
            consume(')');
            return val;
        }

        // Numeric literal
        if (/^\d+(\.\d+)?$/.test(tok)) {
            consume();
            return parseFloat(tok);
        }

        // String literal
        if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'"))) {
            consume();
            return tok.slice(1, -1);
        }

        // Bracketed reference e.g. [c-dt]
        if (tok.startsWith('[') && tok.endsWith(']')) {
            consume();
            const ref = tok.slice(1, -1);
            return typeof resolveVar === 'function' ? resolveVar(ref) : null;
        }

        // Identifier: function call or variable
        const id = consume();
        if (peek() === '(') {
            consume('(');
            const args = [];
            if (peek() !== ')') {
                args.push(parseExpression());
                while (peek() === ',') {
                    consume(',');
                    args.push(parseExpression());
                }
            }
            consume(')');

            const fn = id.toUpperCase();
            switch (fn) {
                case 'SUM':
                case 'JUMLAH': {
                    const nums = args.filter((a) => typeof a === 'number' && !isNaN(a));
                    return nums.length === 0 ? null : nums.reduce((acc, v) => acc + v, 0);
                }
                case 'AVERAGE':
                case 'AVG':
                case 'RATA2': {
                    const nums = args.filter((a) => typeof a === 'number' && !isNaN(a));
                    return nums.length === 0 ? null : nums.reduce((acc, v) => acc + v, 0) / nums.length;
                }
                case 'MIN': {
                    const nums = args.filter((a) => typeof a === 'number' && !isNaN(a));
                    return nums.length === 0 ? null : Math.min(...nums);
                }
                case 'MAX': {
                    const nums = args.filter((a) => typeof a === 'number' && !isNaN(a));
                    return nums.length === 0 ? null : Math.max(...nums);
                }
                case 'ABS': {
                    const a = args[0];
                    return typeof a === 'number' ? Math.abs(a) : null;
                }
                case 'ROUND': {
                    const a = args[0];
                    const dec = typeof args[1] === 'number' ? args[1] : 2;
                    if (typeof a !== 'number') return null;
                    return Number(Math.round(Number(a + 'e' + dec)) + 'e-' + dec);
                }
                case 'IF': {
                    const cond = args[0];
                    return cond ? args[1] : args[2];
                }
                default:
                    return null;
            }
        }

        // Bare variable / column reference
        return typeof resolveVar === 'function' ? resolveVar(id) : null;
    }

    try {
        return parseExpression();
    } catch {
        return null;
    }
}

/**
 * Evaluate all computed columns for a single table row.
 * Returns a new cells object with computed values filled in.
 *
 * @param {object} cells        - raw cell values from instance data { colId: value }
 * @param {Array}  columns      - column definitions from template section
 * @param {object} options      - optional { manualResults: { [colId]: 'L'|'TB'|'G' } }
 * @returns {object}            - cells with computed values added
 */
export function resolveComputedCells(cells, columns, options = {}) {
    const resolved = { ...cells };
    const cols = columns || [];

    const numVal = (val) => {
        if (val === undefined || val === null || val === '') return null;
        const n = parseFloat(val);
        return isNaN(n) ? null : n;
    };

    // Helper to resolve cell value by variable identifier (Letter A/B/C, col.id, or header)
    const resolveVar = (varName) => {
        if (!varName) return null;
        const trimmed = String(varName).trim();

        // 1. Check Excel letter (A, B, C...)
        const colIdx = colLetterToIndex(trimmed);
        if (colIdx >= 0 && colIdx < cols.length) {
            const cId = cols[colIdx].id;
            const raw = resolved[cId];
            const num = numVal(raw);
            return num !== null ? num : (raw ?? null);
        }

        // 2. Check by column ID
        if (resolved[trimmed] !== undefined) {
            const raw = resolved[trimmed];
            const num = numVal(raw);
            return num !== null ? num : (raw ?? null);
        }

        // 3. Check by header name (case-insensitive)
        const matched = cols.find((c) => c.header && c.header.trim().toLowerCase() === trimmed.toLowerCase());
        if (matched) {
            const raw = resolved[matched.id];
            const num = numVal(raw);
            return num !== null ? num : (raw ?? null);
        }

        return null;
    };

    // Pass 1 — formula columns. Up to 2 iterations to resolve chained dependencies
    for (let pass = 0; pass < 2; pass++) {
        cols.forEach((col, idx) => {
            if (!col.formula || col.editable) return;
            const f = col.formula;
            let result = null;

            if (typeof f === 'string') {
                result = parseAndEvaluate(f, resolveVar);
            } else if (typeof f === 'object') {
                if (Array.isArray(f.cols)) {
                    const nums = f.cols.map((cid) => numVal(resolveVar(cid))).filter((n) => n !== null);
                    if (nums.length === 0) {
                        resolved[col.id] = '';
                        return;
                    }
                    const total = nums.reduce((s, n) => s + n, 0);
                    result = f.op === 'sum' ? total : total / nums.length;
                } else if (f.a && f.b) {
                    const a = numVal(resolveVar(f.a));
                    const b = numVal(resolveVar(f.b));
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
            }

            if (result !== null && result !== undefined) {
                resolved[col.id] = typeof result === 'number' ? parseFloat(result.toFixed(4)) : result;
            } else {
                resolved[col.id] = '';
            }
        });
    }

    // Pass 2 — result (L/TB/G) columns
    cols.forEach((col, idx) => {
        if (!col.isResult) return;

        // Check if manual override exists and is active for this row/col
        const isLocked = col.lockAutoResult !== false;
        const manualVal = options.manualResults?.[col.id] ?? cells[col.id];
        if (!isLocked && manualVal && ['L', 'TB', 'G'].includes(manualVal)) {
            resolved[col.id] = manualVal;
            return;
        }

        // Formula specified on result column
        if (col.formula && typeof col.formula === 'string') {
            const evalRes = parseAndEvaluate(col.formula, resolveVar);
            if (evalRes === true || evalRes === 'L') resolved[col.id] = 'L';
            else if (evalRes === false || evalRes === 'G') resolved[col.id] = 'G';
            else if (evalRes === 'TB') resolved[col.id] = 'TB';
            else resolved[col.id] = evalRes || '';
            return;
        }

        if (!col.passRule) return;
        const rule = col.passRule;

        // String pass rule: e.g. "<= 60", ">= 10", "=IF(...)"
        if (typeof rule === 'string') {
            const trimmedRule = rule.trim();
            if (trimmedRule.toUpperCase().startsWith('IF') || trimmedRule.startsWith('=')) {
                const evalRes = parseAndEvaluate(trimmedRule, resolveVar);
                if (evalRes === true || evalRes === 'L') resolved[col.id] = 'L';
                else if (evalRes === false || evalRes === 'G') resolved[col.id] = 'G';
                else if (evalRes === 'TB') resolved[col.id] = 'TB';
                else resolved[col.id] = evalRes || '';
                return;
            }

            // Simple bound string on previous column (e.g. "<= 60")
            const prevCol = idx > 0 ? cols[idx - 1] : null;
            if (prevCol) {
                const fullExpr = `${indexToColLetter(idx - 1)} ${trimmedRule}`;
                const evalRes = parseAndEvaluate(fullExpr, resolveVar);
                if (evalRes === true) resolved[col.id] = 'L';
                else if (evalRes === false) resolved[col.id] = 'G';
                else resolved[col.id] = '';
                return;
            }
        }

        // Object pass rule (legacy)
        if (typeof rule === 'object') {
            const v = numVal(resolveVar(rule.col));
            if (v === null) {
                resolved[col.id] = '';
                return;
            }
            let passes = false;
            const op = rule.op || 'lte';
            switch (op) {
                case 'lte': passes = v <= rule.threshold; break;
                case 'gte': passes = v >= rule.threshold; break;
                case 'lt': passes = v < rule.threshold; break;
                case 'gt': passes = v > rule.threshold; break;
                case 'eq': passes = v === rule.threshold; break;
                case 'range': passes = v >= rule.rangeMin && v <= rule.rangeMax; break;
                default: passes = false;
            }
            resolved[col.id] = passes ? 'L' : 'G';
        }
    });

    return resolved;
}

/**
 * Resolve all rows in a table section, returning cells with computed values.
 */
export function resolveTableSection(rows, columns, options = {}) {
    return rows.map((row) => ({
        ...row,
        cells: resolveComputedCells(row.cells || {}, columns, {
            manualResults: row.manualResults,
            ...options,
        }),
    }));
}

/**
 * Build a human-readable formula string for display.
 */
export function formulaToString(formula, columns = []) {
    if (!formula) return '';
    if (typeof formula === 'string') return formula;
    if (typeof formula !== 'object') return String(formula);

    const cols = Array.isArray(columns) ? columns : [];
    const colLabel = (id) => {
        const col = cols.find((c) => c.id === id);
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
 */
export function passRuleToString(passRule, columns = []) {
    if (!passRule) return '';
    if (typeof passRule === 'string') return passRule;
    if (typeof passRule !== 'object') return String(passRule);

    const cols = Array.isArray(columns) ? columns : [];
    const col = cols.find((c) => c.id === passRule.col);
    const colLabel = col ? col.header : (passRule.col || '');
    const opSymbol = {
        lte: '≤', gte: '≥', lt: '<', gt: '>', eq: '=',
        range: 'in range',
    };
    if (passRule.op === 'range') {
        return `${passRule.rangeMin} ≤ ${colLabel} ≤ ${passRule.rangeMax}`;
    }
    const sym = opSymbol[passRule.op] || passRule.op || '≤';
    return `${colLabel} ${sym} ${passRule.threshold ?? ''}`.trim();
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
    return (columns || []).filter((c) => c.editable && !c.isResult);
}

/**
 * Determine the overall result for a table section instance:
 * - "G" if any result cell is "G"
 * - "L" if all result cells are "L"
 * - "" if any result cell is empty
 * - "TB" otherwise
 */
export function getSectionOverallResult(rows, columns) {
    const resultCols = (columns || []).filter((c) => c.isResult);
    if (resultCols.length === 0) return '';

    const results = rows.flatMap((row) =>
        resultCols.map((col) => row.cells?.[col.id] || '')
    );

    if (results.some((r) => r === 'G')) return 'G';
    if (results.some((r) => r === '')) return '';
    if (results.every((r) => r === 'L')) return 'L';
    return 'TB';
}

/**
 * Check if a TableInstance has any section evaluated to "G" (failed).
 * Checks key-value rows and table result columns.
 */
export function isTableInstanceFailed(instance) {
    if (!instance) return false;
    const def = instance.template?.definition;
    if (!def) return false;

    // Direct spreadsheet grid check
    const grid = instance.data?.spreadsheetGrid || def.spreadsheetGrid;
    if (grid && grid.cells) {
        for (const key of Object.keys(grid.cells)) {
            const cell = grid.cells[key];
            if (cell && (cell.isResult || cell.f)) {
                const val = cell.computed !== undefined ? cell.computed : cell.v;
                if (val === 'G' || val === 'GAGAL') return true;
            }
        }
    }

    if (!Array.isArray(def.sections)) return false;

    const sectionsData = instance.data?.sections || {};

    for (let idx = 0; idx < def.sections.length; idx++) {
        const sec = def.sections[idx];
        const sData = sectionsData[idx] || {};

        if (sec.type === 'key_value') {
            const kv = sData.kv || {};
            for (const r of sec.rows || []) {
                if (kv[r.id]?.result === 'G') return true;
            }
        } else if (sec.type === 'table') {
            const columns = sec.columns || [];
            const resultCols = columns.filter((c) => c.isResult);
            if (resultCols.length > 0) {
                const fixedRows = sec.fixedRows || [];
                const addedRows = sData.addedRows || [];
                const storedRows = sData.rows || {};
                const allRows = [
                    ...fixedRows.map((fr) => ({
                        cells: { ...fr.cells, ...((storedRows[fr.id] || {}).cells || {}) },
                        manualResults: (storedRows[fr.id] || {}).manualResults || {},
                    })),
                    ...addedRows.map((ar) => ({
                        cells: ar.cells || {},
                        manualResults: ar.manualResults || {},
                    })),
                ];
                for (const row of allRows) {
                    const resolved = resolveComputedCells(row.cells, columns, {
                        manualResults: row.manualResults,
                    });
                    for (const rc of resultCols) {
                        if (resolved[rc.id] === 'G') return true;
                    }
                }
            }
        }
    }
    return false;
}
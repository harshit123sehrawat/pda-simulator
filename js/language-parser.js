/**
 * ============================================================
 *  Universal PDA Generator Engine
 *  ============================================================
 *
 *  Given ANY formal language description, this engine:
 *    1. Parses the language string (symbols, variables, constraints)
 *    2. Classifies the language (regular, CFL, palindrome, non-CFL)
 *    3. Decides PDA type (DPDA / NPDA / Not Possible)
 *    4. Constructs a correct automaton
 *    5. Enforces constraints (n > 0, n > 1, ordering)
 *    6. Returns structured output
 *    7. Validates with test strings before returning
 *
 *  Classifications:
 *    REGULAR            — independent counts        → DPDA (no stack)
 *    SINGLE_DEPENDENCY  — one equality constraint   → DPDA
 *    LINEAR             — ratio relationship        → DPDA
 *    NESTED             — balanced / recursive      → DPDA
 *    PALINDROME_MARKED  — mirror with center marker → DPDA
 *    PALINDROME         — mirror without marker     → NPDA
 *    MULTI_DEPENDENCY   — coupled counts / repeat   → NOT POSSIBLE
 *
 * ============================================================
 */

class LanguageParser {

    // ═══════════════════════════════════════════════════════════
    //  STEP 1: LANGUAGE PARSING
    // ═══════════════════════════════════════════════════════════

    /**
     * Parse a language string and extract structured information.
     * @param {string} raw — user input like "{ a^n b^n | n >= 0 }"
     * @returns {Object} parsed structure
     */
    static parseLangString(raw) {
        const original = raw.trim();
        let s = original.toLowerCase().replace(/\s+/g, '');

        // ── Extract condition (right side of | or :) ──────────
        let conditionStr = '';
        const condSplit = s.split(/\||mid|:/);
        if (condSplit.length > 1) conditionStr = condSplit.slice(1).join('');

        // ── Parse constraints from condition ──────────────────
        const constraints = {};
        // Match patterns like n>=0, n>1, m>=1, p>0
        const cMatches = conditionStr.matchAll(/([nmp])(\s*)(>=|>|==|=)(\s*)(\d+)/g);
        for (const cm of cMatches) {
            const varName = cm[1];
            const op = cm[3];
            const val = parseInt(cm[5], 10);
            if (op === '>') constraints[varName] = val + 1;
            else constraints[varName] = val; // >=, ==, =
        }

        // Default: if no constraints found, assume n >= 0
        if (Object.keys(constraints).length === 0) {
            constraints.n = 0;
        }

        // ── Clean the body (left side of condition) ───────────
        let body = s;
        body = body.replace(/^\{/, '').replace(/\}.*$/, '');
        body = body.split(/\||mid|:/)[0];
        body = body.replace(/\{([^}]+)\}/g, '$1'); // Unwrap {2n} → 2n

        // ── Detect named patterns ─────────────────────────────
        const lowerOrig = original.toLowerCase().replace(/\s+/g, '');
        if (lowerOrig === 'ww^r' || lowerOrig === 'wwr' || lowerOrig === '{ww^r}' || lowerOrig === '{wwr}') {
            return { type: 'PALINDROME', body: 'wwr', constraints, original };
        }
        if (lowerOrig === 'wcw^r' || lowerOrig === 'wcwr' || lowerOrig === '{wcw^r}' || lowerOrig === '{wcwr}' || lowerOrig === 'w cw^r' || lowerOrig === 'wcw^r') {
            return { type: 'PALINDROME_MARKED', body: 'wcwr', constraints, original };
        }
        if (lowerOrig === 'ww' || lowerOrig === '{ww}') {
            return { type: 'MULTI_DEPENDENCY', body: 'ww', constraints, original, reason: 'string_repeat' };
        }
        if (lowerOrig.includes('paren') || lowerOrig === '()' || lowerOrig === '(())' || lowerOrig === 'balanced()' || lowerOrig === 'balancedparentheses' || lowerOrig === 'balanced_parentheses') {
            return { type: 'NESTED', body: 'parens', constraints, original };
        }

        // ── Parse segments: extract symbol^exponent sequences ─
        const segments = [];
        // Match patterns like: a^2n, a^n, a^m, a^p, a^(n+m), a^3, a
        const segRegex = /([a-z0-9])(?:\^(?:\(?([\dnmp+*]+)\)?))?/g;
        let match;
        while ((match = segRegex.exec(body)) !== null) {
            const symbol = match[1];
            let exponent = match[2] || '1'; // No exponent means fixed count of 1 (for raw symbol)

            // If the match was just a symbol without ^, and it's followed by ^
            // Actually check: did the original have ^ after this symbol?
            const startIdx = match.index;
            const fullMatch = match[0];
            const hasExponent = fullMatch.includes('^');

            if (!hasExponent) {
                exponent = '1';
            }

            // Parse exponent into {multiplier, variable}
            const expParsed = LanguageParser._parseExponent(exponent);
            segments.push({ symbol, exponent, ...expParsed });
        }

        if (segments.length === 0) {
            return { type: 'UNKNOWN', body, constraints, original };
        }

        // ── Extract unique variables and symbols ──────────────
        const variables = new Set();
        const symbols = new Set();
        for (const seg of segments) {
            symbols.add(seg.symbol);
            if (seg.variable) {
                if (seg.variable.includes('+')) {
                    seg.variable.split('+').forEach(v => variables.add(v.trim()));
                } else {
                    variables.add(seg.variable);
                }
            }
        }

        return {
            type: null, // Will be classified in Step 2
            body,
            segments,
            variables: [...variables],
            symbols: [...symbols],
            constraints,
            original
        };
    }

    /**
     * Parse an exponent string into multiplier + variable.
     * Examples: "n" → {mult:1, var:"n"}, "2n" → {mult:2, var:"n"},
     *           "n+m" → {mult:1, var:"n+m"}, "3" → {mult:3, var:null}
     */
    static _parseExponent(exp) {
        if (!exp || exp === '1') return { multiplier: 1, variable: null, isFixed: true };

        // Pure number (like "3")
        if (/^\d+$/.test(exp)) return { multiplier: parseInt(exp, 10), variable: null, isFixed: true };

        // Addition (like "n+m")
        if (exp.includes('+')) return { multiplier: 1, variable: exp, isFixed: false, isAddition: true };

        // Multiplied variable (like "2n", "3m")
        const multMatch = exp.match(/^(\d*)([nmp])$/);
        if (multMatch) {
            const mult = multMatch[1] === '' ? 1 : parseInt(multMatch[1], 10);
            return { multiplier: mult, variable: multMatch[2], isFixed: false };
        }

        return { multiplier: 1, variable: exp, isFixed: false };
    }


    // ═══════════════════════════════════════════════════════════
    //  STEP 2: CLASSIFICATION ENGINE
    // ═══════════════════════════════════════════════════════════

    /**
     * Classify a parsed language structure.
     * @param {Object} parsed — output from parseLangString
     * @returns {Object} parsed with .type and .classification set
     */
    static classify(parsed) {
        // Already classified (named patterns)
        if (parsed.type) return parsed;

        const segs = parsed.segments;
        if (!segs || segs.length === 0) {
            parsed.type = 'UNKNOWN';
            return parsed;
        }

        // ── All fixed exponents → trivially regular ───────────
        if (segs.every(s => s.isFixed)) {
            parsed.type = 'REGULAR';
            parsed.classification = 'All exponents are fixed constants — this is a finite/regular language.';
            return parsed;
        }

        // ── Build dependency map: which variables appear where ─
        const varOccurrences = {};
        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i];
            if (seg.variable && !seg.isAddition) {
                if (!varOccurrences[seg.variable]) varOccurrences[seg.variable] = [];
                varOccurrences[seg.variable].push({ index: i, multiplier: seg.multiplier, symbol: seg.symbol });
            }
            if (seg.isAddition) {
                // For n+m type, register under both
                const parts = seg.variable.split('+');
                for (const p of parts) {
                    const pv = p.trim();
                    if (!varOccurrences[pv]) varOccurrences[pv] = [];
                    varOccurrences[pv].push({ index: i, multiplier: seg.multiplier, symbol: seg.symbol, isAdditionPart: true });
                }
            }
        }

        const vars = Object.keys(varOccurrences);

        // ── Check for MULTI_DEPENDENCY (non-CFL) ─────────────
        // a^n b^n c^n → variable 'n' appears 3+ times with same variable, all dependent
        for (const v of vars) {
            const occs = varOccurrences[v].filter(o => !o.isAdditionPart);
            if (occs.length >= 3) {
                // Three segments all tied to the same variable with multiplier 1
                // This requires matching 3 counts simultaneously → NOT CFL
                const allMult1 = occs.every(o => o.multiplier === 1);
                if (allMult1) {
                    parsed.type = 'MULTI_DEPENDENCY';
                    parsed.classification = `Variable '${v}' appears in ${occs.length} segments (${occs.map(o => o.symbol + '^' + v).join(', ')}). Matching ${occs.length} identical quantities simultaneously requires ${occs.length - 1} stacks — impossible for a single-stack PDA.`;
                    return parsed;
                }
            }
        }

        // ── All variables are independent (each appears once) → REGULAR
        const allIndependent = vars.every(v => {
            const occs = varOccurrences[v].filter(o => !o.isAdditionPart);
            return occs.length <= 1;
        });

        // Check if there are any addition-based dependencies
        const hasAddition = segs.some(s => s.isAddition);

        if (allIndependent && !hasAddition) {
            // Check if any variable has a multiplier > 1 that's paired
            // e.g. a^n b^n → n appears twice, should NOT be here
            parsed.type = 'REGULAR';
            parsed.classification = 'Each variable controls an independent segment — no counting dependencies exist. This is a regular language recognizable by a DFA-equivalent DPDA.';
            return parsed;
        }

        // ── Exactly one variable with dependency → could be SINGLE_DEPENDENCY or LINEAR
        for (const v of vars) {
            const occs = varOccurrences[v].filter(o => !o.isAdditionPart);
            if (occs.length === 2) {
                // Check if multipliers differ → LINEAR
                if (occs[0].multiplier !== occs[1].multiplier) {
                    parsed.type = 'LINEAR';
                    parsed.classification = `Segments ${occs[0].symbol}^${occs[0].multiplier}${v} and ${occs[1].symbol}^${occs[1].multiplier}${v} have a linear ratio relationship (${occs[0].multiplier}:${occs[1].multiplier}). Achievable with controlled push/pop rates.`;
                    parsed.dependency = { variable: v, segments: occs };
                    return parsed;
                }

                // Same multiplier, single dependency → SINGLE_DEPENDENCY
                parsed.type = 'SINGLE_DEPENDENCY';
                parsed.classification = `Segments ${occs[0].symbol}^${v} and ${occs[1].symbol}^${v} must have equal counts. A single stack push-pop cycle verifies this deterministically.`;
                parsed.dependency = { variable: v, segments: occs };
                return parsed;
            }
        }

        // ── Addition dependency (a^n b^m c^{n+m}) ─────────────
        if (hasAddition) {
            parsed.type = 'SINGLE_DEPENDENCY';
            parsed.classification = 'The additive dependency can be verified by pushing for all contributing variables and popping for the sum. Achievable with a DPDA.';
            return parsed;
        }

        // ── Fallback ──────────────────────────────────────────
        parsed.type = 'UNKNOWN';
        return parsed;
    }


    // ═══════════════════════════════════════════════════════════
    //  STEP 3: DECISION
    // ═══════════════════════════════════════════════════════════

    /**
     * Determine the PDA type based on classification.
     * @param {string} type — classification type
     * @returns {string} 'DPDA' | 'NPDA' | 'NOT_POSSIBLE'
     */
    static decidePDAType(type) {
        switch (type) {
            case 'REGULAR':           return 'DPDA';
            case 'SINGLE_DEPENDENCY': return 'DPDA';
            case 'LINEAR':           return 'DPDA';
            case 'NESTED':           return 'DPDA';
            case 'PALINDROME_MARKED':return 'DPDA';
            case 'PALINDROME':       return 'NPDA';
            case 'MULTI_DEPENDENCY': return 'NOT_POSSIBLE';
            default:                 return 'NOT_POSSIBLE';
        }
    }


    // ═══════════════════════════════════════════════════════════
    //  STEP 4 & 5: PDA CONSTRUCTION + CONSTRAINT ENFORCEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * Generate a PDA configuration for the given parsed/classified language.
     * @param {Object} parsed — classified language structure
     * @returns {Object} PDA configuration
     */
    static constructPDA(parsed) {
        switch (parsed.type) {
            case 'REGULAR':
                return LanguageParser._buildRegularPDA(parsed);
            case 'SINGLE_DEPENDENCY':
                return LanguageParser._buildSingleDependencyPDA(parsed);
            case 'LINEAR':
                return LanguageParser._buildLinearPDA(parsed);
            case 'NESTED':
                return LanguageParser._buildNestedPDA(parsed);
            case 'PALINDROME_MARKED':
                return LanguageParser._buildMarkedPalindromePDA(parsed);
            case 'PALINDROME':
                return LanguageParser._buildUnmarkedPalindromePDA(parsed);
            default:
                throw new Error(JSON.stringify({
                    reason: `Cannot construct a PDA for this language type: ${parsed.type}`
                }));
        }
    }

    // ── A. REGULAR (no stack usage) ───────────────────────────
    static _buildRegularPDA(parsed) {
        const segs = parsed.segments;
        if (!segs || segs.length === 0) {
            throw new Error(JSON.stringify({ reason: 'No segments found for regular language.' }));
        }

        const symbols = segs.map(s => s.symbol);
        const uniqueSymbols = [...new Set(symbols)];
        const states = ['q0'];
        const transitions = [];
        const minCounts = {};

        // Determine min counts from constraints
        for (const seg of segs) {
            if (seg.variable && parsed.constraints[seg.variable] !== undefined) {
                minCounts[seg.symbol] = parsed.constraints[seg.variable];
            }
        }

        // For each symbol in sequence, create states
        let currentState = 'q0';
        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i];
            const sym = seg.symbol;
            const nextState = i < segs.length - 1 ? `q_${seg.symbol}` : 'q_accept';
            const min = minCounts[sym] || 0;

            if (min > 0) {
                // Need intermediate states to enforce minimum
                for (let j = 0; j < min; j++) {
                    const fromSt = j === 0 ? currentState : `q_${sym}_${j}`;
                    const toSt = j < min - 1 ? `q_${sym}_${j + 1}` : `q_${sym}`;
                    if (!states.includes(fromSt)) states.push(fromSt);
                    if (!states.includes(toSt)) states.push(toSt);
                    transitions.push(`${fromSt}, ${sym}, Z -> ${toSt}, Z`);
                }
                // Self-loop in the established state for optional extras
                if (!states.includes(`q_${sym}`)) states.push(`q_${sym}`);
                transitions.push(`q_${sym}, ${sym}, Z -> q_${sym}, Z`);
            } else {
                // No minimum constraint — allow any number
                if (!states.includes(`q_${sym}`)) states.push(`q_${sym}`);
                transitions.push(`${currentState}, ${sym}, Z -> q_${sym}, Z`);
                transitions.push(`q_${sym}, ${sym}, Z -> q_${sym}, Z`);
            }

            // Transition to next symbol's phase
            if (i < segs.length - 1) {
                const nextSeg = segs[i + 1];
                const srcState = `q_${sym}`;
                const destState = (minCounts[nextSeg.symbol] || 0) > 0 ? `q_${nextSeg.symbol}_0` : `q_${nextSeg.symbol}`;
                if (srcState !== destState) {
                    // Only add the transition to next symbol from the loop state
                    // This will be handled by reading the next symbol
                }
            }

            currentState = `q_${sym}`;
        }

        // Rebuild as a clean sequential automaton
        return LanguageParser._buildCleanRegularPDA(segs, parsed.constraints);
    }

    static _buildCleanRegularPDA(segs, constraints) {
        const symbols = [...new Set(segs.map(s => s.symbol))];
        const states = [];
        const transLines = [];
        let stateIdx = 0;

        // Create sequential state chain
        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i];
            const sym = seg.symbol;
            const min = (seg.variable && constraints[seg.variable] !== undefined) ? constraints[seg.variable] : 0;
            const isLast = i === segs.length - 1;

            if (min > 0) {
                // Need mandatory states
                transLines.push(`// --- Phase ${i + 1}: Must read at least ${min} '${sym}' ---`);
                for (let j = 0; j < min; j++) {
                    const from = `q${stateIdx}`;
                    const to = `q${stateIdx + 1}`;
                    if (!states.includes(from)) states.push(from);
                    if (!states.includes(to)) states.push(to);
                    transLines.push(`${from}, ${sym}, Z -> ${to}, Z`);
                    stateIdx++;
                }
                // Self-loop for extras
                const loopState = `q${stateIdx}`;
                transLines.push(`${loopState}, ${sym}, Z -> ${loopState}, Z`);
            } else {
                // Optional — go directly to next phase state
                const from = `q${stateIdx}`;
                const to = `q${stateIdx + 1}`;
                if (!states.includes(from)) states.push(from);
                if (!states.includes(to)) states.push(to);
                transLines.push(`// --- Phase ${i + 1}: Read '${sym}' (any count) ---`);
                transLines.push(`${from}, ${sym}, Z -> ${to}, Z`);
                transLines.push(`${to}, ${sym}, Z -> ${to}, Z`);
                stateIdx++;
            }
        }

        // Accept state
        const acceptState = `q${stateIdx}`;
        if (!states.includes(acceptState)) states.push(acceptState);

        // Add accept epsilon transition from last loop state
        const lastState = `q${stateIdx}`;

        // Generate examples
        const validExamples = [];
        const invalidExamples = [];
        const oneEach = segs.map(s => s.symbol).join('');
        const twoEach = segs.map(s => s.symbol.repeat(2)).join('');
        const threeEach = segs.map(s => s.symbol.repeat(3)).join('');
        validExamples.push(oneEach, twoEach, threeEach);

        // Invalid: wrong order
        if (segs.length >= 2) {
            invalidExamples.push(segs.map(s => s.symbol).reverse().join(''));
            invalidExamples.push(segs[segs.length - 1].symbol + segs[0].symbol);
        }
        // Invalid: missing a symbol
        if (segs.length >= 2) {
            invalidExamples.push(segs[0].symbol.repeat(3));
        }

        return {
            pdaType: 'DPDA',
            classification: 'REGULAR',
            reason: `This language has no equality dependencies between counts. Each symbol can appear independently, making it a regular language. The DPDA operates like a DFA, using states only — the stack is never modified.`,
            examples: { accepted: validExamples, rejected: invalidExamples },
            states,
            inputAlphabet: symbols,
            stackAlphabet: ['Z'],
            startState: states[0],
            acceptStates: [acceptState],
            initialStackSymbol: 'Z',
            transitionsStr: transLines.join('\n')
        };
    }

    // ── B. SINGLE DEPENDENCY (push-pop matching) ──────────────
    static _buildSingleDependencyPDA(parsed) {
        const segs = parsed.segments;

        // Detect sub-patterns
        if (segs && segs.length === 2) {
            return LanguageParser._buildTwoSymbolMatch(parsed);
        }
        if (segs && segs.length === 3) {
            return LanguageParser._buildThreeSymbolDependency(parsed);
        }
        if (segs && segs.length === 4) {
            return LanguageParser._buildFourSymbolDependency(parsed);
        }

        // Generic two-variable case
        return LanguageParser._buildTwoSymbolMatch(parsed);
    }

    static _buildTwoSymbolMatch(parsed) {
        const segs = parsed.segments;
        const x = segs[0].symbol;
        const y = segs[1].symbol;
        const minN = parsed.constraints.n || 0;

        const states = [];
        const transLines = [];

        if (minN > 0) {
            // Enforce minimum
            transLines.push(`// --- Enforce at least ${minN} '${x}' ---`);
            states.push('q_req_0');
            transLines.push(`q_req_0, ${x}, Z -> q_req_1, AZ`);
            for (let i = 1; i < minN; i++) {
                states.push(`q_req_${i}`);
                transLines.push(`q_req_${i}, ${x}, A -> q_req_${i + 1}, AA`);
            }
            states.push(`q_req_${minN}`);
            transLines.push(`q_req_${minN}, ε, A -> q0, A`);
        }

        states.push('q0', 'q1', 'q_accept');

        transLines.push(`// --- Push A for each '${x}' ---`);
        if (minN === 0) {
            transLines.push(`q0, ${x}, Z -> q0, AZ`);
        }
        transLines.push(`q0, ${x}, A -> q0, AA`);

        transLines.push(`// --- Pop A for each '${y}' ---`);
        transLines.push(`q0, ${y}, A -> q1, ε`);
        transLines.push(`q1, ${y}, A -> q1, ε`);

        transLines.push(`// --- Accept when stack shows Z (all matched) ---`);
        if (minN === 0) {
            transLines.push(`q0, ε, Z -> q_accept, Z`);
        }
        transLines.push(`q1, ε, Z -> q_accept, Z`);

        const startState = minN > 0 ? 'q_req_0' : 'q0';

        return {
            pdaType: 'DPDA',
            classification: 'SINGLE_DEPENDENCY',
            reason: `The language requires equal counts of '${x}' and '${y}'. The DPDA pushes a marker for each '${x}' and pops one for each '${y}'. Acceptance occurs when the stack returns to the bottom marker Z.`,
            examples: {
                accepted: [
                    minN === 0 ? '' : x.repeat(minN) + y.repeat(minN),
                    x.repeat(Math.max(1, minN)) + y.repeat(Math.max(1, minN)),
                    x.repeat(minN + 3) + y.repeat(minN + 3)
                ],
                rejected: [
                    x + y + x,
                    y + x,
                    x.repeat(3) + y.repeat(2)
                ]
            },
            states,
            inputAlphabet: [x, y],
            stackAlphabet: ['Z', 'A'],
            startState,
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: transLines.join('\n')
        };
    }

    static _buildThreeSymbolDependency(parsed) {
        const segs = parsed.segments;
        const x = segs[0].symbol;
        const y = segs[1].symbol;
        const z = segs[2].symbol;

        // Determine which pattern:
        // a^n b^n c^m → push x, pop y, ignore z
        // a^n b^m c^m → ignore x, push y, pop z
        // a^n b^m c^n → push x, ignore y, pop z
        // a^n b^m c^{n+m} → push x and y, pop z

        const v0 = segs[0].variable;
        const v1 = segs[1].variable;
        const v2 = segs[2].variable;

        // Check for addition pattern (c^{n+m})
        if (segs[2].isAddition) {
            return LanguageParser._buildAdditionPDA(x, y, z);
        }

        // a^n b^n c^m (v0 == v1, v2 different)
        if (v0 && v1 && v0 === v1 && v2 !== v0) {
            return LanguageParser._buildPrefixMatchPDA(x, y, z);
        }

        // a^n b^m c^m (v1 == v2, v0 different)
        if (v1 && v2 && v1 === v2 && v0 !== v1) {
            return LanguageParser._buildSuffixMatchPDA(x, y, z);
        }

        // a^n b^m c^n (v0 == v2, v1 different)
        if (v0 && v2 && v0 === v2 && v1 !== v0) {
            return LanguageParser._buildOuterMatchPDA(x, y, z);
        }

        // Fallback: try to detect from variable names
        throw new Error(JSON.stringify({
            reason: `Could not determine the dependency pattern for ${x}^${v0 || '?'} ${y}^${v1 || '?'} ${z}^${v2 || '?'}. Please use standard variable notation.`
        }));
    }

    static _buildFourSymbolDependency(parsed) {
        const segs = parsed.segments;
        const a = segs[0].symbol, b = segs[1].symbol, c = segs[2].symbol, d = segs[3].symbol;
        const v0 = segs[0].variable, v1 = segs[1].variable, v2 = segs[2].variable, v3 = segs[3].variable;

        // a^n b^m c^m d^n — nested dependency
        if (v0 && v3 && v0 === v3 && v1 && v2 && v1 === v2 && v0 !== v1) {
            return LanguageParser._buildNestedFourPDA(a, b, c, d);
        }

        // a^n b^n c^m d^m — two independent pairs
        if (v0 && v1 && v0 === v1 && v2 && v3 && v2 === v3 && v0 !== v2) {
            return LanguageParser._buildTwoPairPDA(a, b, c, d);
        }

        throw new Error(JSON.stringify({
            reason: `The 4-symbol pattern ${a}^${v0} ${b}^${v1} ${c}^${v2} ${d}^${v3} may not be a CFL. Only nested or sequential pair dependencies can be handled by a PDA.`
        }));
    }

    // ── Three-symbol sub-generators ───────────────────────────

    static _buildPrefixMatchPDA(x, y, z) {
        return {
            pdaType: 'DPDA',
            classification: 'SINGLE_DEPENDENCY',
            reason: `'${x}' and '${y}' are count-matched (push for ${x}, pop for ${y}). '${z}' is independent and passes through without stack mutation.`,
            examples: {
                accepted: [`${x}${y}${z}`, `${x}${x}${y}${y}${z}${z}`, `${x}${y}`, `${z}`],
                rejected: [`${x}${z}`, `${y}${x}${z}`, `${x}${x}${y}`]
            },
            states: ['q0', 'q_pop', 'q_z', 'q_accept'],
            inputAlphabet: [x, y, z],
            stackAlphabet: ['Z', 'A'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                `// --- Push for '${x}' ---`,
                `q0, ${x}, Z -> q0, AZ`,
                `q0, ${x}, A -> q0, AA`,
                `// --- Pop for '${y}' ---`,
                `q0, ${y}, A -> q_pop, ε`,
                `q_pop, ${y}, A -> q_pop, ε`,
                `// --- Read '${z}' (independent, no stack change) ---`,
                `q0, ${z}, Z -> q_z, Z`,
                `q_pop, ${z}, Z -> q_z, Z`,
                `q_z, ${z}, Z -> q_z, Z`,
                `// --- Accept ---`,
                `q0, ε, Z -> q_accept, Z`,
                `q_pop, ε, Z -> q_accept, Z`,
                `q_z, ε, Z -> q_accept, Z`
            ].join('\n')
        };
    }

    static _buildSuffixMatchPDA(x, y, z) {
        return {
            pdaType: 'DPDA',
            classification: 'SINGLE_DEPENDENCY',
            reason: `'${x}' is independent (no stack). '${y}' and '${z}' are count-matched (push for ${y}, pop for ${z}).`,
            examples: {
                accepted: [`${x}${y}${z}`, `${x}${x}${y}${y}${z}${z}`, `${y}${z}`],
                rejected: [`${x}${y}`, `${y}${y}${z}`, `${z}${y}`]
            },
            states: ['q0', 'q_y', 'q_pop', 'q_accept'],
            inputAlphabet: [x, y, z],
            stackAlphabet: ['Z', 'A'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                `// --- Read '${x}' (independent, stack untouched) ---`,
                `q0, ${x}, Z -> q0, Z`,
                `// --- Push for '${y}' ---`,
                `q0, ${y}, Z -> q_y, AZ`,
                `q_y, ${y}, A -> q_y, AA`,
                `q_y, ${y}, Z -> q_y, AZ`,
                `// --- Pop for '${z}' ---`,
                `q_y, ${z}, A -> q_pop, ε`,
                `q_pop, ${z}, A -> q_pop, ε`,
                `// --- Accept ---`,
                `q0, ε, Z -> q_accept, Z`,
                `q_pop, ε, Z -> q_accept, Z`
            ].join('\n')
        };
    }

    static _buildOuterMatchPDA(x, y, z) {
        return {
            pdaType: 'DPDA',
            classification: 'SINGLE_DEPENDENCY',
            reason: `Outer symbols '${x}' and '${z}' are count-matched (push for ${x}, pop for ${z}). Inner symbol '${y}' passes through independently without stack mutation.`,
            examples: {
                accepted: [`${x}${y}${z}`, `${x}${y}${y}${y}${z}`, `${x}${x}${y}${z}${z}`],
                rejected: [`${x}${y}`, `${y}${z}`, `${x}${y}${z}${z}`, `${x}${x}${y}${z}`]
            },
            states: ['q0', 'q_y', 'q_pop', 'q_accept'],
            inputAlphabet: [x, y, z],
            stackAlphabet: ['Z', 'A'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                `// --- Phase 1: Push for '${x}' ---`,
                `q0, ${x}, Z -> q0, AZ`,
                `q0, ${x}, A -> q0, AA`,
                `// --- Phase 2: Ignore '${y}' (pass-through) ---`,
                `q0, ${y}, A -> q_y, A`,
                `q_y, ${y}, A -> q_y, A`,
                `q0, ${y}, Z -> q_y, Z`,
                `q_y, ${y}, Z -> q_y, Z`,
                `// --- Phase 3: Pop for '${z}' ---`,
                `q0, ${z}, A -> q_pop, ε`,
                `q_y, ${z}, A -> q_pop, ε`,
                `q_pop, ${z}, A -> q_pop, ε`,
                `// --- Accept ---`,
                `q0, ε, Z -> q_accept, Z`,
                `q_y, ε, Z -> q_accept, Z`,
                `q_pop, ε, Z -> q_accept, Z`
            ].join('\n')
        };
    }

    static _buildAdditionPDA(x, y, z) {
        return {
            pdaType: 'DPDA',
            classification: 'SINGLE_DEPENDENCY',
            reason: `Both '${x}' and '${y}' push markers onto the stack. '${z}' pops them, requiring count(${z}) = count(${x}) + count(${y}).`,
            examples: {
                accepted: [`${x}${z}`, `${y}${z}`, `${x}${y}${z}${z}`],
                rejected: [`${x}${y}${z}`, `${z}${z}`]
            },
            states: ['q0', 'q1', 'q_pop', 'q_accept'],
            inputAlphabet: [x, y, z],
            stackAlphabet: ['Z', 'A'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                `// --- Phase 1: Push for '${x}' ---`,
                `q0, ${x}, Z -> q0, AZ`,
                `q0, ${x}, A -> q0, AA`,
                `// --- Phase 2: Push for '${y}' ---`,
                `q0, ${y}, Z -> q1, AZ`,
                `q0, ${y}, A -> q1, AA`,
                `q1, ${y}, Z -> q1, AZ`,
                `q1, ${y}, A -> q1, AA`,
                `// --- Phase 3: Pop for '${z}' ---`,
                `q0, ${z}, A -> q_pop, ε`,
                `q1, ${z}, A -> q_pop, ε`,
                `q_pop, ${z}, A -> q_pop, ε`,
                `// --- Accept ---`,
                `q0, ε, Z -> q_accept, Z`,
                `q_pop, ε, Z -> q_accept, Z`
            ].join('\n')
        };
    }

    // ── Four-symbol generators ────────────────────────────────

    static _buildNestedFourPDA(a, b, c, d) {
        // a^n b^m c^m d^n — nested: push A for a, push B for b, pop B for c, pop A for d
        return {
            pdaType: 'DPDA',
            classification: 'SINGLE_DEPENDENCY',
            reason: `Nested dependency: '${a}' and '${d}' form the outer pair (push/pop A), '${b}' and '${c}' form the inner pair (push/pop B). Two stack symbols handle this cleanly.`,
            examples: {
                accepted: [`${a}${b}${c}${d}`, `${a}${a}${b}${c}${d}${d}`, `${a}${b}${b}${c}${c}${d}`],
                rejected: [`${a}${b}${d}`, `${a}${c}${b}${d}`, `${b}${c}`]
            },
            states: ['q0', 'q_b', 'q_c', 'q_d', 'q_accept'],
            inputAlphabet: [a, b, c, d],
            stackAlphabet: ['Z', 'A', 'B'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                `// --- Push A for '${a}' ---`,
                `q0, ${a}, Z -> q0, AZ`,
                `q0, ${a}, A -> q0, AA`,
                `// --- Push B for '${b}' ---`,
                `q0, ${b}, A -> q_b, BA`,
                `q0, ${b}, Z -> q_b, BZ`,
                `q_b, ${b}, B -> q_b, BB`,
                `q_b, ${b}, A -> q_b, BA`,
                `// --- Pop B for '${c}' ---`,
                `q_b, ${c}, B -> q_c, ε`,
                `q_c, ${c}, B -> q_c, ε`,
                `// --- Pop A for '${d}' ---`,
                `q_c, ${d}, A -> q_d, ε`,
                `q0, ${d}, A -> q_d, ε`,
                `q_d, ${d}, A -> q_d, ε`,
                `// --- Accept ---`,
                `q0, ε, Z -> q_accept, Z`,
                `q_d, ε, Z -> q_accept, Z`
            ].join('\n')
        };
    }

    static _buildTwoPairPDA(a, b, c, d) {
        // a^n b^n c^m d^m — sequential independent pairs; push for a, pop for b, push for c, pop for d
        return {
            pdaType: 'DPDA',
            classification: 'SINGLE_DEPENDENCY',
            reason: `Two sequential independent pairs: '${a}^n ${b}^n' and '${c}^m ${d}^m'. Each pair uses push-pop. After the first pair empties the stack, the second pair reuses it.`,
            examples: {
                accepted: [`${a}${b}${c}${d}`, `${a}${a}${b}${b}${c}${d}`, `${a}${b}${c}${c}${d}${d}`],
                rejected: [`${a}${b}${d}`, `${a}${c}${d}`, `${a}${a}${b}${c}${d}`]
            },
            states: ['q0', 'q_b', 'q_c', 'q_d', 'q_accept'],
            inputAlphabet: [a, b, c, d],
            stackAlphabet: ['Z', 'A'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                `// --- Push A for '${a}' ---`,
                `q0, ${a}, Z -> q0, AZ`,
                `q0, ${a}, A -> q0, AA`,
                `// --- Pop A for '${b}' ---`,
                `q0, ${b}, A -> q_b, ε`,
                `q_b, ${b}, A -> q_b, ε`,
                `// --- Push A for '${c}' ---`,
                `q_b, ${c}, Z -> q_c, AZ`,
                `q0, ${c}, Z -> q_c, AZ`,
                `q_c, ${c}, A -> q_c, AA`,
                `// --- Pop A for '${d}' ---`,
                `q_c, ${d}, A -> q_d, ε`,
                `q_d, ${d}, A -> q_d, ε`,
                `// --- Accept ---`,
                `q0, ε, Z -> q_accept, Z`,
                `q_b, ε, Z -> q_accept, Z`,
                `q_d, ε, Z -> q_accept, Z`
            ].join('\n')
        };
    }

    // ── C. LINEAR (ratio push/pop) ────────────────────────────
    static _buildLinearPDA(parsed) {
        const dep = parsed.dependency;
        const segs = parsed.segments;
        const x = dep.segments[0].symbol;
        const y = dep.segments[1].symbol;
        const k = dep.segments[0].multiplier;
        const j = dep.segments[1].multiplier;
        const minN = parsed.constraints[dep.variable] || 0;

        // Strategy: push j markers for each x, pop k markers for each y
        // This ensures k*count(x) = j*count(y) → count(y) = (k/j)*count(x)
        // Wait, we need x^(kn) y^(jn): push j symbols per x-read, pop k symbols per y-read

        const pushStr = 'A'.repeat(j);
        const states = [];
        const transLines = [];

        if (minN > 0) {
            transLines.push(`// --- Enforce minimum count n >= ${minN} ---`);
            for (let i = 0; i < minN; i++) {
                states.push(`q_req_${i}`);
                if (i === 0) {
                    transLines.push(`q_req_0, ${x}, Z -> q_req_1, ${pushStr}Z`);
                    if (j > 1) transLines.push(`q_req_0, ${x}, A -> q_req_1, ${pushStr}A`);
                } else {
                    transLines.push(`q_req_${i}, ${x}, A -> q_req_${i + 1}, ${pushStr}A`);
                }
            }
            states.push(`q_req_${minN}`);
            transLines.push(`q_req_${minN}, ε, A -> q0, A`);
        }

        states.push('q0', 'q_read_y', 'q_accept');

        // Push phase
        transLines.push(`// --- Push ${j} A's for every '${x}' ---`);
        if (minN === 0) {
            transLines.push(`q0, ${x}, Z -> q0, ${pushStr}Z`);
        }
        transLines.push(`q0, ${x}, A -> q0, ${pushStr}A`);

        // Pop phase
        transLines.push(`// --- Pop ${k} A's for every '${y}' ---`);
        if (k === 1) {
            transLines.push(`q0, ${y}, A -> q_read_y, ε`);
            transLines.push(`q_read_y, ${y}, A -> q_read_y, ε`);
        } else {
            // Multi-pop with intermediate states
            for (let i = 1; i < k; i++) {
                states.push(`q_pop_${i}`);
            }
            transLines.push(`q0, ${y}, A -> q_pop_1, ε`);
            transLines.push(`q_read_y, ${y}, A -> q_pop_1, ε`);
            for (let i = 1; i < k - 1; i++) {
                transLines.push(`q_pop_${i}, ε, A -> q_pop_${i + 1}, ε`);
            }
            transLines.push(`q_pop_${k - 1}, ε, A -> q_read_y, ε`);
        }

        // Accept
        transLines.push(`// --- Accept ---`);
        if (minN === 0) {
            transLines.push(`q0, ε, Z -> q_accept, Z`);
        }
        transLines.push(`q_read_y, ε, Z -> q_accept, Z`);

        const startState = minN > 0 ? 'q_req_0' : 'q0';

        return {
            pdaType: 'DPDA',
            classification: 'LINEAR',
            reason: `'${x}' appears ${k}n times and '${y}' appears ${j}n times, creating a ${k}:${j} ratio. The DPDA pushes ${j} markers per '${x}' and pops ${k} per '${y}' to enforce the ratio.`,
            examples: {
                accepted: [
                    x.repeat(k * Math.max(1, minN)) + y.repeat(j * Math.max(1, minN)),
                    x.repeat(k * (minN + 2)) + y.repeat(j * (minN + 2))
                ],
                rejected: [
                    x + y + x,
                    y + x,
                    x.repeat(k) + y.repeat(j + 1)
                ]
            },
            states,
            inputAlphabet: [x, y],
            stackAlphabet: ['Z', 'A'],
            startState,
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: transLines.join('\n')
        };
    }

    // ── D. NESTED (balanced structures) ───────────────────────
    static _buildNestedPDA(parsed) {
        return {
            pdaType: 'DPDA',
            classification: 'NESTED',
            reason: `Balanced parentheses use strict LIFO matching: each opener pushes, each closer pops. The DPDA accepts when the stack returns to the initial marker after consuming all input.`,
            examples: {
                accepted: ['()', '(())', '()()', '((()))'],
                rejected: ['(()', ')(', '())', '('],
            },
            states: ['q0', 'q_accept'],
            inputAlphabet: ['(', ')'],
            stackAlphabet: ['Z', 'A'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                '// --- Push for opening parenthesis ---',
                'q0, (, Z -> q0, AZ',
                'q0, (, A -> q0, AA',
                '// --- Pop for closing parenthesis ---',
                'q0, ), A -> q0, ε',
                '// --- Accept ---',
                'q0, ε, Z -> q_accept, Z'
            ].join('\n')
        };
    }

    // ── E. MARKED PALINDROME (wcw^R) ──────────────────────────
    static _buildMarkedPalindromePDA(parsed) {
        return {
            pdaType: 'DPDA',
            classification: 'PALINDROME_MARKED',
            reason: `The center marker 'c' deterministically separates the push phase from the pop phase. The DPDA pushes all symbols before 'c', then matches and pops in reverse after 'c'. No guessing required.`,
            examples: {
                accepted: ['aca', 'abcba', 'aabcbaa', 'c'],
                rejected: ['aba', 'abca', 'aa', 'abcab'],
            },
            states: ['q0', 'q1', 'q_accept'],
            inputAlphabet: ['a', 'b', 'c'],
            stackAlphabet: ['Z', 'A', 'B'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                '// --- Phase 1: Push symbols onto stack ---',
                'q0, a, Z -> q0, AZ',
                'q0, b, Z -> q0, BZ',
                'q0, a, A -> q0, AA',
                'q0, a, B -> q0, AB',
                'q0, b, A -> q0, BA',
                'q0, b, B -> q0, BB',
                '// --- Phase 2: Read center marker, switch to matching ---',
                'q0, c, A -> q1, A',
                'q0, c, B -> q1, B',
                'q0, c, Z -> q1, Z',
                '// --- Phase 3: Match and pop in reverse ---',
                'q1, a, A -> q1, ε',
                'q1, b, B -> q1, ε',
                '// --- Accept ---',
                'q1, ε, Z -> q_accept, Z'
            ].join('\n')
        };
    }

    // ── F. UNMARKED PALINDROME (ww^R) — NPDA ─────────────────
    static _buildUnmarkedPalindromePDA(parsed) {
        return {
            pdaType: 'NPDA',
            classification: 'PALINDROME',
            reason: `Without a center marker, the machine cannot deterministically know when the middle of the string has been reached. It must nondeterministically "guess" the midpoint via an ε-transition. This requires an NPDA — the simulator explores all branches via BFS.`,
            examples: {
                accepted: ['aa', 'abba', 'bb', 'baab', ''],
                rejected: ['ab', 'abc', 'aab', 'abab'],
            },
            states: ['q0', 'q1', 'q_accept'],
            inputAlphabet: ['a', 'b'],
            stackAlphabet: ['Z', 'A', 'B'],
            startState: 'q0',
            acceptStates: ['q_accept'],
            initialStackSymbol: 'Z',
            transitionsStr: [
                '// --- Phase 1: Push symbols (building first half) ---',
                'q0, a, Z -> q0, AZ',
                'q0, b, Z -> q0, BZ',
                'q0, a, A -> q0, AA',
                'q0, a, B -> q0, AB',
                'q0, b, A -> q0, BA',
                'q0, b, B -> q0, BB',
                '// --- NONDETERMINISTIC GUESS: switch to matching mode ---',
                '// The NPDA guesses when the midpoint is reached.',
                '// For even-length palindromes:',
                'q0, ε, A -> q1, A',
                'q0, ε, B -> q1, B',
                'q0, ε, Z -> q1, Z',
                '// --- Phase 2: Match and pop in reverse ---',
                'q1, a, A -> q1, ε',
                'q1, b, B -> q1, ε',
                '// --- Accept ---',
                'q1, ε, Z -> q_accept, Z'
            ].join('\n')
        };
    }


    // ═══════════════════════════════════════════════════════════
    //  STEP 7: VALIDATION ENGINE
    // ═══════════════════════════════════════════════════════════

    /**
     * Validate a generated PDA by running test strings through the simulator.
     * @param {Object} config — PDA configuration with examples
     * @returns {Object} validation results
     */
    static validate(config) {
        const results = { valid: true, tests: [] };

        try {
            // Build a temporary PDA engine
            const engine = new PDAEngine();
            const parsed = PDAEngine.parseTransitions(config.transitionsStr);

            engine.configure({
                states: config.states,
                inputAlphabet: config.inputAlphabet,
                stackAlphabet: config.stackAlphabet,
                initialStackSymbol: config.initialStackSymbol,
                startState: config.startState,
                acceptStates: config.acceptStates,
                transitions: parsed,
            });

            const validation = engine.validate();
            if (!validation.valid) {
                results.valid = false;
                results.engineErrors = validation.errors;
                return results;
            }

            // Test accepted strings
            if (config.examples && config.examples.accepted) {
                for (const str of config.examples.accepted) {
                    const run = engine.run(str, 10000);
                    const testResult = {
                        input: str === '' ? 'ε (empty)' : str,
                        expected: 'accept',
                        actual: run.accepted ? 'accept' : 'reject',
                        pass: run.accepted,
                    };
                    results.tests.push(testResult);
                    if (!run.accepted) results.valid = false;
                }
            }

            // Test rejected strings
            if (config.examples && config.examples.rejected) {
                for (const str of config.examples.rejected) {
                    const run = engine.run(str, 10000);
                    const testResult = {
                        input: str === '' ? 'ε (empty)' : str,
                        expected: 'reject',
                        actual: run.accepted ? 'accept' : 'reject',
                        pass: !run.accepted,
                    };
                    results.tests.push(testResult);
                    if (run.accepted) results.valid = false;
                }
            }
        } catch (e) {
            results.valid = false;
            results.error = e.message;
        }

        return results;
    }


    // ═══════════════════════════════════════════════════════════
    //  MAIN ENTRY POINT — FULL PIPELINE
    // ═══════════════════════════════════════════════════════════

    /**
     * Parse a language string and generate a validated PDA.
     * This is the main entry point called by the UI.
     *
     * @param {string} langStr — user input
     * @param {string} mode — 'DPDA' or 'NPDA' (from the toggle)
     * @returns {Object} PDA configuration with metadata
     * @throws {Error} if language cannot be generated in the requested mode
     */
    static parse(langStr, mode) {
        mode = mode || 'DPDA';

        if (!langStr || !langStr.trim()) {
            throw new Error(JSON.stringify({ reason: 'Please enter a language string.' }));
        }

        console.log('[PDA-Engine] Parsing:', langStr, '| Mode:', mode);

        // ── Step 1: Parse ─────────────────────────────────────
        const parsed = LanguageParser.parseLangString(langStr);
        console.log('[PDA-Engine] Parsed structure:', parsed);

        // ── Step 2: Classify ──────────────────────────────────
        const classified = LanguageParser.classify(parsed);
        console.log('[PDA-Engine] Classification:', classified.type);

        // ── Step 3: Decide (raw capability) ───────────────────
        const capability = LanguageParser.decidePDAType(classified.type);
        console.log('[PDA-Engine] Capability:', capability, '| User mode:', mode);

        // ── UNKNOWN input ─────────────────────────────────────
        if (classified.type === 'UNKNOWN') {
            throw new Error(JSON.stringify({
                reason: `Unrecognized language format. Try set notation like '{ a^n b^n | n >= 0 }', 'a^n b^m c^p', 'ww^R', 'wcw^R', or 'balanced parentheses'.`,
                classification: 'UNKNOWN',
                pdaType: 'NOT_POSSIBLE',
                status: 'error'
            }));
        }

        // ── NOT POSSIBLE (multi-dependency / non-CFL) ─────────
        if (capability === 'NOT_POSSIBLE') {
            throw new Error(JSON.stringify({
                reason: classified.classification || `This language is not context-free. PDA cannot be constructed.`,
                classification: classified.type,
                pdaType: 'NOT_POSSIBLE',
                status: 'error'
            }));
        }

        // ── MODE-AWARE DECISION LOGIC ─────────────────────────
        //
        // User selected DPDA but language requires NPDA:
        //   → Block generation, show yellow warning
        //
        // User selected NPDA but language is DPDA-possible:
        //   → Generate the PDA (DPDA is a subset of NPDA)
        //
        // User selected NPDA and language requires NPDA:
        //   → Generate the NPDA

        if (mode === 'DPDA' && capability === 'NPDA') {
            throw new Error(JSON.stringify({
                reason: `DPDA not possible. This language requires nondeterminism (ε-guessing for the midpoint). Switch to NPDA mode to generate.`,
                classification: classified.type,
                pdaType: 'NPDA_ONLY',
                status: 'warning'
            }));
        }

        // ── Step 4 & 5: Construct PDA ─────────────────────────
        const config = LanguageParser.constructPDA(classified);
        config.classification = classified.type;
        config.pdaType = capability; // 'DPDA' or 'NPDA'
        config.userMode = mode;

        // ── Step 7: Validate ──────────────────────────────────
        const validation = LanguageParser.validate(config);
        config.validation = validation;

        console.log('[PDA-Engine] Validation:', validation.valid ? 'PASSED' : 'FAILED', validation);

        // Auto-fill first sample input
        if (config.examples && config.examples.accepted && config.examples.accepted.length > 0) {
            config.sampleInput = config.examples.accepted[0];
        }

        return config;
    }
}


/**
 * ============================================================
 *  PDA ENGINE — Pushdown Automata Simulation Logic
 * ============================================================
 *
 *  This file contains ONLY the computation logic for a PDA.
 *  No UI code lives here — the UI will import and use this class.
 *
 *  Key concepts:
 *    • A PDA reads an input string one symbol at a time.
 *    • It has a stack it can push to and pop from.
 *    • A transition is: (currentState, inputSymbol, stackTop)
 *                        → (nextState, symbolsToPush)
 *    • The PDA accepts if it reaches an accept state after
 *      consuming the entire input.
 *    • PDAs can be non-deterministic: multiple transitions may
 *      apply at once.  We use BFS to explore every path.
 *
 *  Transition text format (one per line):
 *    fromState, inputSymbol, stackPop -> toState, stackPush
 *
 *  Examples:
 *    q0, a, Z -> q0, AZ      (read 'a', pop Z, push A then Z)
 *    q0, ε, Z -> q1, Z       (epsilon move, pop Z, push Z back)
 *    q1, b, A -> q1, ε       (read 'b', pop A, push nothing)
 *
 *  Stack convention:
 *    stack[0] = top of stack.
 *    stackPush string "AZ" means A ends up on top, Z below.
 *    stackPush "ε" means push nothing (just pop).
 * ============================================================
 */

class PDAEngine {

    // ── Constructor ──────────────────────────────────────────
    constructor() {
        this.states           = [];   // e.g. ['q0', 'q1', 'q2']
        this.inputAlphabet    = [];   // e.g. ['a', 'b']
        this.stackAlphabet    = [];   // e.g. ['Z', 'A']
        this.transitions      = [];   // array of transition objects
        this.startState       = '';   // e.g. 'q0'
        this.acceptStates     = [];   // e.g. ['q2']
        this.initialStackSymbol = 'Z'; // bottom-of-stack marker
    }

    // ── Configure ────────────────────────────────────────────
    // Load a full PDA definition at once.
    configure(config) {
        this.states             = config.states           || [];
        this.inputAlphabet      = config.inputAlphabet    || [];
        this.stackAlphabet      = config.stackAlphabet    || [];
        this.transitions        = config.transitions      || [];
        this.startState         = config.startState       || '';
        this.acceptStates       = config.acceptStates     || [];
        this.initialStackSymbol = config.initialStackSymbol || 'Z';
    }

    // ═══════════════════════════════════════════════════════════
    //  TRANSITION PARSING
    // ═══════════════════════════════════════════════════════════

    /**
     * Parse multi-line transition text into an array of objects.
     *
     * Each line: "fromState, input, stackPop -> toState, stackPush"
     * Lines starting with "//" are treated as comments and skipped.
     *
     * @param  {string} text  — raw text from a textarea
     * @return {Array}        — [{from, input, stackPop, to, stackPush}, …]
     */
    static parseTransitions(text) {
        const transitions = [];

        // Split into lines, trim whitespace, skip blanks & comments
        const lines = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('//'));

        for (const line of lines) {
            // Split on the arrow  ->
            const halves = line.split('->').map(s => s.trim());
            if (halves.length !== 2) continue; // malformed, skip

            // Left side:  fromState, inputSymbol, stackPop
            const left  = halves[0].split(',').map(s => s.trim());
            // Right side: toState, stackPush
            const right = halves[1].split(',').map(s => s.trim());

            if (left.length !== 3 || right.length !== 2) continue; // malformed

            transitions.push({
                from:      left[0],
                input:     PDAEngine.normalizeEpsilon(left[1]),
                stackPop:  left[2],
                to:        right[0],
                stackPush: PDAEngine.normalizeEpsilon(right[1]),
            });
        }

        return transitions;
    }

    /**
     * Convert common epsilon notations to the single 'ε' character.
     * Accepts: "eps", "epsilon", "ε", "" (empty string).
     */
    static normalizeEpsilon(symbol) {
        const lower = symbol.toLowerCase();
        if (lower === 'eps' || lower === 'epsilon' || symbol === 'ε' || symbol === '') {
            return 'ε';
        }
        return symbol;
    }

    // ═══════════════════════════════════════════════════════════
    //  TRANSITION LOOKUP
    // ═══════════════════════════════════════════════════════════

    /**
     * Find all transitions that match (state, inputChar, stackTop).
     *
     * Returns two separate lists so the caller can handle
     * input-consuming vs. epsilon moves differently.
     *
     * @param  {string} state     — current state name
     * @param  {string|null} inputChar — next input symbol (null if input exhausted)
     * @param  {string} stackTop  — symbol on top of the stack
     * @return {{ inputTrans: Array, epsTrans: Array }}
     */
    getTransitions(state, inputChar, stackTop) {
        const inputTrans = []; // transitions that consume an input symbol
        const epsTrans   = []; // epsilon transitions (consume nothing)

        for (const t of this.transitions) {
            // Must match current state and stack top
            if (t.from !== state || t.stackPop !== stackTop) continue;

            if (t.input === inputChar)  inputTrans.push(t);
            if (t.input === 'ε')        epsTrans.push(t);
        }

        return { inputTrans, epsTrans };
    }

    // ═══════════════════════════════════════════════════════════
    //  STACK OPERATIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * Apply a transition's stack effect.
     *   1. Pop the top element.
     *   2. Push the stackPush string (first char = new top).
     *
     * @param  {Array}  stack      — current stack (index 0 = top)
     * @param  {Object} transition — the transition to apply
     * @return {Array}  newStack   — new stack after pop & push
     */
    applyStackOperation(stack, transition) {
        // 1. Pop — remove the top element
        const newStack = stack.slice(1);

        // 2. Push — add symbols from stackPush string
        //    "ε" means push nothing (pure pop).
        //    Otherwise, push right-to-left so first char ends on top.
        if (transition.stackPush !== 'ε') {
            for (let i = transition.stackPush.length - 1; i >= 0; i--) {
                newStack.unshift(transition.stackPush[i]);
            }
        }

        return newStack;
    }

    // ═══════════════════════════════════════════════════════════
    //  MAIN SIMULATION  (BFS for nondeterminism)
    // ═══════════════════════════════════════════════════════════

    /**
     * Run the PDA on an input string.
     *
     * Uses Breadth-First Search so that ALL nondeterministic
     * branches are explored.  If ANY branch reaches an accept
     * state with an empty remaining input, the string is accepted.
     *
     * @param  {string} inputString — the string to test
     * @param  {number} maxConfigs  — safety limit to prevent infinite loops
     * @return {Object} result:
     *   {
     *     accepted: boolean,
     *     trace:    [ ...step objects... ],
     *     message:  string
     *   }
     *
     * Each step object in the trace contains:
     *   {
     *     step:       number,    — step index (0 = initial)
     *     state:      string,    — current state AFTER this step
     *     input:      string,    — symbol read ('-' for initial, 'ε' for epsilon)
     *     stackPop:   string,    — symbol popped
     *     stackPush:  string,    — symbol(s) pushed
     *     remaining:  string,    — remaining input AFTER this step
     *     stack:      string[],  — full stack AFTER this step (index 0 = top)
     *     from:       string,    — state BEFORE transition (absent for initial)
     *     to:         string,    — state AFTER  transition (absent for initial)
     *     transition: Object,    — the raw transition used   (absent for initial)
     *     type:       string     — 'initial' | 'input' | 'epsilon'
     *   }
     */
    run(inputString, maxConfigs = 5000) {

        // ── Step 0: build the initial configuration ──────────
        const initialStep = {
            step:      0,
            state:     this.startState,
            input:     '-',
            stackPop:  '-',
            stackPush: '-',
            remaining: inputString,
            stack:     [this.initialStackSymbol],
            type:      'initial',
        };

        const initialConfig = {
            state:     this.startState,
            remaining: inputString,
            stack:     [this.initialStackSymbol],
            trace:     [initialStep],
        };

        // Special case: empty input + start state is accepting
        if (inputString === '' && this.acceptStates.includes(this.startState)) {
            return {
                accepted: true,
                trace:    initialConfig.trace,
                message:  'String accepted! (empty input, start state is accepting)',
            };
        }

        // ── BFS queue ────────────────────────────────────────
        const queue = [initialConfig];
        let explored = 0;

        while (queue.length > 0 && explored < maxConfigs) {
            const config = queue.shift();
            explored++;

            // If the stack is empty no transition can fire → dead end
            if (config.stack.length === 0) continue;

            const stackTop  = config.stack[0];
            const inputChar = config.remaining.length > 0
                ? config.remaining[0]
                : null;

            // Find matching transitions
            const { inputTrans, epsTrans } = this.getTransitions(
                config.state, inputChar, stackTop
            );

            // ── Try input-consuming transitions ──────────────
            if (inputChar !== null) {
                for (const t of inputTrans) {
                    const newStack     = this.applyStackOperation(config.stack, t);
                    const newRemaining = config.remaining.substring(1);

                    const step = {
                        step:      config.trace.length,
                        state:     t.to,
                        input:     inputChar,
                        stackPop:  t.stackPop,
                        stackPush: t.stackPush,
                        remaining: newRemaining,
                        stack:     [...newStack],
                        from:      t.from,
                        to:        t.to,
                        type:      'input',
                        transition: t,
                    };

                    const newConfig = {
                        state:     t.to,
                        remaining: newRemaining,
                        stack:     newStack,
                        trace:     [...config.trace, step],
                    };

                    // ✅ Acceptance check
                    if (newRemaining === '' && this.acceptStates.includes(t.to)) {
                        return {
                            accepted: true,
                            trace:    newConfig.trace,
                            message:  'String accepted!',
                        };
                    }

                    queue.push(newConfig);
                }
            }

            // ── Try epsilon transitions ──────────────────────
            for (const t of epsTrans) {
                const newStack = this.applyStackOperation(config.stack, t);

                const step = {
                    step:      config.trace.length,
                    state:     t.to,
                    input:     'ε',
                    stackPop:  t.stackPop,
                    stackPush: t.stackPush,
                    remaining: config.remaining,
                    stack:     [...newStack],
                    from:      t.from,
                    to:        t.to,
                    type:      'epsilon',
                    transition: t,
                };

                const newConfig = {
                    state:     t.to,
                    remaining: config.remaining,
                    stack:     newStack,
                    trace:     [...config.trace, step],
                };

                // ✅ Acceptance check
                if (config.remaining === '' && this.acceptStates.includes(t.to)) {
                    return {
                        accepted: true,
                        trace:    newConfig.trace,
                        message:  'String accepted!',
                    };
                }

                queue.push(newConfig);
            }
        }

        // ── No accepting path found ──────────────────────────
        return {
            accepted: false,
            trace:    initialConfig.trace,
            message:  explored >= maxConfigs
                ? 'Exploration limit reached — string rejected (PDA may loop).'
                : 'String rejected — no accepting computation path found.',
        };
    }

    // ═══════════════════════════════════════════════════════════
    //  VALIDATION
    // ═══════════════════════════════════════════════════════════

    /**
     * Check whether the PDA definition is well-formed.
     * @return {{ valid: boolean, errors: string[] }}
     */
    validate() {
        const errors = [];

        if (!this.states.length)
            errors.push('No states defined.');

        if (!this.startState)
            errors.push('No start state specified.');
        else if (!this.states.includes(this.startState))
            errors.push(`Start state "${this.startState}" is not in the state set.`);

        if (!this.acceptStates.length)
            errors.push('No accept states specified.');

        for (const s of this.acceptStates) {
            if (!this.states.includes(s))
                errors.push(`Accept state "${s}" is not in the state set.`);
        }

        if (!this.transitions.length)
            errors.push('No transitions defined.');

        for (const t of this.transitions) {
            if (!this.states.includes(t.from))
                errors.push(`Transition references unknown source state "${t.from}".`);
            if (!this.states.includes(t.to))
                errors.push(`Transition references unknown target state "${t.to}".`);
        }

        return { valid: errors.length === 0, errors };
    }

    // ═══════════════════════════════════════════════════════════
    //  PRELOADED EXAMPLES
    // ═══════════════════════════════════════════════════════════

    /**
     * Return preset PDA configurations for demonstration.
     * Each preset includes all fields needed to call configure().
     */
    static getExamples() {
        return {

            // ── Example 1: Balanced Parentheses ──────────────
            'balanced-parens': {
                name:             'Balanced Parentheses',
                description:      'Accepts strings like "()", "(())", "()()"',
                states:           ['q0', 'q1'],
                inputAlphabet:    ['(', ')'],
                stackAlphabet:    ['Z', 'A'],
                startState:       'q0',
                acceptStates:     ['q1'],
                initialStackSymbol: 'Z',
                transitions: PDAEngine.parseTransitions([
                    'q0, (, Z -> q0, AZ',   // first '(' → push A
                    'q0, (, A -> q0, AA',   // more '(' → push A
                    'q0, ), A -> q0, ε',    // ')' → pop A
                    'q0, ε, Z -> q1, Z',    // done → accept
                ].join('\n')),
                sampleInputs: ['(())', '()()', '((()))', '(()', '())'],
            },

            // ── Example 2: aⁿbⁿ ─────────────────────────────
            'anbn': {
                name:             'aⁿbⁿ  (equal a\'s then b\'s)',
                description:      'Accepts strings like "ab", "aabb", "aaabbb"',
                states:           ['q0', 'q1', 'q2'],
                inputAlphabet:    ['a', 'b'],
                stackAlphabet:    ['Z', 'A'],
                startState:       'q0',
                acceptStates:     ['q2'],
                initialStackSymbol: 'Z',
                transitions: PDAEngine.parseTransitions([
                    'q0, a, Z -> q0, AZ',   // first 'a' → push A
                    'q0, a, A -> q0, AA',   // more 'a' → push A
                    'q0, b, A -> q1, ε',    // first 'b' → pop A, switch state
                    'q1, b, A -> q1, ε',    // more 'b' → keep popping
                    'q1, ε, Z -> q2, Z',    // all matched → accept
                ].join('\n')),
                sampleInputs: ['ab', 'aabb', 'aaabbb', 'aab', 'abb'],
            },

            // ── Example 3: wcwᴿ (palindrome with center marker)
            'wcwr': {
                name:             'wcwᴿ  (palindrome with center marker)',
                description:      'Accepts strings like "aca", "abcba", "aabcbaa"',
                states:           ['q0', 'q1', 'q2'],
                inputAlphabet:    ['a', 'b', 'c'],
                stackAlphabet:    ['Z', 'A', 'B'],
                startState:       'q0',
                acceptStates:     ['q2'],
                initialStackSymbol: 'Z',
                transitions: PDAEngine.parseTransitions([
                    // Phase 1: push symbols until center marker 'c'
                    'q0, a, Z -> q0, AZ',
                    'q0, b, Z -> q0, BZ',
                    'q0, a, A -> q0, AA',
                    'q0, a, B -> q0, AB',
                    'q0, b, A -> q0, BA',
                    'q0, b, B -> q0, BB',
                    // Phase 2: read 'c', switch to matching mode
                    'q0, c, A -> q1, A',
                    'q0, c, B -> q1, B',
                    'q0, c, Z -> q1, Z',
                    // Phase 3: match and pop
                    'q1, a, A -> q1, ε',
                    'q1, b, B -> q1, ε',
                    // Phase 4: accept
                    'q1, ε, Z -> q2, Z',
                ].join('\n')),
                sampleInputs: ['aca', 'abcba', 'aabcbaa', 'abc', 'abcab'],
            },
        };
    }
}

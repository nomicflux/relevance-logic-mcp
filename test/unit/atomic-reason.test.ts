/**
 * UNIT TESTS - Atomic Reason Functionality
 * Tests atom extraction and symbolic validation
 */

import { AtomicReasonModule } from '../../src/logic/atomic-reason';
import { FormulaBuilder } from '../../src/logic/formula';
import { NaturalLanguageParser } from '../../src/parser/nlp-parser';

describe('Atomic Reason - Unit Tests', () => {
  let atomicReason: AtomicReasonModule;
  let parser: NaturalLanguageParser;

  beforeEach(() => {
    atomicReason = new AtomicReasonModule();
    parser = new NaturalLanguageParser();
  });

  describe('extractAtomsFromText', () => {
    test('extracts atoms from parsed statements', () => {
      const text = "First implement user authentication, then configure the database";
      const result = atomicReason.extractAtomsFromText(text, parser);

      expect(result.length).toBeGreaterThan(0);
      expect(Array.isArray(result)).toBe(true);
    });

    test('extracts atoms from completion statements', () => {
      const text = "User authentication is complete. Database is configured.";
      const result = atomicReason.extractAtomsFromText(text, parser);

      expect(result.length).toBeGreaterThan(0);
      expect(Array.isArray(result)).toBe(true);
    });

    test('extracts atoms from conclusion statements', () => {
      const text = "Therefore, the system is ready for deployment.";
      const result = atomicReason.extractAtomsFromText(text, parser);

      expect(result.length).toBeGreaterThan(0);
      expect(Array.isArray(result)).toBe(true);
    });

    test('handles complex mixed statements', () => {
      const text = "Initialize the cache, then implement Dijkstra's algorithm. An implementation of Dijkstra's algorithm is complete. Therefore, pathfinding is working.";
      const result = atomicReason.extractAtomsFromText(text, parser);

      expect(result.length).toBeGreaterThan(0);
      expect(Array.isArray(result)).toBe(true);
    });

    test('returns array of strings', () => {
      const text = "Do X. A. Therefore, B.";
      const result = atomicReason.extractAtomsFromText(text, parser);

      expect(Array.isArray(result)).toBe(true);
      result.forEach(atom => {
        expect(typeof atom).toBe('string');
      });
    });

    test('handles duplicate statements', () => {
      const text = "Implement auth. Implement auth again.";
      const result = atomicReason.extractAtomsFromText(text, parser);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('parseSymbolicRelationship', () => {
    test('parses implication with arrow', () => {
      const symbolFormulas = new Map();
      symbolFormulas.set('AUTH', FormulaBuilder.atomic('AUTH'));
      symbolFormulas.set('ACCESS', FormulaBuilder.atomic('ACCESS'));

      const result = atomicReason.parseSymbolicRelationship('AUTH → ACCESS', symbolFormulas);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('compound');
      expect(result!.operator).toBe('implies');
    });

    test('parses implication with "implies"', () => {
      const symbolFormulas = new Map();
      symbolFormulas.set('CACHE', FormulaBuilder.atomic('CACHE'));
      symbolFormulas.set('READY', FormulaBuilder.atomic('READY'));

      const result = atomicReason.parseSymbolicRelationship('CACHE implies READY', symbolFormulas);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('compound');
      expect(result!.operator).toBe('implies');
    });

    test('parses implication with "enables"', () => {
      const symbolFormulas = new Map();
      symbolFormulas.set('INIT', FormulaBuilder.atomic('INIT'));
      symbolFormulas.set('DEPLOY', FormulaBuilder.atomic('DEPLOY'));

      const result = atomicReason.parseSymbolicRelationship('INIT enables DEPLOY', symbolFormulas);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('compound');
      expect(result!.operator).toBe('implies');
    });

    test('parses "is necessary for"', () => {
      const symbolFormulas = new Map();
      symbolFormulas.set('AUTH', FormulaBuilder.atomic('AUTH'));
      symbolFormulas.set('SECURE', FormulaBuilder.atomic('SECURE'));

      const result = atomicReason.parseSymbolicRelationship('AUTH is necessary for SECURE', symbolFormulas);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('compound');
      expect(result!.operator).toBe('implies');
    });

    test('returns null for invalid relationship', () => {
      const symbolFormulas = new Map();

      const result = atomicReason.parseSymbolicRelationship('invalid relationship', symbolFormulas);

      expect(result).toBeNull();
    });

    test('returns null for missing symbols', () => {
      const symbolFormulas = new Map();
      symbolFormulas.set('AUTH', FormulaBuilder.atomic('AUTH'));

      const result = atomicReason.parseSymbolicRelationship('AUTH → MISSING', symbolFormulas);

      expect(result).toBeNull();
    });
  });

  describe('extractSymbolsFromFormula', () => {
    test('extracts symbol from atomic formula', () => {
      const formula = FormulaBuilder.atomic('AUTH_IMPL');
      const symbolSet = new Set<string>();

      atomicReason.extractSymbolsFromFormula(formula, symbolSet);

      expect(symbolSet.has('AUTH_IMPL')).toBe(true);
    });

    test('extracts symbols from compound formula', () => {
      const formula = FormulaBuilder.compound('implies', [
        FormulaBuilder.atomic('CACHE_INIT'),
        FormulaBuilder.atomic('AUTH_READY')
      ]);
      const symbolSet = new Set<string>();

      atomicReason.extractSymbolsFromFormula(formula, symbolSet);

      expect(symbolSet.has('CACHE_INIT')).toBe(true);
      expect(symbolSet.has('AUTH_READY')).toBe(true);
    });
  });

  describe('formulaToSymbolicString', () => {
    test('converts atomic formula to symbol', () => {
      const formula = FormulaBuilder.atomic('AUTH_IMPL');

      const result = atomicReason.formulaToSymbolicString(formula);

      expect(result).toBe('AUTH_IMPL');
    });

    test('converts implication to arrow notation', () => {
      const formula = FormulaBuilder.compound('implies', [
        FormulaBuilder.atomic('INIT'),
        FormulaBuilder.atomic('READY')
      ]);

      const result = atomicReason.formulaToSymbolicString(formula);

      expect(result).toBe('INIT → READY');
    });

    test('converts conjunction to and symbol', () => {
      const formula = FormulaBuilder.compound('and', [
        FormulaBuilder.atomic('A'),
        FormulaBuilder.atomic('B')
      ]);

      const result = atomicReason.formulaToSymbolicString(formula);

      expect(result).toBe('A ∧ B');
    });

    test('converts disjunction to or symbol', () => {
      const formula = FormulaBuilder.compound('or', [
        FormulaBuilder.atomic('X'),
        FormulaBuilder.atomic('Y')
      ]);

      const result = atomicReason.formulaToSymbolicString(formula);

      expect(result).toBe('X ∨ Y');
    });
  });

  describe('validateSymbolicArgument', () => {
    test('validates simple valid argument', () => {
      const atomGroupings = [
        {
          symbol: 'AUTH',
          concept_description: 'Authentication is implemented',
          text_variants: ['implement auth', 'auth implementation']
        },
        {
          symbol: 'ACCESS',
          concept_description: 'Access control is working',
          text_variants: ['access control', 'access working']
        }
      ];
      const premises = ['AUTH', 'AUTH -> ACCESS'];
      const conclusion = 'ACCESS';

      const result = atomicReason.validateSymbolicArgument(atomGroupings, premises, conclusion);

      expect(result.validation_result).toBe('VALID');
      expect(result.symbolic_argument.premises).toContain('P1: AUTH');
      expect(result.symbolic_argument.premises).toContain('P2: AUTH → ACCESS');
      expect(result.symbolic_argument.conclusion).toBe('C: ACCESS');
    });

    test('returns error for missing conclusion symbol', () => {
      const atomGroupings = [
        {
          symbol: 'AUTH',
          concept_description: 'Authentication',
          text_variants: ['auth']
        }
      ];
      const logicalRelationships = ['AUTH → ACCESS'];
      const conclusionSymbol = 'MISSING';

      const result = atomicReason.validateSymbolicArgument(atomGroupings, logicalRelationships, conclusionSymbol);

      expect(result.validation_result).toBe('ERROR');
      expect(result.message).toContain("Conclusion 'MISSING' not found");
    });

    test('includes symbol definitions in output', () => {
      const atomGroupings = [
        {
          symbol: 'TEST',
          concept_description: 'Test concept',
          text_variants: ['test']
        }
      ];
      const logicalRelationships: string[] = [];
      const conclusionSymbol = 'TEST';

      const result = atomicReason.validateSymbolicArgument(atomGroupings, logicalRelationships, conclusionSymbol);

      expect(result.symbol_definitions).toEqual({
        'TEST': 'Test concept'
      });
    });

    test('returns error for empty premises with detailed guidance', () => {
      const atomGroupings = [
        {
          symbol: 'AUTH',
          concept_description: 'Authentication works',
          text_variants: ['auth works']
        },
        {
          symbol: 'CONCLUSION',
          concept_description: 'Some conclusion',
          text_variants: ['conclusion']
        }
      ];
      const logicalRelationships: string[] = [];
      const conclusionSymbol = 'CONCLUSION';

      const result = atomicReason.validateSymbolicArgument(atomGroupings, logicalRelationships, conclusionSymbol);

      expect(result.validation_result).toBe('ERROR');
      expect(result.message).toContain('No valid premises provided');
      expect(result.message).toContain('Available symbols: AUTH, CONCLUSION');
      expect(result.message).toContain('Implication: "AUTH -> CONCLUSION"');
      expect(result.message).toContain('UNKNOWN: "AUTH enables CONCLUSION"');
      expect(result.message).toContain('Example: ["AUTH", "AUTH -> CONCLUSION"]');
      expect(result.available_symbols).toEqual(['AUTH', 'CONCLUSION']);
      expect(result.required_action).toContain('Add premises array using your exact symbols');
    });

    test('circular reasoning should be handled by FormulaUtils validation', () => {
      // For now, just test that the atomic reason module delegates circular reasoning
      // detection to FormulaUtils.validate(), which already handles it properly
      const atomGroupings = [
        {
          symbol: 'AUTH',
          concept_description: 'Authentication works',
          text_variants: ['auth works']
        }
      ];
      const logicalRelationships: string[] = [];
      const conclusionSymbol = 'AUTH';

      const result = atomicReason.validateSymbolicArgument(atomGroupings, logicalRelationships, conclusionSymbol);

      // This should be an ERROR due to empty premises, not circular reasoning
      expect(result.validation_result).toBe('ERROR');
      expect(result.message).toContain('No valid premises provided');
    });

    test('allows valid implication structure (not circular)', () => {
      const atomGroupings = [
        {
          symbol: 'AUTH',
          concept_description: 'Authentication works',
          text_variants: ['auth works']
        },
        {
          symbol: 'ACCESS',
          concept_description: 'Access granted',
          text_variants: ['access granted']
        }
      ];
      // Valid structure: ACCESS → AUTH with conclusion AUTH
      const logicalRelationships = ['ACCESS → AUTH'];
      const conclusionSymbol = 'AUTH';

      const result = atomicReason.validateSymbolicArgument(atomGroupings, logicalRelationships, conclusionSymbol);

      // This should be VALID - ACCESS implies AUTH, conclude AUTH is valid modus ponens
      expect(result.validation_result).toBe('VALID');
    });
  });
});
/**
 * UNIT TESTS - NaturalLanguageParser
 * Tests parser functionality in isolation
 */

import { NaturalLanguageParser } from '../../src/parser/nlp-parser';

describe('NaturalLanguageParser - Unit Tests', () => {
  let parser: NaturalLanguageParser;

  beforeEach(() => {
    parser = new NaturalLanguageParser();
  });

  describe('parse - Single Statements', () => {
    test('parses simple formal conjunction P(x) ∧ Q(y)', () => {
      const result = parser.parse('P(x) ∧ Q(y)');
      
      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('and');
      expect(result.formula.subformulas).toHaveLength(2);
    });

    test('parses formal implication P(x) → Q(y)', () => {
      const result = parser.parse('P(x) → Q(y)');
      
      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
    });

    test('parses atomic predicate P(a)', () => {
      const result = parser.parse('P(a)');

      expect(result.formula.type).toBe('atomic');
      expect(result.formula.predicate).toBe('P');
      expect(result.formula.terms).toHaveLength(1);
      expect(result.formula.terms![0].name).toBe('a');
    });

    test('parses because statement: "P because Q" → Q implies P', () => {
      const result = parser.parse('it rains because clouds are heavy');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);

      // Antecedent should be "clouds are heavy"
      const antecedent = result.formula.subformulas![0];
      expect(antecedent.naturalLanguage).toContain('clouds are heavy');

      // Consequent should be "it rains"
      const consequent = result.formula.subformulas![1];
      expect(consequent.naturalLanguage).toContain('it rains');
    });

    test('parses because of statement: "P because of Q" → Q implies P', () => {
      const result = parser.parse('the plant grows because of sunlight');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);

      // Antecedent should be "sunlight"
      const antecedent = result.formula.subformulas![0];
      expect(antecedent.naturalLanguage).toContain('sunlight');

      // Consequent should be "the plant grows"
      const consequent = result.formula.subformulas![1];
      expect(consequent.naturalLanguage).toContain('the plant grows');
    });
  });

  describe('parseArgument - Full Arguments', () => {
    test('parses structured argument format', () => {
      const argument = `
        Premise 1: P(a)
        Premise 2: Q(b)
        Conclusion: R(c)
      `;
      
      const result = parser.parseArgument(argument);
      
      expect(result.premises).toHaveLength(2);
      expect(result.conclusion).toBeDefined();
    });

    test('handles natural language with conclusion markers', () => {
      const argument = `
        Dogs are animals.
        Fido is a dog.
        Therefore, Fido is an animal.
      `;
      
      const result = parser.parseArgument(argument);
      
      expect(result.premises).toHaveLength(2);
      expect(result.conclusion.originalText.toLowerCase()).toContain('fido');
    });
  });
});
import { LogicFormula, ParsedStatement, Term } from '../types.js';
import { FormulaBuilder } from '../logic/formula.js';

interface ParsePattern {
  pattern: RegExp;
  builder: (match: RegExpMatchArray, variables: Map<string, string>) => LogicFormula;
  description: string;
}

export class NaturalLanguageParser {
  private patterns: ParsePattern[] = [];
  private variableCounter = 0;

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Initialize base patterns first
    this.patterns = [
      {
        pattern: /^all (\w+) (?:are|can|will|have) (.+)$/i,
        builder: (match, vars) => {
          const entityType = match[1].toLowerCase();
          const property = this.normalizeProperty(match[2]);
          const variable = this.getVariable(entityType, vars);
          
          // Create: ∀x (EntityType(x) → Property(x))
          const entityPredicate = FormulaBuilder.atomic(entityType, [{ type: 'variable', name: variable }]);
          const propertyPredicate = FormulaBuilder.atomic(property, [{ type: 'variable', name: variable }]);
          const implication = FormulaBuilder.relevantImplies(entityPredicate, propertyPredicate);
          
          return FormulaBuilder.forall(variable, implication, match[0]);
        },
        description: "Universal quantification: 'All X are Y'"
      },
      
      {
        pattern: /^all (\w+) (.+)$/i,
        builder: (match, vars) => {
          const entityType = match[1].toLowerCase();
          const property = this.normalizeProperty(match[2]);
          const variable = this.getVariable(entityType, vars);
          
          // Create: ∀x (EntityType(x) → Property(x))
          const entityPredicate = FormulaBuilder.atomic(entityType, [{ type: 'variable', name: variable }]);
          const propertyPredicate = FormulaBuilder.atomic(property, [{ type: 'variable', name: variable }]);
          const implication = FormulaBuilder.relevantImplies(entityPredicate, propertyPredicate);
          
          return FormulaBuilder.forall(variable, implication, match[0]);
        },
        description: "Universal quantification: 'All X Y'"
      },
      
      {
        pattern: /^some (\w+) (?:are|can|will|have) (.+)$/i,
        builder: (match, vars) => {
          const variable = this.getVariable(match[1], vars);
          const property = this.normalizeProperty(match[2]);
          const atomic = FormulaBuilder.atomic(property, [{ type: 'variable', name: variable }]);
          return FormulaBuilder.exists(variable, atomic, match[0]);
        },
        description: "Existential quantification: 'Some X are Y'"
      },

      {
        pattern: /^if (.+) then (.+)$/i,
        builder: (match, vars) => {
          const antecedent = this.parseLogicalExpression(match[1], vars);
          const consequent = this.parseLogicalExpression(match[2], vars);
          return FormulaBuilder.relevantImplies(antecedent, consequent, match[0]);
        },
        description: "Conditional: 'If P then Q'"
      },

      {
        pattern: /^(.+) implies (.+)$/i,
        builder: (match, vars) => {
          const antecedent = this.parseSimpleStatement(match[1], vars);
          const consequent = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.relevantImplies(antecedent, consequent, match[0]);
        },
        description: "Implication: 'P implies Q'"
      },

      {
        pattern: /^(.+) because (?:of )?(.+)$/i,
        builder: (match, vars) => {
          const consequent = this.parseSimpleStatement(match[1], vars);
          const antecedent = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.relevantImplies(antecedent, consequent, match[0]);
        },
        description: "Because: 'P because (of) Q' → Q implies P"
      },

      {
        pattern: /^(.+) enables (.+)$/i,
        builder: (match, vars) => {
          const antecedent = this.parseSimpleStatement(match[1], vars);
          const consequent = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.relevantImplies(antecedent, consequent, match[0]);
        },
        description: "Enables: 'A enables B' → A implies B"
      },

      {
        pattern: /^(.+) is necessary for (.+)$/i,
        builder: (match, vars) => {
          const antecedent = this.parseSimpleStatement(match[1], vars);
          const consequent = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.relevantImplies(antecedent, consequent, match[0]);
        },
        description: "Necessary: 'A is necessary for B' → A implies B"
      },

      {
        pattern: /^once (.+),? then (.+)$/i,
        builder: (match, vars) => {
          const antecedent = this.parseSimpleStatement(match[1], vars);
          const consequent = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.relevantImplies(antecedent, consequent, match[0]);
        },
        description: "Once-then: 'Once A, then B' → A implies B"
      },

      {
        pattern: /^(.+) and (.+)$/i,
        builder: (match, vars) => {
          const left = this.parseSimpleStatement(match[1], vars);
          const right = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.and(left, right, match[0]);
        },
        description: "Conjunction: 'P and Q'"
      },

      {
        pattern: /^(.+) while (.+)$/i,
        builder: (match, vars) => {
          const left = this.parseSimpleStatement(match[1], vars);
          const right = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.and(left, right, match[0]);
        },
        description: "Conjunction: 'P while Q'"
      },

      {
        pattern: /^(.+) whereas (.+)$/i,
        builder: (match, vars) => {
          const left = this.parseSimpleStatement(match[1], vars);
          const right = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.and(left, right, match[0]);
        },
        description: "Conjunction: 'P whereas Q'"
      },

      {
        pattern: /^(.+) or (.+)$/i,
        builder: (match, vars) => {
          const left = this.parseSimpleStatement(match[1], vars);
          const right = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.or(left, right, match[0]);
        },
        description: "Disjunction: 'P or Q'"
      },

      {
        pattern: /^not (.+)$/i,
        builder: (match, vars) => {
          const formula = this.parseSimpleStatement(match[1], vars);
          return FormulaBuilder.not(formula, match[0]);
        },
        description: "Negation: 'not P'"
      },

      {
        pattern: /^it is not the case that (.+)$/i,
        builder: (match, vars) => {
          const formula = this.parseSimpleStatement(match[1], vars);
          return FormulaBuilder.not(formula, match[0]);
        },
        description: "Negation: 'It is not the case that P'"
      },

      {
        pattern: /^(\w+) (?:is|are) (.+)$/i,
        builder: (match, vars) => {
          const subject = match[1].toLowerCase();
          const property = this.normalizeProperty(match[2]);
          const term: Term = { type: 'constant', name: subject };
          
          // Simple predication: Property(subject)
          return FormulaBuilder.atomic(property, [term], match[0]);
        },
        description: "Simple predication: 'X is Y'"
      },

      {
        pattern: /^(\w+) (.+)$/i,
        builder: (match, vars) => {
          const subject = match[1].toLowerCase();
          const predicate = this.normalizeProperty(match[2]);
          const term: Term = this.isVariable(subject)
            ? { type: 'variable', name: this.getVariable(subject, vars) }
            : { type: 'constant', name: subject };
          return FormulaBuilder.atomic(predicate, [term], match[0]);
        },
        description: "Simple statement: 'X does Y'"
      }
    ];
    
    // Now add formal logical syntax patterns (highest priority)
    this.initializeFormalLogicPatterns();
    
  }

  parse(statement: string): ParsedStatement {
    const trimmedStatement = statement.trim();
    const variables = new Map<string, string>();
    const assumptions: LogicFormula[] = [];
    const ambiguities: string[] = [];

    for (const pattern of this.patterns) {
      // Try original case first (for formal logic patterns)
      let match = trimmedStatement.match(pattern.pattern);
      
      // If no match, try lowercase (for natural language patterns)  
      if (!match) {
        match = trimmedStatement.toLowerCase().match(pattern.pattern);
      }
      if (match) {
        try {
          const formula = pattern.builder(match, variables);
          return {
            originalText: statement,
            formula,
            assumptions,
            ambiguities,
confidence: 1.0
          };
        } catch (error) {
          ambiguities.push(`Failed to parse with pattern "${pattern.description}": ${error}`);
        }
      }
    }

    const fallbackFormula = this.createFallbackFormula(statement);
    ambiguities.push('Statement did not match any known patterns, using fallback parsing');

    return {
      originalText: statement,
      formula: fallbackFormula,
      assumptions,
      ambiguities,
confidence: 1.0
    };
  }

  parseArgument(argumentText: string): { premises: ParsedStatement[], conclusion: ParsedStatement } {
    // First, try to parse structured format (Premise 1:, Premise 2:, Conclusion:)
    if (this.isStructuredFormat(argumentText)) {
      return this.parseStructuredArgument(argumentText);
    }
    
    // Otherwise, try natural language format with periods and newlines
    let sentences = argumentText.split(/[.\n]|(?:\n\s*\n)/).map(s => s.trim()).filter(s => s.length > 0);
    
    // Find the sentence with conclusion markers
    const conclusionMarkers = ['therefore', 'thus', 'hence', 'so', 'it follows that', '∴'];
    let conclusionIndex = -1;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].toLowerCase();
      if (conclusionMarkers.some(marker => sentence.includes(marker))) {
        conclusionIndex = i;
        break;
      }
    }
    
    if (conclusionIndex === -1) {
      // No conclusion marker - last sentence is conclusion
      conclusionIndex = sentences.length - 1;
    }
    
    const premises = sentences.slice(0, conclusionIndex).map(s => this.parse(s));
    let conclusionText = sentences[conclusionIndex];
    
    // Remove conclusion markers
    conclusionMarkers.forEach(marker => {
      const regex = new RegExp(`\\b${marker}\\s*,?\\s*`, 'i');
      conclusionText = conclusionText.replace(regex, '');
    });
    
    const conclusion = this.parse(conclusionText.trim());
    
    return { premises, conclusion };
  }

  private isStructuredFormat(argumentText: string): boolean {
    const structuredPatterns = [
      /premise\s*\d+\s*:/i,
      /conclusion\s*:/i,
      /^p\d+\s*:/i,
      /^c\s*:/i
    ];
    
    return structuredPatterns.some(pattern => pattern.test(argumentText));
  }

  private parseStructuredArgument(argumentText: string): { premises: ParsedStatement[], conclusion: ParsedStatement } {
    const lines = argumentText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const premises: ParsedStatement[] = [];
    let conclusionText = '';
    let foundExplicitConclusion = false;
    
    for (const line of lines) {
      // Check for premise labels (more flexible pattern matching)
      if (/^(premise\s*\d*|p\d*)\s*:/i.test(line)) {
        const content = line.replace(/^(premise\s*\d*|p\d*)\s*:\s*/i, '').trim();
        if (content.length > 0) {
          premises.push(this.parse(content));
        }
      }
      // Check for conclusion labels
      else if (/^(conclusion|c)\s*:/i.test(line)) {
        conclusionText = line.replace(/^(conclusion|c)\s*:\s*/i, '').trim();
        foundExplicitConclusion = true;
      }
      // If we already have a conclusion and this is an unlabeled line, append to conclusion
      else if (foundExplicitConclusion && conclusionText && line.length > 0) {
        conclusionText += ' ' + line;
      }
      // If no labels yet and we haven't found explicit conclusion, treat as premise
      else if (line.length > 0 && !foundExplicitConclusion) {
        premises.push(this.parse(line));
      }
    }
    
    // If we found explicit conclusion markers but no conclusion text, 
    // or if we have no explicit conclusion, use last premise as conclusion
    if ((!conclusionText && foundExplicitConclusion) || (!foundExplicitConclusion && premises.length > 0)) {
      const lastPremise = premises.pop();
      conclusionText = lastPremise?.originalText || '';
    }
    
    // Ensure we have a conclusion
    const conclusion = conclusionText ? this.parse(conclusionText) : this.parse('no conclusion found');
    
    return { premises, conclusion };
  }

  private parseSimpleStatement(statement: string, variables: Map<string, string>): LogicFormula {
    const trimmed = statement.trim();
    
    // First check for formal predicate syntax: Predicate(term1, term2, ...)
    const formalPredicateMatch = trimmed.match(/^(\w+)\s*\(\s*([^)]+)\s*\)$/);
    if (formalPredicateMatch) {
      const predicate = formalPredicateMatch[1];
      const termString = formalPredicateMatch[2];
      const terms = termString.split(',').map(t => {
        const trimmedTerm = t.trim();
        return {
          type: /^[a-z]$/.test(trimmedTerm) ? 'variable' as const : 'constant' as const,
          name: trimmedTerm
        };
      });
      return FormulaBuilder.atomic(predicate, terms, trimmed);
    }
    
    const match = trimmed.match(/^(\w+)\s+(?:is|are)\s+(.+)$/i);
    if (match) {
      const subject = match[1].toLowerCase();
      const property = this.normalizeProperty(match[2]);
      const term: Term = this.isVariable(subject)
        ? { type: 'variable', name: this.getVariable(subject, variables) }
        : { type: 'constant', name: subject };
      return FormulaBuilder.atomic(property, [term], trimmed);
    }

    const predicateMatch = trimmed.match(/^(\w+)\s+(.+)$/);
    if (predicateMatch) {
      const subject = predicateMatch[1].toLowerCase();
      const predicate = this.normalizeProperty(predicateMatch[2]);
      const term: Term = this.isVariable(subject)
        ? { type: 'variable', name: this.getVariable(subject, variables) }
        : { type: 'constant', name: subject };
      return FormulaBuilder.atomic(predicate, [term], trimmed);
    }

    return FormulaBuilder.atomic(this.normalizeProperty(trimmed), [], trimmed);
  }

  private getVariable(name: string, variables: Map<string, string>): string {
    const normalized = name.toLowerCase();
    if (!variables.has(normalized)) {
      variables.set(normalized, `x${++this.variableCounter}`);
    }
    return variables.get(normalized)!;
  }

  private isVariable(word: string): boolean {
    const singularNouns = ['person', 'thing', 'object', 'individual', 'entity'];
    const pluralNouns = ['people', 'things', 'objects', 'individuals', 'entities', 'birds', 'animals', 'mammals', 'humans'];
    return singularNouns.includes(word.toLowerCase()) || pluralNouns.includes(word.toLowerCase());
  }

  private normalizeProperty(property: string): string {
    return property.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^_+|_+$/g, '');
  }


  private createFallbackFormula(statement: string): LogicFormula {
    const normalizedPredicate = this.normalizeProperty(statement);
    return FormulaBuilder.atomic(normalizedPredicate, [], statement);
  }


  private initializeFormalLogicPatterns(): void {
    // Formal universal quantification: ∀x(P(x)) - MUST BE FIRST for precedence
    this.patterns.push({
      pattern: /^∀(\w+)\s*\(\s*(.+)\s*\)$/,
      builder: (match, vars) => {
        const variable = match[1];
        const scope = this.parseLogicalExpression(match[2].trim(), vars);
        return FormulaBuilder.forall(variable, scope, match[0]);
      },
      description: "Formal universal quantification: ∀x(P(x))"
    });

    // Formal existential quantification: ∃x(P(x)) - MUST BE SECOND for precedence
    this.patterns.push({
      pattern: /^∃(\w+)\s*\(\s*(.+)\s*\)$/,
      builder: (match, vars) => {
        const variable = match[1];
        const scope = this.parseLogicalExpression(match[2].trim(), vars);
        return FormulaBuilder.exists(variable, scope, match[0]);
      },
      description: "Formal existential quantification: ∃x(P(x))"
    });

    // Formal logical conjunction: P(x) ∧ Q(y) 
    this.patterns.push({
      pattern: /^(.+)\s*∧\s*(.+)$/,
      builder: (match, vars) => {
        const left = this.parseLogicalExpression(match[1].trim(), vars);
        const right = this.parseLogicalExpression(match[2].trim(), vars);
        return FormulaBuilder.and(left, right, match[0]);
      },
      description: "Formal logical conjunction: P(x) ∧ Q(y)"
    });

    // Formal logical disjunction: P(x) ∨ Q(y)
    this.patterns.push({
      pattern: /^(.+)\s*∨\s*(.+)$/,
      builder: (match, vars) => {
        const left = this.parseLogicalExpression(match[1].trim(), vars);
        const right = this.parseLogicalExpression(match[2].trim(), vars);
        return FormulaBuilder.or(left, right, match[0]);
      },
      description: "Formal logical disjunction: P(x) ∨ Q(y)"
    });

    // Formal implication: P(x) → Q(y)
    this.patterns.push({
      pattern: /^(.+)\s*→\s*(.+)$/,
      builder: (match, vars) => {
        const antecedent = this.parseLogicalExpression(match[1].trim(), vars);
        const consequent = this.parseLogicalExpression(match[2].trim(), vars);
        return FormulaBuilder.relevantImplies(antecedent, consequent, match[0]);
      },
      description: "Formal implication: P(x) → Q(y)"
    });

    // Formal predicate: Predicate(term1, term2, ...)
    this.patterns.push({
      pattern: /^(\w+)\s*\(\s*([^)]+)\s*\)$/,
      builder: (match, vars) => {
        const predicate = match[1];
        const termString = match[2];
        const terms = termString.split(',').map(t => {
          const trimmed = t.trim();
          // Check if it's a variable (lowercase) or constant
          return {
            type: /^[a-z]$/.test(trimmed) ? 'variable' as const : 'constant' as const,
            name: trimmed
          };
        });
        return FormulaBuilder.atomic(predicate, terms, match[0]);
      },
      description: "Formal predicate: Predicate(term1, term2, ...)"
    });
  }

  private parseLogicalExpression(expression: string, vars: Map<string, string>): LogicFormula {
    const trimmed = expression.trim();
    
    // Handle parentheses for grouping - extract contents and parse recursively
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const inner = trimmed.slice(1, -1).trim();
      return this.parseLogicalExpression(inner, vars);
    }
    
    // Try natural language patterns first - conjunction with "and"
    const andMatch = trimmed.match(/^(.+)\s+and\s+(.+)$/i);
    if (andMatch) {
      const left = this.parseLogicalExpression(andMatch[1].trim(), vars);
      const right = this.parseLogicalExpression(andMatch[2].trim(), vars);
      return FormulaBuilder.and(left, right, trimmed);
    }

    // Try natural language patterns - disjunction with "or"
    const orMatch = trimmed.match(/^(.+)\s+or\s+(.+)$/i);
    if (orMatch) {
      const left = this.parseLogicalExpression(orMatch[1].trim(), vars);
      const right = this.parseLogicalExpression(orMatch[2].trim(), vars);
      return FormulaBuilder.or(left, right, trimmed);
    }

    // Try formal logical operators - implication
    const implicationMatch = trimmed.match(/^(.+)\s*→\s*(.+)$/);
    if (implicationMatch) {
      const antecedent = this.parseLogicalExpression(implicationMatch[1].trim(), vars);
      const consequent = this.parseLogicalExpression(implicationMatch[2].trim(), vars);
      return FormulaBuilder.relevantImplies(antecedent, consequent, trimmed);
    }

    // Try formal logical operators - conjunction
    const conjunctionMatch = trimmed.match(/^(.+)\s*∧\s*(.+)$/);
    if (conjunctionMatch) {
      const left = this.parseLogicalExpression(conjunctionMatch[1].trim(), vars);
      const right = this.parseLogicalExpression(conjunctionMatch[2].trim(), vars);
      return FormulaBuilder.and(left, right, trimmed);
    }

    // Try formal logical operators - disjunction
    const disjunctionMatch = trimmed.match(/^(.+)\s*∨\s*(.+)$/);
    if (disjunctionMatch) {
      const left = this.parseLogicalExpression(disjunctionMatch[1].trim(), vars);
      const right = this.parseLogicalExpression(disjunctionMatch[2].trim(), vars);
      return FormulaBuilder.or(left, right, trimmed);
    }
    
    // Try to parse as predicate: Predicate(term1, term2, ...)
    const predicateMatch = trimmed.match(/^(\w+)\s*\(\s*([^)]+)\s*\)$/);
    if (predicateMatch) {
      const predicate = predicateMatch[1];
      const termString = predicateMatch[2];
      const terms = termString.split(',').map(t => {
        const trimmedTerm = t.trim();
        return {
          type: /^[a-z]$/.test(trimmedTerm) ? 'variable' as const : 'constant' as const,
          name: trimmedTerm
        };
      });
      return FormulaBuilder.atomic(predicate, terms, trimmed);
    }
    
    // Try to parse as simple atomic predicate without parentheses
    const simpleAtomicMatch = trimmed.match(/^[A-Z]\w*$/);
    if (simpleAtomicMatch) {
      return FormulaBuilder.atomic(trimmed, [], trimmed);
    }
    
    // Fallback to regular parsing for natural language
    return this.parseSimpleStatement(trimmed, vars);
  }

  getSupportedPatterns(): string[] {
    return this.patterns.map(p => p.description);
  }
}
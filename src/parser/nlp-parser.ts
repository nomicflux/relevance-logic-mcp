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
          const antecedent = this.parseSimpleStatement(match[1], vars);
          const consequent = this.parseSimpleStatement(match[2], vars);
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
        pattern: /^(.+) and (.+)$/i,
        builder: (match, vars) => {
          const left = this.parseSimpleStatement(match[1], vars);
          const right = this.parseSimpleStatement(match[2], vars);
          return FormulaBuilder.and(left, right, match[0]);
        },
        description: "Conjunction: 'P and Q'"
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
          const term: Term = this.isVariable(subject) 
            ? { type: 'variable', name: this.getVariable(subject, vars) }
            : { type: 'constant', name: subject };
          
          // For statements like "whales are mammals", create both predicates with shared variable
          if (!this.isVariable(subject)) {
            // Create: Mammals(whales) - but also track that whales is the subject
            const subjectVar = this.getVariable('entity', vars);
            const equalityPredicate = FormulaBuilder.atomic('equals', [
              { type: 'constant', name: subject },
              { type: 'variable', name: subjectVar }
            ]);
            const propertyPredicate = FormulaBuilder.atomic(property, [{ type: 'variable', name: subjectVar }]);
            return FormulaBuilder.and(equalityPredicate, propertyPredicate, match[0]);
          }
          
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
  }

  parse(statement: string): ParsedStatement {
    const normalizedStatement = statement.trim().toLowerCase();
    const variables = new Map<string, string>();
    const assumptions: LogicFormula[] = [];
    const ambiguities: string[] = [];

    for (const pattern of this.patterns) {
      const match = normalizedStatement.match(pattern.pattern);
      if (match) {
        try {
          const formula = pattern.builder(match, variables);
          return {
            originalText: statement,
            formula,
            assumptions,
            ambiguities,
            confidence: this.calculateConfidence(statement, pattern)
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
      confidence: 0.3
    };
  }

  parseArgument(argumentText: string): { premises: ParsedStatement[], conclusion: ParsedStatement } {
    const lines = argumentText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let conclusionIndex = -1;
    const conclusionMarkers = ['therefore', 'thus', 'hence', 'so', 'it follows that', '∴'];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (conclusionMarkers.some(marker => line.includes(marker))) {
        conclusionIndex = i;
        break;
      }
    }

    if (conclusionIndex === -1) {
      conclusionIndex = lines.length - 1;
    }

    const premises = lines.slice(0, conclusionIndex).map(line => this.parse(line));
    let conclusionText = lines[conclusionIndex];
    
    conclusionMarkers.forEach(marker => {
      const regex = new RegExp(`${marker}\\s*,?\\s*`, 'i');
      conclusionText = conclusionText.replace(regex, '');
    });

    const conclusion = this.parse(conclusionText);

    return { premises, conclusion };
  }

  private parseSimpleStatement(statement: string, variables: Map<string, string>): LogicFormula {
    const trimmed = statement.trim();
    
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

  private calculateConfidence(statement: string, pattern: ParsePattern): number {
    let confidence = 0.7;
    
    const complexityPenalty = Math.max(0, (statement.length - 50) * 0.001);
    confidence -= complexityPenalty;
    
    const wordCount = statement.split(/\s+/).length;
    if (wordCount > 20) {
      confidence -= 0.1;
    }
    
    const ambiguousWords = ['might', 'could', 'possibly', 'perhaps', 'maybe'];
    if (ambiguousWords.some(word => statement.toLowerCase().includes(word))) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private createFallbackFormula(statement: string): LogicFormula {
    const normalizedPredicate = this.normalizeProperty(statement);
    return FormulaBuilder.atomic(normalizedPredicate, [], statement);
  }

  getSupportedPatterns(): string[] {
    return this.patterns.map(p => p.description);
  }
}
/**
 * Atomic Reason Module
 * Handles atom extraction and symbolic validation logic
 */

import { FormulaUtils, FormulaBuilder } from "./formula.js";
import { LogicFormula } from "../types.js";

export class AtomicReasonModule {
  extractAtomsFromText(text: string, parser: any): string[] {
    // Split on periods and newlines
    const statements = text.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    const atomSet = new Set<string>();

    statements.forEach(statement => {
      // Use the logic parser to parse each statement
      const parsed = parser.parse(statement);

      // Collect all atoms from the parsed formula
      this.extractSymbolsFromFormula(parsed.formula, atomSet);
    });

    return Array.from(atomSet);
  }

  parsePremiseString(premise: string, symbolFormulas: Map<string, LogicFormula>): LogicFormula | null {
    const trimmed = premise.trim();

    // Check for standalone atom
    if (symbolFormulas.has(trimmed)) {
      return symbolFormulas.get(trimmed)!;
    }

    // Check for conjunction (&&)
    if (trimmed.includes('&&')) {
      const parts = trimmed.split('&&').map(p => p.trim());
      if (parts.length === 2 && symbolFormulas.has(parts[0]) && symbolFormulas.has(parts[1])) {
        return FormulaBuilder.compound('and', [
          symbolFormulas.get(parts[0])!,
          symbolFormulas.get(parts[1])!
        ], trimmed);
      }
    }

    // Check for disjunction (||)
    if (trimmed.includes('||')) {
      const parts = trimmed.split('||').map(p => p.trim());
      if (parts.length === 2 && symbolFormulas.has(parts[0]) && symbolFormulas.has(parts[1])) {
        return FormulaBuilder.compound('or', [
          symbolFormulas.get(parts[0])!,
          symbolFormulas.get(parts[1])!
        ], trimmed);
      }
    }

    // Check for implication (->)
    if (trimmed.includes('->')) {
      const parts = trimmed.split('->').map(p => p.trim());
      if (parts.length === 2 && symbolFormulas.has(parts[0]) && symbolFormulas.has(parts[1])) {
        return FormulaBuilder.compound('implies', [
          symbolFormulas.get(parts[0])!,
          symbolFormulas.get(parts[1])!
        ], trimmed);
      }
    }

    // Try semi-natural language parsing (fallback to existing parseSymbolicRelationship)
    return this.parseSymbolicRelationship(trimmed, symbolFormulas);
  }

  parseSymbolicRelationship(relationship: string, symbolFormulas: Map<string, LogicFormula>): LogicFormula | null {
    const trimmed = relationship.trim();

    // Handle implication patterns: A → B, A implies B, A enables B
    const impliesPatterns = [
      /^(\w+)\s*→\s*(\w+)$/,
      /^(\w+)\s+implies\s+(\w+)$/i,
      /^(\w+)\s+enables\s+(\w+)$/i,
      /^(\w+)\s+is\s+necessary\s+for\s+(\w+)$/i
    ];

    for (const pattern of impliesPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const antecedentSymbol = match[1];
        const consequentSymbol = match[2];

        const antecedent = symbolFormulas.get(antecedentSymbol);
        const consequent = symbolFormulas.get(consequentSymbol);

        if (antecedent && consequent) {
          return FormulaBuilder.compound('implies', [antecedent, consequent], trimmed);
        }
      }
    }

    return null;
  }

  extractSymbolsFromFormula(formula: LogicFormula, symbolSet: Set<string>): void {
    if (formula.type === 'atomic') {
      if (formula.predicate) {
        symbolSet.add(formula.predicate);
      }
    } else if (formula.type === 'compound' && formula.subformulas) {
      formula.subformulas.forEach(sub => this.extractSymbolsFromFormula(sub, symbolSet));
    }
  }

  private extractSymbolsFromString(premise: string): string[] {
    // Extract symbols from premise string by looking for common patterns
    const symbols: string[] = [];

    // Match standalone symbols (alphanumeric + underscore)
    const standaloneMatches = premise.match(/\b[A-Z][A-Z0-9_]*\b/g);
    if (standaloneMatches) {
      symbols.push(...standaloneMatches);
    }

    return [...new Set(symbols)]; // Remove duplicates
  }

  formulaToSymbolicString(formula: LogicFormula): string {
    if (formula.type === 'atomic') {
      return formula.predicate || 'unknown';
    } else if (formula.type === 'compound' && formula.subformulas) {
      const left = this.formulaToSymbolicString(formula.subformulas[0]);
      const right = this.formulaToSymbolicString(formula.subformulas[1]);
      switch (formula.operator) {
        case 'implies': return `${left} → ${right}`;
        case 'and': return `${left} ∧ ${right}`;
        case 'or': return `${left} ∨ ${right}`;
        default: return `${left} ${formula.operator} ${right}`;
      }
    }
    return formula.naturalLanguage || 'unknown';
  }

  private generateNaturalLanguageArgument(
    premiseFormulas: LogicFormula[],
    conclusionFormula: LogicFormula,
    atom_groupings: Array<{symbol: string, concept_description: string, text_variants: string[]}>
  ): { premises: string[], conclusion: string, full_argument: string } {
    // Create symbol to description mapping
    const symbolToDescription = new Map<string, string>();
    atom_groupings.forEach(group => {
      symbolToDescription.set(group.symbol, group.concept_description);
    });

    // Convert premise formulas to natural language
    const naturalLanguagePremises = premiseFormulas.map(formula =>
      this.formulaToNaturalLanguage(formula, symbolToDescription)
    );

    // Convert conclusion formula to natural language
    const naturalLanguageConclusion = this.formulaToNaturalLanguage(conclusionFormula, symbolToDescription);

    // Create full argument text
    const fullArgument = naturalLanguagePremises.join('. ') + '. Therefore, ' + naturalLanguageConclusion + '.';

    return {
      premises: naturalLanguagePremises,
      conclusion: naturalLanguageConclusion,
      full_argument: fullArgument
    };
  }

  private formulaToNaturalLanguage(formula: LogicFormula, symbolToDescription: Map<string, string>): string {
    if (formula.type === 'atomic') {
      return symbolToDescription.get(formula.predicate || '') || formula.predicate || 'unknown';
    } else if (formula.type === 'compound' && formula.subformulas) {
      const left = this.formulaToNaturalLanguage(formula.subformulas[0], symbolToDescription);
      const right = this.formulaToNaturalLanguage(formula.subformulas[1], symbolToDescription);

      switch (formula.operator) {
        case 'implies': return `${left} implies ${right}`;
        case 'and': return `${left} and ${right}`;
        case 'or': return `${left} or ${right}`;
        default: return `${left} ${formula.operator} ${right}`;
      }
    }
    return formula.naturalLanguage || 'unknown';
  }

  validateSymbolicArgument(
    atom_groupings: Array<{symbol: string, concept_description: string, text_variants: string[]}>,
    premises: string[],
    conclusion: string
  ): any {
    try {
      // Create symbol-to-formula mapping
      const symbolFormulas = new Map<string, LogicFormula>();

      // Create atomic formulas for each symbol
      atom_groupings.forEach(group => {
        symbolFormulas.set(group.symbol, FormulaBuilder.atomic(group.symbol, [], group.concept_description));
      });

      // Get conclusion formula
      const conclusionFormula = symbolFormulas.get(conclusion);
      if (!conclusionFormula) {
        return {
          validation_result: "ERROR",
          message: `Conclusion '${conclusion}' not found in atom_groupings`
        };
      }

      // Parse premises into formulas
      const premiseFormulas: LogicFormula[] = [];
      const ignoredPremises: string[] = [];
      const availableSymbols = atom_groupings.map(g => g.symbol);

      premises.forEach(premise => {
        const formula = this.parsePremiseString(premise, symbolFormulas);
        if (formula) {
          premiseFormulas.push(formula);
        } else {
          // Check if premise contains undefined symbols
          const referencedSymbols = this.extractSymbolsFromString(premise);
          const undefinedSymbols = referencedSymbols.filter(sym => !availableSymbols.includes(sym));

          if (undefinedSymbols.length > 0) {
            ignoredPremises.push(`Ignored premise '${premise}' because '${undefinedSymbols.join(', ')}' is not a defined atom. Use only symbols from your atom_groupings: ${availableSymbols.join(', ')}.`);
          } else {
            ignoredPremises.push(`Failed to parse premise: '${premise}' - check syntax.`);
          }
        }
      });

      // Check 1: Empty premises error
      if (premiseFormulas.length === 0) {
        const symbolExamples = availableSymbols.slice(0, 2);
        const baseMessage = `No valid premises provided. You must create premises using your atom symbols.\n\nAvailable symbols: ${availableSymbols.join(', ')}\n\nPremise formats and their logical parsing:\n- Standalone: "${symbolExamples[0]}" → atomic(${symbolExamples[0]})\n- Conjunction: "${symbolExamples[0]} && ${symbolExamples[1] || 'SYMBOL'}" → and(${symbolExamples[0]}, ${symbolExamples[1] || 'SYMBOL'})\n- Disjunction: "${symbolExamples[0]} || ${symbolExamples[1] || 'SYMBOL'}" → or(${symbolExamples[0]}, ${symbolExamples[1] || 'SYMBOL'})\n- Implication: "${symbolExamples[0]} -> ${symbolExamples[1] || 'SYMBOL'}" → implies(${symbolExamples[0]}, ${symbolExamples[1] || 'SYMBOL'})\n- UNKNOWN: "${symbolExamples[0]} enables ${conclusion}" → implies(${symbolExamples[0]}, ${conclusion})\n\nExample: ["${symbolExamples[0]}", "${symbolExamples[0]} -> ${conclusion}"]`;

        const fullMessage = ignoredPremises.length > 0
          ? `${baseMessage}\n\nIGNORED PREMISES:\n${ignoredPremises.join('\n')}`
          : baseMessage;

        return {
          validation_result: "ERROR",
          message: fullMessage,
          symbolic_argument: {
            premises: [],
            conclusion: `C: ${conclusion}`
          },
          symbol_definitions: Object.fromEntries(
            atom_groupings.map(g => [g.symbol, g.concept_description])
          ),
          validation_details: {
            connected_components: 0,
            violations: ["EMPTY_PREMISES: No valid premises provided"]
          },
          available_symbols: availableSymbols,
          required_action: "Add premises array using your exact symbols in supported formats",
          ignored_premises: ignoredPremises
        };
      }

      // Note: Circular reasoning detection is handled by FormulaUtils.validate()

      // Validate using existing logic
      const validation = FormulaUtils.validate(premiseFormulas, conclusionFormula);

      const result: any = {
        validation_result: validation.isValid ? "VALID" : "INVALID",
        symbolic_argument: {
          premises: premiseFormulas.map((f, i) => `P${i + 1}: ${this.formulaToSymbolicString(f)}`),
          conclusion: `C: ${conclusion}`
        },
        symbol_definitions: Object.fromEntries(
          atom_groupings.map(g => [g.symbol, g.concept_description])
        ),
        validation_details: {
          connected_components: validation.isValid ? 1 : "multiple",
          violations: validation.violatedConstraints || []
        },
        atom_groupings: atom_groupings
      };

      // Add ignored premises info if any were ignored
      if (ignoredPremises.length > 0) {
        result.ignored_premises = ignoredPremises;
        result.message = `${ignoredPremises.length} premise(s) were ignored:\n${ignoredPremises.join('\n')}\n\nOnly symbols from atom_groupings can be used. If you need new symbols, use earlier steps to produce them.`;
      }

      // If validation is successful, generate natural language output
      if (validation.isValid) {
        result.natural_language_argument = this.generateNaturalLanguageArgument(
          premiseFormulas,
          conclusionFormula,
          atom_groupings
        );
      }

      return result;
    } catch (error) {
      return {
        validation_result: "ERROR",
        message: `Error processing symbolic argument: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
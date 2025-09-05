import { LogicFormula, Proof, ProofStep, ValidationResult, LogicSystem, Argument } from '../types.js';
import { FormulaUtils } from './formula.js';

interface InferenceRule {
  name: string;
  description: string;
  apply: (premises: LogicFormula[], targetConclusion?: LogicFormula) => LogicFormula[];
  relevanceCheck: boolean;
}

export class RelevanceLogicProofEngine {
  private rules: Map<string, InferenceRule> = new Map();

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    this.rules.set('modus_ponens', {
      name: 'Modus Ponens',
      description: 'From A and A → B, infer B',
      relevanceCheck: true,
      apply: (premises: LogicFormula[]) => {
        const results: LogicFormula[] = [];
        
        for (let i = 0; i < premises.length; i++) {
          const premise1 = premises[i];
          
          for (let j = 0; j < premises.length; j++) {
            if (i === j) continue;
            const premise2 = premises[j];
            
            if (premise2.type === 'compound' && 
                (premise2.operator === 'implies' || premise2.operator === 'relevant_implies') &&
                premise2.subformulas && premise2.subformulas.length === 2) {
              
              const antecedent = premise2.subformulas[0];
              const consequent = premise2.subformulas[1];
              
              if (this.formulasMatch(premise1, antecedent)) {
                if (premise2.operator === 'relevant_implies') {
                  if (FormulaUtils.hasSharedVariables(premise1, consequent)) {
                    results.push(consequent);
                  }
                } else {
                  results.push(consequent);
                }
              }
            }
          }
        }
        
        return results;
      }
    });

    this.rules.set('conjunction_introduction', {
      name: 'Conjunction Introduction',
      description: 'From A and B, infer A ∧ B',
      relevanceCheck: true,
      apply: (premises: LogicFormula[]) => {
        const results: LogicFormula[] = [];
        
        for (let i = 0; i < premises.length; i++) {
          for (let j = i + 1; j < premises.length; j++) {
            const premise1 = premises[i];
            const premise2 = premises[j];
            
            if (FormulaUtils.hasSharedVariables(premise1, premise2)) {
              const conjunction: LogicFormula = {
                id: `conj_${premise1.id}_${premise2.id}`,
                type: 'compound',
                operator: 'and',
                subformulas: [premise1, premise2],
                variables: new Set([...premise1.variables, ...premise2.variables]),
                predicates: new Set([...premise1.predicates, ...premise2.predicates]),
                naturalLanguage: `${premise1.naturalLanguage} and ${premise2.naturalLanguage}`
              };
              results.push(conjunction);
            }
          }
        }
        
        return results;
      }
    });

    this.rules.set('conjunction_elimination', {
      name: 'Conjunction Elimination',
      description: 'From A ∧ B, infer A (or B)',
      relevanceCheck: false,
      apply: (premises: LogicFormula[]) => {
        const results: LogicFormula[] = [];
        
        premises.forEach(premise => {
          if (premise.type === 'compound' && 
              premise.operator === 'and' && 
              premise.subformulas && 
              premise.subformulas.length === 2) {
            results.push(premise.subformulas[0]);
            results.push(premise.subformulas[1]);
          }
        });
        
        return results;
      }
    });

    this.rules.set('universal_instantiation', {
      name: 'Universal Instantiation',
      description: 'From ∀x P(x), infer P(a) for any constant a',
      relevanceCheck: false,
      apply: (premises: LogicFormula[]) => {
        const results: LogicFormula[] = [];
        
        premises.forEach(premise => {
          if (premise.type === 'compound' && 
              premise.operator === 'forall' && 
              premise.subformulas && 
              premise.subformulas.length === 1) {
            
            const universalFormula = premise.subformulas[0];
            const constants = this.extractConstants(premises);
            
            constants.forEach(constant => {
              const instantiated = this.substituteVariable(universalFormula, constant);
              if (instantiated) {
                results.push(instantiated);
              }
            });
          }
        });
        
        return results;
      }
    });

    this.rules.set('hypothetical_syllogism', {
      name: 'Hypothetical Syllogism',
      description: 'From A → B and B → C, infer A → C',
      relevanceCheck: true,
      apply: (premises: LogicFormula[]) => {
        const results: LogicFormula[] = [];
        
        for (let i = 0; i < premises.length; i++) {
          const premise1 = premises[i];
          
          if (premise1.type === 'compound' && 
              (premise1.operator === 'implies' || premise1.operator === 'relevant_implies') &&
              premise1.subformulas && premise1.subformulas.length === 2) {
            
            const A = premise1.subformulas[0];
            const B = premise1.subformulas[1];
            
            for (let j = 0; j < premises.length; j++) {
              if (i === j) continue;
              const premise2 = premises[j];
              
              if (premise2.type === 'compound' && 
                  (premise2.operator === 'implies' || premise2.operator === 'relevant_implies') &&
                  premise2.subformulas && premise2.subformulas.length === 2) {
                
                const B2 = premise2.subformulas[0];
                const C = premise2.subformulas[1];
                
                if (this.formulasMatch(B, B2)) {
                  const operator = (premise1.operator === 'relevant_implies' || premise2.operator === 'relevant_implies') 
                    ? 'relevant_implies' : 'implies';
                  
                  if (operator === 'relevant_implies') {
                    if (FormulaUtils.hasSharedVariables(A, C)) {
                      const conclusion: LogicFormula = {
                        id: `hs_${premise1.id}_${premise2.id}`,
                        type: 'compound',
                        operator,
                        subformulas: [A, C],
                        variables: new Set([...A.variables, ...C.variables]),
                        predicates: new Set([...A.predicates, ...C.predicates]),
                        naturalLanguage: `If ${A.naturalLanguage} then ${C.naturalLanguage}`
                      };
                      results.push(conclusion);
                    }
                  } else {
                    const conclusion: LogicFormula = {
                      id: `hs_${premise1.id}_${premise2.id}`,
                      type: 'compound',
                      operator,
                      subformulas: [A, C],
                      variables: new Set([...A.variables, ...C.variables]),
                      predicates: new Set([...A.predicates, ...C.predicates]),
                      naturalLanguage: `If ${A.naturalLanguage} then ${C.naturalLanguage}`
                    };
                    results.push(conclusion);
                  }
                }
              }
            }
          }
        }
        
        return results;
      }
    });
  }

  validateArgument(argument: Argument, system: LogicSystem = 'relevance_R'): ValidationResult {
    const { premises, conclusion } = argument;
    
    const relevanceScore = this.calculateRelevanceScore(premises, conclusion);
    const hasRelevance = relevanceScore > 0.5;
    
    if (system.startsWith('relevance') && !hasRelevance) {
      return {
        isValid: false,
        hasRelevance: false,
        relevanceScore,
        errors: ['Conclusion does not share sufficient variables with premises'],
        warnings: []
      };
    }

    try {
      const proof = this.findProof(premises, conclusion, system);
      
      if (proof) {
        return {
          isValid: true,
          hasRelevance,
          proof,
          relevanceScore,
          errors: [],
          warnings: proof.steps.length > 10 ? ['Proof is quite long'] : []
        };
      } else {
        return {
          isValid: false,
          hasRelevance,
          relevanceScore,
          errors: ['No valid proof found'],
          warnings: []
        };
      }
    } catch (error) {
      return {
        isValid: false,
        hasRelevance,
        relevanceScore,
        errors: [`Error during proof search: ${error}`],
        warnings: []
      };
    }
  }

  private findProof(premises: LogicFormula[], conclusion: LogicFormula, system: LogicSystem): Proof | null {
    const maxDepth = 20;
    const visited = new Set<string>();
    
    const searchResult = this.backwardSearch(premises, conclusion, system, 0, maxDepth, visited);
    
    if (searchResult) {
      return {
        steps: searchResult,
        isValid: true,
        system,
        premises,
        conclusion
      };
    }
    
    return null;
  }

  private backwardSearch(
    premises: LogicFormula[], 
    target: LogicFormula, 
    system: LogicSystem,
    depth: number, 
    maxDepth: number, 
    visited: Set<string>
  ): ProofStep[] | null {
    
    if (depth > maxDepth) return null;
    
    const targetKey = FormulaUtils.toString(target);
    if (visited.has(targetKey)) return null;
    visited.add(targetKey);
    
    for (const premise of premises) {
      if (this.formulasMatch(premise, target)) {
        return [{
          stepNumber: 1,
          formula: target,
          rule: 'Premise',
          justification: [],
          explanation: 'Given as premise'
        }];
      }
    }
    
    for (const [ruleName, rule] of this.rules.entries()) {
      if (system.startsWith('relevance') && rule.relevanceCheck) {
        const derivedFormulas = rule.apply(premises, target);
        
        for (const derived of derivedFormulas) {
          if (this.formulasMatch(derived, target)) {
            return [{
              stepNumber: 1,
              formula: target,
              rule: rule.name,
              justification: [],
              explanation: `Derived using ${rule.name}`
            }];
          }
        }
      }
    }
    
    return null;
  }

  private calculateRelevanceScore(premises: LogicFormula[], conclusion: LogicFormula): number {
    if (premises.length === 0) return 0;
    
    let totalRelevance = 0;
    let connections = 0;
    
    for (const premise of premises) {
      const sharedVars = FormulaUtils.getSharedVariables(premise, conclusion);
      const sharedPreds = this.getSharedPredicates(premise, conclusion);
      
      const varScore = sharedVars.size / Math.max(premise.variables.size, conclusion.variables.size, 1);
      const predScore = sharedPreds.size / Math.max(premise.predicates.size, conclusion.predicates.size, 1);
      
      const premiseRelevance = (varScore * 0.6) + (predScore * 0.4);
      
      if (premiseRelevance > 0) {
        totalRelevance += premiseRelevance;
        connections++;
      }
    }
    
    return connections > 0 ? totalRelevance / premises.length : 0;
  }

  private getSharedPredicates(formula1: LogicFormula, formula2: LogicFormula): Set<string> {
    const shared = new Set<string>();
    for (const pred of formula1.predicates) {
      if (formula2.predicates.has(pred)) {
        shared.add(pred);
      }
    }
    return shared;
  }

  private formulasMatch(formula1: LogicFormula, formula2: LogicFormula): boolean {
    return FormulaUtils.toString(formula1) === FormulaUtils.toString(formula2);
  }

  private extractConstants(premises: LogicFormula[]): string[] {
    const constants = new Set<string>();
    
    premises.forEach(premise => {
      this.extractConstantsFromFormula(premise, constants);
    });
    
    return Array.from(constants);
  }

  private extractConstantsFromFormula(formula: LogicFormula, constants: Set<string>): void {
    if (formula.terms) {
      formula.terms.forEach(term => {
        if (term.type === 'constant') {
          constants.add(term.name);
        }
      });
    }
    
    if (formula.subformulas) {
      formula.subformulas.forEach(sub => {
        this.extractConstantsFromFormula(sub, constants);
      });
    }
  }

  private substituteVariable(formula: LogicFormula, constant: string): LogicFormula | null {
    return formula;
  }

  getSupportedRules(): string[] {
    return Array.from(this.rules.keys());
  }

  getRuleDescription(ruleName: string): string {
    const rule = this.rules.get(ruleName);
    return rule ? rule.description : 'Rule not found';
  }
}
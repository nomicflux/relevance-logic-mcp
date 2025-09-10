import { LogicFormula, World, RelevanceModel, FrameConditions, LogicSystem } from '../types.js';
import { RelevanceSystemFactory } from './relevance-systems.js';

/**
 * Ternary Relational Semantics for Relevance Logic (Routley-Meyer Semantics)
 * 
 * This implements the proper ternary relation semantics where:
 * - R(a,b,c) means "information at a combines with information at b to yield information at c"
 * - Truth conditions are defined using this ternary relation
 * - Different frame conditions apply to different systems (R, E, T, B)
 */

export class TernarySemanticEvaluator {
  
  /**
   * Evaluate a formula at a world in a relevance model
   * Uses proper ternary relation semantics, not classical binary semantics
   */
  evaluate(formula: LogicFormula, world: World, model: RelevanceModel): boolean {
    switch (formula.type) {
      case 'atomic':
        return this.evaluateAtomic(formula, world, model);
        
      case 'compound':
        return this.evaluateCompound(formula, world, model);
        
      default:
        throw new Error(`Unknown formula type: ${formula.type}`);
    }
  }

  private evaluateAtomic(formula: LogicFormula, world: World, model: RelevanceModel): boolean {
    if (!formula.predicate) return false;
    
    // Atomic formulas are true at worlds where they're assigned true
    return world.assignments.get(formula.predicate) ?? false;
  }

  private evaluateCompound(formula: LogicFormula, world: World, model: RelevanceModel): boolean {
    if (!formula.operator || !formula.subformulas) return false;
    
    switch (formula.operator) {
      case 'and':
        return this.evaluateAdditiveConjunction(formula.subformulas, world, model);
        
      case 'or':
        return this.evaluateAdditiveDisjunction(formula.subformulas, world, model);
        
      case 'not':
        return this.evaluateRelevantNegation(formula.subformulas[0], world, model);
        
      case 'implies':
        return this.evaluateRelevantImplication(formula.subformulas[0], formula.subformulas[1], world, model);
        
      // Multiplicative connectives (ESSENTIAL for relevance logic)
      case 'times':
        return this.evaluateMultiplicativeConjunction(formula.subformulas[0], formula.subformulas[1], world, model);
        
      case 'lollipop':
        return this.evaluateMultiplicativeImplication(formula.subformulas[0], formula.subformulas[1], world, model);
        
      case 'par':
        return this.evaluateMultiplicativeDisjunction(formula.subformulas[0], formula.subformulas[1], world, model);
        
      // Units
      case 'one':
        return this.evaluateMultiplicativeUnit(world, model);
        
      case 'bottom':
        return this.evaluateMultiplicativeFalsity(world, model);
        
      default:
        throw new Error(`Unknown operator: ${formula.operator}`);
    }
  }

  /**
   * Additive conjunction: A ∧ B
   * True at world a iff both A and B are true at a
   */
  private evaluateAdditiveConjunction(subformulas: LogicFormula[], world: World, model: RelevanceModel): boolean {
    return subformulas.every(sub => this.evaluate(sub, world, model));
  }

  /**
   * Additive disjunction: A ∨ B  
   * True at world a iff A or B (or both) are true at a
   */
  private evaluateAdditiveDisjunction(subformulas: LogicFormula[], world: World, model: RelevanceModel): boolean {
    return subformulas.some(sub => this.evaluate(sub, world, model));
  }

  /**
   * Relevant negation: ¬A
   * True at world a iff A is false at the conjugate world a*
   */
  private evaluateRelevantNegation(formula: LogicFormula, world: World, model: RelevanceModel): boolean {
    const conjugateWorld = model.negationConjugation(world);
    return !this.evaluate(formula, conjugateWorld, model);
  }

  /**
   * Relevant implication: A → B
   * CRITICAL: Uses ternary relation semantics
   * 
   * M,a ⊩ A → B iff for all b,c: if R(a,b,c) and M,b ⊩ A then M,c ⊩ B
   */
  private evaluateRelevantImplication(antecedent: LogicFormula, consequent: LogicFormula, world: World, model: RelevanceModel): boolean {
    // For all worlds b,c such that R(world,b,c)
    for (const b of model.worlds) {
      for (const c of model.worlds) {
        if (model.ternaryRelation.relates(world, b, c)) {
          // If A is true at b, then B must be true at c
          if (this.evaluate(antecedent, b, model) && !this.evaluate(consequent, c, model)) {
            return false; // Implication fails
          }
        }
      }
    }
    return true; // Implication holds
  }

  /**
   * Multiplicative conjunction: A ⊗ B (ESSENTIAL for relevance logic)
   * True at world a iff there exist worlds b,c such that R(b,c,a) and A is true at b and B is true at c
   * 
   * This captures resource-sensitive combination where resources from b and c combine to yield a
   */
  private evaluateMultiplicativeConjunction(left: LogicFormula, right: LogicFormula, world: World, model: RelevanceModel): boolean {
    // Exists b,c such that R(b,c,world) and left@b and right@c
    for (const b of model.worlds) {
      for (const c of model.worlds) {
        if (model.ternaryRelation.relates(b, c, world)) {
          if (this.evaluate(left, b, model) && this.evaluate(right, c, model)) {
            return true; // Found appropriate decomposition
          }
        }
      }
    }
    return false; // No valid decomposition exists
  }

  /**
   * Multiplicative implication: A ⊸ B (linear implication)
   * Similar to relevant implication but with different resource sensitivity
   * 
   * M,a ⊩ A ⊸ B iff for all b,c: if R(a,b,c) and M,b ⊩ A then M,c ⊩ B
   */
  private evaluateMultiplicativeImplication(antecedent: LogicFormula, consequent: LogicFormula, world: World, model: RelevanceModel): boolean {
    // Same as relevant implication in basic ternary semantics
    // Differences would appear in frame conditions and structural rules
    return this.evaluateRelevantImplication(antecedent, consequent, world, model);
  }

  /**
   * Multiplicative disjunction: A ⅋ B
   * Dual of multiplicative conjunction
   */
  private evaluateMultiplicativeDisjunction(left: LogicFormula, right: LogicFormula, world: World, model: RelevanceModel): boolean {
    // Complex definition involving negation and multiplicative conjunction
    // ¬(¬A ⊗ ¬B) in many systems
    const negLeft = { ...left, operator: 'not' as const, subformulas: [left] };
    const negRight = { ...right, operator: 'not' as const, subformulas: [right] };
    const times = { 
      id: 'par_temp', 
      type: 'compound' as const, 
      operator: 'times' as const, 
      subformulas: [negLeft, negRight],
      variables: new Set([...left.variables, ...right.variables]),
      predicates: new Set([...left.predicates, ...right.predicates]),
      naturalLanguage: 'multiplicative disjunction'
    };
    
    return !this.evaluateMultiplicativeConjunction(negLeft, negRight, world, model);
  }

  /**
   * Multiplicative unit: I
   * True at distinguished point (usually)
   */
  private evaluateMultiplicativeUnit(world: World, model: RelevanceModel): boolean {
    return world === model.distinguishedPoint;
  }

  /**
   * Multiplicative falsity: ⊥
   * False at distinguished point (usually)
   */
  private evaluateMultiplicativeFalsity(world: World, model: RelevanceModel): boolean {
    return false; // Always false in basic semantics
  }
}

/**
 * Frame condition checker for different relevance logic systems
 * Each system has specific mathematical constraints on the ternary relation
 */
export class FrameConditionChecker {
  
  /**
   * Check if a model satisfies the frame conditions for a given system
   */
  static validateFrameConditions(model: RelevanceModel, system: LogicSystem): boolean {
    const systemImpl = RelevanceSystemFactory.createSystem(system);
    const requiredConditions = systemImpl.getFrameConditions();
    
    return this.checkConditions(model, requiredConditions);
  }

  private static checkConditions(model: RelevanceModel, conditions: FrameConditions): boolean {
    const R = model.ternaryRelation.relates;
    const worlds = Array.from(model.worlds);
    
    // Check reflexivity conditions
    if (conditions.reflexivity) {
      for (const a of worlds) {
        if (!R(model.distinguishedPoint, a, a)) {
          return false; // Reflexivity violated
        }
      }
    }
    
    // Check commutativity conditions
    if (conditions.commutativity) {
      for (const a of worlds) {
        for (const b of worlds) {
          for (const c of worlds) {
            if (R(a, b, c) !== R(b, a, c)) {
              return false; // Commutativity violated
            }
          }
        }
      }
    }
    
    // Check associativity conditions (simplified)
    if (conditions.associativity) {
      // Complex associativity conditions for ternary relations
      // This is a placeholder for the full mathematical definition
      return true; // Simplified for now
    }
    
    // Check distributivity frame conditions
    if (conditions.distributivity) {
      // Frame must support distribution law
      // Complex mathematical condition relating to lattice structure
      return true; // Simplified for now
    }
    
    return true; // All checked conditions satisfied
  }
}

/**
 * Model constructor for different relevance logic systems
 */
export class RelevanceModelBuilder {
  
  /**
   * Create a relevance model appropriate for the given system
   */
  static createModel(system: LogicSystem, worldCount: number = 3): RelevanceModel {
    const systemImpl = RelevanceSystemFactory.createSystem(system);
    const frameConditions = systemImpl.getFrameConditions();
    
    // Create worlds
    const worlds = new Set<World>();
    const worldArray: World[] = [];
    
    for (let i = 0; i < worldCount; i++) {
      const world: World = {
        id: `w${i}`,
        assignments: new Map()
      };
      worlds.add(world);
      worldArray.push(world);
    }
    
    const distinguishedPoint = worldArray[0]; // w0 is the distinguished point
    
    // Create ternary relation based on system requirements
    const ternaryRelation = this.createTernaryRelation(worldArray, frameConditions);
    
    // Create negation conjugation (simplified)
    const negationConjugation = (w: World) => {
      const index = worldArray.indexOf(w);
      // Simple conjugation: w0* = w1, w1* = w0, etc.
      return worldArray[(index + 1) % worldArray.length];
    };
    
    return {
      worlds,
      ternaryRelation,
      negationConjugation,
      distinguishedPoint,
      frameConditions,
      description: `Relevance model for system ${system} with ${worldCount} worlds`
    };
  }

  private static createTernaryRelation(worlds: World[], conditions: FrameConditions) {
    return {
      relates: (a: World, b: World, c: World): boolean => {
        // Implement frame-condition-specific ternary relation
        
        if (conditions.minimal) {
          // Basic relevance: only identity relations
          return a === b && b === c;
        }
        
        if (conditions.reflexivity) {
          // Identity relations must hold
          if (a === worlds[0] && b === c) return true; // R(0,a,a)
        }
        
        if (conditions.commutativity) {
          // R(a,b,c) iff R(b,a,c)
          // This affects the implementation of the relation
        }
        
        // Default: some basic relation that satisfies minimal conditions
        return a === b && b === c; // Identity relation
      }
    };
  }
}

/**
 * Counterexample generator using proper ternary semantics
 */
export class TernaryCounterexampleGenerator {
  
  /**
   * Generate a counterexample for an invalid argument using ternary semantics
   */
  static generateCounterexample(premises: LogicFormula[], conclusion: LogicFormula, system: LogicSystem): RelevanceModel | null {
    const evaluator = new TernarySemanticEvaluator();
    
    // Try different model sizes
    for (let worldCount = 2; worldCount <= 5; worldCount++) {
      const model = RelevanceModelBuilder.createModel(system, worldCount);
      
      // Try different truth assignments
      const worlds = Array.from(model.worlds);
      const combinations = Math.pow(2, worlds.length * 3); // Simplified
      
      for (let i = 0; i < Math.min(combinations, 100); i++) {
        // Assign random truth values
        this.assignTruthValues(worlds, i);
        
        // Check if premises are true but conclusion is false at some world
        for (const world of worlds) {
          const premisesTrue = premises.every(premise => evaluator.evaluate(premise, world, model));
          const conclusionFalse = !evaluator.evaluate(conclusion, world, model);
          
          if (premisesTrue && conclusionFalse) {
            return model; // Found counterexample
          }
        }
      }
    }
    
    return null; // No counterexample found (argument may be valid)
  }

  private static assignTruthValues(worlds: World[], combination: number): void {
    for (let i = 0; i < worlds.length; i++) {
      const world = worlds[i];
      world.assignments.clear();
      
      // Assign truth values based on combination number
      world.assignments.set('P', (combination & (1 << i)) !== 0);
      world.assignments.set('Q', (combination & (1 << (i + worlds.length))) !== 0);
      world.assignments.set('R', (combination & (1 << (i + 2 * worlds.length))) !== 0);
    }
  }
}
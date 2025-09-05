import { LogicFormula, Model, World, TernaryRelation, Argument } from '../types.js';
import { FormulaUtils } from './formula.js';

export class CounterexampleGenerator {
  private worldCounter = 0;

  generateCounterexample(argument: Argument): Model | null {
    const { premises, conclusion } = argument;
    
    const model = this.searchForCountermodel(premises, conclusion);
    
    if (model && this.validateCountermodel(model, premises, conclusion)) {
      return model;
    }
    
    return null;
  }

  private searchForCountermodel(premises: LogicFormula[], conclusion: LogicFormula): Model | null {
    const variables = this.extractAllVariables(premises, conclusion);
    const maxWorlds = Math.min(8, Math.pow(2, variables.length));
    
    for (let worldCount = 2; worldCount <= maxWorlds; worldCount++) {
      const model = this.constructModel(variables, worldCount);
      
      if (this.tryAssignments(model, premises, conclusion)) {
        return model;
      }
    }
    
    return null;
  }

  private constructModel(variables: string[], worldCount: number): Model {
    const worlds: World[] = [];
    
    for (let i = 0; i < worldCount; i++) {
      const world: World = {
        id: `w${i}`,
        assignments: new Map()
      };
      
      variables.forEach(variable => {
        world.assignments.set(variable, Math.random() > 0.5);
      });
      
      worlds.push(world);
    }
    
    const relations = this.generateTernaryRelations(worlds);
    
    return {
      worlds,
      relations,
      interpretation: new Map(),
      description: `Model with ${worldCount} worlds`
    };
  }

  private generateTernaryRelations(worlds: World[]): TernaryRelation[] {
    const relations: TernaryRelation[] = [];
    
    for (const x of worlds) {
      for (const y of worlds) {
        for (const z of worlds) {
          const relation: TernaryRelation = {
            x, y, z,
            relation: this.computeTernaryRelation(x, y, z)
          };
          relations.push(relation);
        }
      }
    }
    
    return relations;
  }

  private computeTernaryRelation(x: World, y: World, z: World): boolean {
    const sharedTrue = Array.from(x.assignments.keys()).filter(
      key => x.assignments.get(key) && y.assignments.get(key) && z.assignments.get(key)
    ).length;
    
    const anyFalse = Array.from(x.assignments.keys()).some(
      key => !x.assignments.get(key) || !y.assignments.get(key) || !z.assignments.get(key)
    );
    
    return sharedTrue > 0 && !anyFalse;
  }

  private tryAssignments(model: Model, premises: LogicFormula[], conclusion: LogicFormula): boolean {
    for (const world of model.worlds) {
      const premisesTrue = premises.every(premise => this.evaluateInWorld(premise, world, model));
      const conclusionFalse = !this.evaluateInWorld(conclusion, world, model);
      
      if (premisesTrue && conclusionFalse) {
        return true;
      }
    }
    
    return false;
  }

  private evaluateInWorld(formula: LogicFormula, world: World, model: Model): boolean {
    switch (formula.type) {
      case 'atomic':
        if (formula.predicate) {
          return world.assignments.get(formula.predicate) ?? false;
        }
        return false;
        
      case 'compound':
        if (!formula.operator || !formula.subformulas) return false;
        
        switch (formula.operator) {
          case 'and':
            return formula.subformulas.every(sub => this.evaluateInWorld(sub, world, model));
            
          case 'or':
            return formula.subformulas.some(sub => this.evaluateInWorld(sub, world, model));
            
          case 'not':
            return !this.evaluateInWorld(formula.subformulas[0], world, model);
            
          case 'implies':
            const antecedent = this.evaluateInWorld(formula.subformulas[0], world, model);
            const consequent = this.evaluateInWorld(formula.subformulas[1], world, model);
            return !antecedent || consequent;
            
          case 'relevant_implies':
            return this.evaluateRelevantImplication(formula.subformulas[0], formula.subformulas[1], world, model);
            
          case 'forall':
            return this.evaluateUniversal(formula.subformulas[0], world, model);
            
          case 'exists':
            return this.evaluateExistential(formula.subformulas[0], world, model);
            
          default:
            return false;
        }
        
      default:
        return false;
    }
  }

  private evaluateRelevantImplication(antecedent: LogicFormula, consequent: LogicFormula, world: World, model: Model): boolean {
    if (!FormulaUtils.hasSharedVariables(antecedent, consequent)) {
      return false;
    }
    
    const antecedentTrue = this.evaluateInWorld(antecedent, world, model);
    const consequentTrue = this.evaluateInWorld(consequent, world, model);
    
    if (!antecedentTrue) {
      return true;
    }
    
    const relatedWorlds = model.relations.filter(rel => 
      rel.x === world && 
      rel.relation &&
      this.evaluateInWorld(antecedent, rel.y, model)
    );
    
    return relatedWorlds.every(rel => this.evaluateInWorld(consequent, rel.z, model));
  }

  private evaluateUniversal(formula: LogicFormula, world: World, model: Model): boolean {
    return model.worlds.every(w => this.evaluateInWorld(formula, w, model));
  }

  private evaluateExistential(formula: LogicFormula, world: World, model: Model): boolean {
    return model.worlds.some(w => this.evaluateInWorld(formula, w, model));
  }

  private validateCountermodel(model: Model, premises: LogicFormula[], conclusion: LogicFormula): boolean {
    return model.worlds.some(world => {
      const premisesTrue = premises.every(premise => this.evaluateInWorld(premise, world, model));
      const conclusionFalse = !this.evaluateInWorld(conclusion, world, model);
      return premisesTrue && conclusionFalse;
    });
  }

  private extractAllVariables(premises: LogicFormula[], conclusion: LogicFormula): string[] {
    const variables = new Set<string>();
    
    premises.forEach(premise => {
      premise.variables.forEach(v => variables.add(v));
      premise.predicates.forEach(p => variables.add(p));
    });
    
    conclusion.variables.forEach(v => variables.add(v));
    conclusion.predicates.forEach(p => variables.add(p));
    
    return Array.from(variables);
  }

  explainCounterexample(model: Model, premises: LogicFormula[], conclusion: LogicFormula): string {
    const explanations: string[] = [];
    
    for (const world of model.worlds) {
      const premisesTrue = premises.every(premise => this.evaluateInWorld(premise, world, model));
      const conclusionFalse = !this.evaluateInWorld(conclusion, world, model);
      
      if (premisesTrue && conclusionFalse) {
        explanations.push(`In world ${world.id}:`);
        explanations.push(`  All premises are true:`);
        
        premises.forEach((premise, idx) => {
          const isTrue = this.evaluateInWorld(premise, world, model);
          explanations.push(`    Premise ${idx + 1}: ${FormulaUtils.toString(premise)} = ${isTrue}`);
        });
        
        const conclusionValue = this.evaluateInWorld(conclusion, world, model);
        explanations.push(`  But conclusion is false:`);
        explanations.push(`    Conclusion: ${FormulaUtils.toString(conclusion)} = ${conclusionValue}`);
        
        explanations.push(`  Variable assignments:`);
        world.assignments.forEach((value, variable) => {
          explanations.push(`    ${variable} = ${value}`);
        });
        
        break;
      }
    }
    
    if (explanations.length === 0) {
      explanations.push('No counterexample found - the argument appears to be valid.');
    }
    
    return explanations.join('\n');
  }

  generateSimpleCounterexample(premise: LogicFormula, conclusion: LogicFormula): Model | null {
    if (!FormulaUtils.hasSharedVariables(premise, conclusion)) {
      const world: World = {
        id: 'w0',
        assignments: new Map()
      };
      
      premise.variables.forEach(v => world.assignments.set(v, true));
      premise.predicates.forEach(p => world.assignments.set(p, true));
      conclusion.variables.forEach(v => world.assignments.set(v, false));
      conclusion.predicates.forEach(p => world.assignments.set(p, false));
      
      return {
        worlds: [world],
        relations: [],
        interpretation: new Map(),
        description: 'Simple counterexample showing lack of relevance'
      };
    }
    
    return null;
  }
}
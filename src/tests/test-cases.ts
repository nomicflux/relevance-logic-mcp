export interface TestCase {
  name: string;
  description: string;
  argument: string;
  expectedValid: boolean;
  expectedRelevant: boolean;
  system: 'classical' | 'relevance_R' | 'relevance_E' | 'relevance_S';
  category: string;
}

export const testCases: TestCase[] = [
  // Valid Classical and Relevance Logic
  {
    name: "Modus Ponens (Valid)",
    description: "Classic valid argument form",
    argument: `All birds can fly
Penguins are birds
Therefore, penguins can fly`,
    expectedValid: true,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'valid_arguments'
  },

  {
    name: "Universal Instantiation",
    description: "From universal to specific case",
    argument: `All humans are mortal
Socrates is human
Therefore, Socrates is mortal`,
    expectedValid: true,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'valid_arguments'
  },

  // Classical Paradoxes (Invalid in Relevance Logic)
  {
    name: "Material Implication Paradox",
    description: "False statement implies anything",
    argument: `The moon is made of cheese
Therefore, either it is raining or it is not raining`,
    expectedValid: false,
    expectedRelevant: false,
    system: 'relevance_R',
    category: 'relevance_violations'
  },

  {
    name: "Explosion Principle",
    description: "From contradiction, anything follows",
    argument: `It is raining and it is not raining
Therefore, the sky is blue`,
    expectedValid: false,
    expectedRelevant: false,
    system: 'relevance_R',
    category: 'relevance_violations'
  },

  {
    name: "Necessary Truth Paradox",
    description: "Any statement implies a tautology",
    argument: `Dogs are animals
Therefore, either the sun is shining or the sun is not shining`,
    expectedValid: false,
    expectedRelevant: false,
    system: 'relevance_R',
    category: 'relevance_violations'
  },

  // Hypothetical Syllogism
  {
    name: "Hypothetical Syllogism (Valid)",
    description: "Chaining implications",
    argument: `If it rains then the ground gets wet
If the ground gets wet then plants grow
Therefore, if it rains then plants grow`,
    expectedValid: true,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'valid_arguments'
  },

  // Disjunctive Arguments
  {
    name: "Disjunctive Syllogism",
    description: "Either A or B, not A, therefore B",
    argument: `Either the door is open or the door is closed
The door is not open
Therefore, the door is closed`,
    expectedValid: true,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'valid_arguments'
  },

  // Irrelevant Conclusions
  {
    name: "Topic Change Fallacy",
    description: "Conclusion unrelated to premises",
    argument: `All cats are mammals
Mammals need oxygen to survive
Therefore, the stock market will rise tomorrow`,
    expectedValid: false,
    expectedRelevant: false,
    system: 'relevance_R',
    category: 'relevance_violations'
  },

  // Conjunction and Simplification
  {
    name: "Conjunction Introduction",
    description: "Combining related statements",
    argument: `Birds have feathers
Birds can fly
Therefore, birds have feathers and birds can fly`,
    expectedValid: true,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'valid_arguments'
  },

  {
    name: "Simplification",
    description: "From conjunction to component",
    argument: `Dogs are loyal and dogs are friendly
Therefore, dogs are loyal`,
    expectedValid: true,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'valid_arguments'
  },

  // Quantified Statements
  {
    name: "Universal Generalization Issue",
    description: "Invalid generalization",
    argument: `Some birds cannot fly
Therefore, all birds cannot fly`,
    expectedValid: false,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'invalid_arguments'
  },

  // Complex Relevance Cases
  {
    name: "Weak Relevance Connection",
    description: "Shared variables but weak logical connection",
    argument: `All students study hard
Hard work leads to success
Therefore, all students wear backpacks`,
    expectedValid: false,
    expectedRelevant: false,
    system: 'relevance_R',
    category: 'relevance_violations'
  },

  // Conditional Arguments
  {
    name: "Affirming the Consequent (Invalid)",
    description: "Classic logical fallacy",
    argument: `If it rains then the ground is wet
The ground is wet
Therefore, it rained`,
    expectedValid: false,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'invalid_arguments'
  },

  {
    name: "Denying the Antecedent (Invalid)",
    description: "Another classic logical fallacy",
    argument: `If it rains then the ground is wet
It did not rain
Therefore, the ground is not wet`,
    expectedValid: false,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'invalid_arguments'
  },

  // Existential Statements
  {
    name: "Existential Instantiation",
    description: "From some to specific",
    argument: `Some birds migrate
Therefore, there exists a bird that migrates`,
    expectedValid: true,
    expectedRelevant: true,
    system: 'relevance_R',
    category: 'valid_arguments'
  }
];

export const reasoningChains = [
  {
    name: "Valid Reasoning Chain",
    description: "Multi-step reasoning with proper connections",
    steps: [
      "All mammals need oxygen",
      "Whales are mammals", 
      "Therefore, whales need oxygen",
      "Ocean animals that need oxygen must surface",
      "Therefore, whales must surface"
    ],
    expectedValid: true,
    system: 'relevance_R' as const
  },

  {
    name: "Invalid Reasoning Chain",
    description: "Chain with irrelevant step",
    steps: [
      "Plants need water to grow",
      "Rain provides water",
      "Therefore, rain helps plants grow",
      "Rain makes people use umbrellas",
      "Therefore, umbrellas help plants grow"
    ],
    expectedValid: false,
    system: 'relevance_R' as const
  },

  {
    name: "Relevance Violation Chain",
    description: "Chain that loses logical connection",
    steps: [
      "Mathematics requires logical thinking",
      "Logical thinking is important for problem solving",
      "Therefore, mathematics involves problem solving",
      "Ice cream is cold",
      "Therefore, mathematics makes ice cream cold"
    ],
    expectedValid: false,
    system: 'relevance_R' as const
  }
];

export const parseTestCases = [
  {
    statement: "All birds can fly",
    expectedSymbolic: "∀x1(can_fly(x1))",
    expectedVariables: ["x1"],
    expectedPredicates: ["can_fly"]
  },
  {
    statement: "If it rains then the ground is wet",
    expectedSymbolic: "(rains →ᵣ ground_is_wet)",
    expectedVariables: [],
    expectedPredicates: ["rains", "ground_is_wet"]
  },
  {
    statement: "Dogs are loyal and cats are independent",
    expectedSymbolic: "(dogs_are_loyal ∧ cats_are_independent)",
    expectedVariables: [],
    expectedPredicates: ["dogs_are_loyal", "cats_are_independent"]
  },
  {
    statement: "Some students study hard",
    expectedSymbolic: "∃x1(study_hard(x1))",
    expectedVariables: ["x1"], 
    expectedPredicates: ["study_hard"]
  },
  {
    statement: "Not all birds migrate",
    expectedSymbolic: "¬∀x1(migrate(x1))",
    expectedVariables: ["x1"],
    expectedPredicates: ["migrate"]
  }
];

export function getTestCasesByCategory(category: string): TestCase[] {
  return testCases.filter(test => test.category === category);
}

export function getValidTestCases(): TestCase[] {
  return testCases.filter(test => test.expectedValid);
}

export function getRelevanceViolations(): TestCase[] {
  return testCases.filter(test => !test.expectedRelevant);
}
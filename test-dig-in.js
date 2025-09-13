// Test dig_in tool functionality
const test_setup = {
  name: "dig_in",
  arguments: {
    mode: "setup",
    evidence_output: JSON.stringify({
      original_rlmcp_analysis: {
        original_task: "TypeScript has static typing. Static typing is better for large projects. Therefore TypeScript is better for large projects."
      },
      evidence_analysis: {
        evidence_requirements: [
          {
            type: "atom",
            target: "has_static_typing(typescript)",
            description: "Evidence required for: TypeScript has static typing",
            provided: true,
            evidence: {
              summary: "TypeScript documentation confirms static typing support",
              strength: 0.9,
              citation: "https://www.typescriptlang.org/docs/"
            }
          },
          {
            type: "atom", 
            target: "better_for_large_projects(static_typing)",
            description: "Evidence required for: Static typing is better for large projects",
            provided: true,
            evidence: {
              summary: "Microsoft research shows static typing reduces support load by 15%",
              strength: 0.7,
              citation: "Microsoft Developer Productivity Study 2023"
            }
          }
        ]
      }
    }),
    target_requirement_index: 1
  }
};

const test_cleanup = {
  name: "dig_in", 
  arguments: {
    mode: "cleanup",
    evidence_output: JSON.stringify({
      original_rlmcp_analysis: {
        original_task: "TypeScript has static typing. Static typing is better for large projects. Therefore TypeScript is better for large projects."
      },
      evidence_analysis: {
        evidence_requirements: [
          {
            type: "atom",
            target: "has_static_typing(typescript)",
            description: "Evidence required for: TypeScript has static typing"
          },
          {
            type: "atom",
            target: "better_for_large_projects(static_typing)", 
            description: "Evidence required for: Static typing is better for large projects"
          }
        ]
      }
    }),
    target_requirement_index: 1,
    completed_subargument: "Premise 1: Microsoft research shows static typing reduces support load by 15%. Premise 2: Reduced support load improves developer productivity. Premise 3: Improved developer productivity is better for large projects. Conclusion: Static typing is better for large projects."
  }
};

console.log("=== DIG_IN SETUP TEST ===");
console.log(JSON.stringify(test_setup, null, 2));

console.log("\n=== DIG_IN CLEANUP TEST ===");
console.log(JSON.stringify(test_cleanup, null, 2));
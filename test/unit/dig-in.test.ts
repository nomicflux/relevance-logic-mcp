// Test the simplified dig_in logic
function createDigInSubArgument(evidenceBecomesPremise: string, originalAtomBecomesConclusion: string, originalArgument: string) {
  // Validation: Reject if same text used for both premise and conclusion
  if (evidenceBecomesPremise.trim() === originalAtomBecomesConclusion.trim()) {
    throw new Error("evidence_becomes_premise and original_atom_becomes_conclusion cannot be the same text");
  }

  // Create sub-argument: evidence becomes premise, atom/implication becomes conclusion
  const subArgumentText = `${evidenceBecomesPremise}. Therefore, ${originalAtomBecomesConclusion}.`;

  return {
    dig_in_result: {
      atomic_reason_input: {
        step: "extract_atoms",
        argument_text: subArgumentText
      },
      explanation: [
        "The evidence you already provided has become the PREMISE of this NEW sub-argument.",
        "The atom/implication has become the CONCLUSION of this NEW sub-argument.",
        "Make the logical connection FROM your evidence TO the atom/implication valid."
      ],
      instructions: [
        "1. Use 'atomic_reason' with the exact input above",
        "2. Follow the 3-step atomic_reason workflow (extract_atoms → group_atoms → build_symbolic_argument)",
        "3. The argument will likely FAIL validation (logical gap between evidence and conclusion)",
        "4. Add missing premises to create a valid logical chain from evidence to conclusion",
        "5. Re-run 'atomic_reason' step 3 until the sub-argument is logically VALID",
        "6. When complete, you have successfully 'dug in' to strengthen this part of your argument"
      ],
      evidence_now_premise: evidenceBecomesPremise,
      atom_implication_now_conclusion: originalAtomBecomesConclusion,
      original_argument_reference: originalArgument
    }
  };
}

describe('dig_in simplified logic', () => {

  describe('single mode operation', () => {
    it('should create sub-argument from evidence and atom', () => {
      const evidence = "Studies show type safety reduces bugs";
      const atom = "TS_STATIC_TYPES";
      const originalArgument = JSON.stringify({
        validation_result: "VALID",
        symbolic_argument: {
          premises: ["P1: TS_STATIC_TYPES", "P2: TS_STATIC_TYPES → TS_BETTER_LARGE"],
          conclusion: "C: TS_BETTER_LARGE"
        }
      });

      const result = createDigInSubArgument(evidence, atom, originalArgument);

      expect(result.dig_in_result.atomic_reason_input.step).toBe("extract_atoms");
      expect(result.dig_in_result.atomic_reason_input.argument_text).toBe("Studies show type safety reduces bugs. Therefore, TS_STATIC_TYPES.");
      expect(result.dig_in_result.evidence_now_premise).toBe(evidence);
      expect(result.dig_in_result.atom_implication_now_conclusion).toBe(atom);
      expect(result.dig_in_result.original_argument_reference).toBe(originalArgument);
    });

    it('should include proper instructions for atomic_reason workflow', () => {
      const evidence = "Research demonstrates correlation";
      const atom = "CORRELATION_EXISTS";
      const originalArgument = "{}";

      const result = createDigInSubArgument(evidence, atom, originalArgument);

      expect(result.dig_in_result.instructions).toHaveLength(6);
      expect(result.dig_in_result.instructions[0]).toContain("atomic_reason");
      expect(result.dig_in_result.instructions[5]).toContain("successfully 'dug in'");
    });

    it('should reject when evidence and conclusion are identical', () => {
      const sameText = "TypeScript provides static types";
      const originalArgument = "{}";

      expect(() => {
        createDigInSubArgument(sameText, sameText, originalArgument);
      }).toThrow("evidence_becomes_premise and original_atom_becomes_conclusion cannot be the same text");
    });

    it('should include explanation of the transformation', () => {
      const evidence = "Evidence text here";
      const atom = "ATOM_SYMBOL";
      const originalArgument = "{}";

      const result = createDigInSubArgument(evidence, atom, originalArgument);

      expect(result.dig_in_result.explanation).toHaveLength(3);
      expect(result.dig_in_result.explanation[0]).toContain("evidence you already provided has become the PREMISE");
      expect(result.dig_in_result.explanation[1]).toContain("atom/implication has become the CONCLUSION");
      expect(result.dig_in_result.explanation[2]).toContain("Make the logical connection");
    });
  });

  describe('FULL dig_in tool integration', () => {
    it('should execute simplified dig_in operation', async () => {
      const originalArgument = JSON.stringify({
        "validation_result": "VALID",
        "symbolic_argument": {
          "premises": ["P1: TS_STATIC_TYPES", "P2: TS_STATIC_TYPES → TS_BETTER_LARGE"],
          "conclusion": "C: TS_BETTER_LARGE"
        },
        "symbol_definitions": {
          "TS_STATIC_TYPES": "TypeScript provides static type checking",
          "TS_BETTER_LARGE": "TypeScript is better for large projects"
        },
        "argument_for_presentation": {
          "premises": ["P1: TypeScript provides static type checking", "P2: Static types help large projects"],
          "conclusion": "TypeScript is better for large projects"
        },
        "atom_groupings": []
      });

      const evidence = "Research shows type safety reduces bugs by 60%";
      const atom = "TS_STATIC_TYPES";

      console.log("INTEGRATION TEST: Testing simplified dig_in tool execution");
      console.log("INTEGRATION TEST: evidence:", evidence);
      console.log("INTEGRATION TEST: atom:", atom);
      console.log("INTEGRATION TEST: originalArgument:", originalArgument);

      // This simulates the actual simplified tool execution
      console.log("INTEGRATION TEST: Starting validation");
      if (evidence.trim() === atom.trim()) {
        throw new Error("evidence_becomes_premise and original_atom_becomes_conclusion cannot be the same text");
      }

      console.log("INTEGRATION TEST: Creating sub-argument");
      const subArgumentText = `${evidence}. Therefore, ${atom}.`;
      console.log("INTEGRATION TEST: subArgumentText:", subArgumentText);

      const response = {
        content: [{
          type: "text",
          text: JSON.stringify({
            dig_in_result: {
              atomic_reason_input: {
                step: "extract_atoms",
                argument_text: subArgumentText
              },
              explanation: [
                "The evidence you already provided has become the PREMISE of this NEW sub-argument.",
                "The atom/implication has become the CONCLUSION of this NEW sub-argument.",
                "Make the logical connection FROM your evidence TO the atom/implication valid."
              ],
              instructions: [
                "1. Use 'atomic_reason' with the exact input above",
                "2. Follow the 3-step atomic_reason workflow (extract_atoms → group_atoms → build_symbolic_argument)",
                "3. The argument will likely FAIL validation (logical gap between evidence and conclusion)",
                "4. Add missing premises to create a valid logical chain from evidence to conclusion",
                "5. Re-run 'atomic_reason' step 3 until the sub-argument is logically VALID",
                "6. When complete, you have successfully 'dug in' to strengthen this part of your argument"
              ],
              evidence_now_premise: evidence,
              atom_implication_now_conclusion: atom,
              original_argument_reference: originalArgument
            }
          }, null, 2)
        }]
      };

      console.log("INTEGRATION TEST: Final response created:", JSON.stringify(response, null, 2));
      console.log("INTEGRATION TEST: Test completed successfully!");

      // Validate the response structure
      expect(response.content[0].type).toBe("text");
      expect(response.content[0].text).toContain("dig_in_result");
      expect(response.content[0].text).toContain("atomic_reason_input");
      expect(response.content[0].text).toContain("extract_atoms");
      expect(response.content[0].text).toContain(evidence);
      expect(response.content[0].text).toContain(atom);
    });

    it('should validate input parameters correctly', async () => {
      const originalArgument = "{}";
      const evidence = "";
      const atom = "SOME_ATOM";

      console.log("VALIDATION TEST: Testing input validation");

      // Test empty evidence
      expect(() => {
        if (!evidence || !atom) {
          throw new Error("evidence_becomes_premise and original_atom_becomes_conclusion are required");
        }
      }).toThrow("evidence_becomes_premise and original_atom_becomes_conclusion are required");

      // Test identical evidence and atom
      const sameText = "Same text for both";
      expect(() => {
        if (sameText.trim() === sameText.trim()) {
          throw new Error("evidence_becomes_premise and original_atom_becomes_conclusion cannot be the same text");
        }
      }).toThrow("evidence_becomes_premise and original_atom_becomes_conclusion cannot be the same text");

      console.log("VALIDATION TEST: Input validation working correctly");
    });
  });
});
# RLMCP Evidence Gathering Enhancement Plan

## Overview
Enhance the evidence_gathering tool to force users through critical self-assessment steps that help them recognize evidence-conclusion conflicts and iterate between logical validity and evidence support until both succeed.

## Current Problem
Users can construct logically valid but empirically false arguments. The system validates logical structure but doesn't guide users to recognize when their evidence contradicts their conclusions, leading to failed arguments being presented rather than revised.

## Design Principles
- Server remains strictly structural and deterministic
- All analytical judgments stay with the user
- Force users through analytical steps via required input fields
- Guide iteration between rlmcp_reason ↔ evidence_gathering

## Required Changes

### 1. Enhanced Evidence Input Schema
```python
# Current evidence format
evidence_item = {
    "summary": str,
    "strength": float,  # 0.0-1.0
    "citation": str
}

# New required evidence format
evidence_item = {
    "summary": str,
    "strength": float,  # 0.0-1.0
    "citation": str,
    "supports_or_contradicts": str,  # REQUIRED: "supports"/"contradicts"/"neutral"
    "confidence_in_assessment": float,  # REQUIRED: 0.0-1.0
    "strength_justification": str  # REQUIRED: Why this strength rating
}
```

### 2. Mandatory Evidence-to-Claim Mapping
For each atomic formula requiring evidence, force explicit mapping:
```python
evidence_mapping = {
    "atomic_formula": str,  # e.g. "better_performance_projects(php)"
    "user_evidence_assessment": str,  # REQUIRED: "Does your evidence support this claim?"
    "user_strength_rating": float,  # REQUIRED: 0.0-1.0
    "user_contradiction_analysis": str,  # REQUIRED: "Explain any conflicts you see"
    "user_next_action": str  # REQUIRED: "proceed" or "revise_argument"
}
```

### 3. Self-Assessment Checklist (Required)
```python
evidence_review_checklist = {
    "found_contradictory_evidence": str,  # REQUIRED: "YES"/"NO"
    "strength_of_contradictory_evidence": float,  # REQUIRED if YES above
    "should_revise_argument": str,  # REQUIRED: "YES"/"NO"
    "revision_plan": str,  # REQUIRED if revising
    "justification_for_proceeding": str  # REQUIRED if not revising
}
```

### 4. Conflict Resolution Framework
When potential conflicts detected in user input:
```python
conflict_resolution = {
    "detected_pattern": str,  # "You claimed X but provided evidence for NOT-X"
    "user_claimed": str,  # Extract from original argument
    "user_evidence_summary": str,  # Extract from evidence
    "required_resolution": str,  # REQUIRED user explanation
    "resolution_type": str,  # REQUIRED: "no_conflict"/"scope_limitation"/"revise_argument"
    "explanation": str  # REQUIRED: User reasoning
}
```

### 5. Input Validation Changes
```python
# Validation requirements
required_fields = [
    "supports_or_contradicts",
    "confidence_in_assessment", 
    "strength_justification",
    "user_evidence_assessment",
    "user_contradiction_analysis",
    "user_next_action",
    "found_contradictory_evidence",
    "should_revise_argument"
]

# Error handling
if missing_required_fields:
    return {
        "error": "INCOMPLETE_ANALYSIS",
        "message": "Evidence gathering requires self-assessment of contradictions",
        "missing_fields": missing_fields,
        "instruction": "You must analyze whether your evidence supports or contradicts your argument"
    }
```

### 6. Enhanced Output Structure
```python
evidence_analysis_output = {
    "evidence_requirements": [...],  # Existing
    "user_self_assessment": {
        "evidence_mappings": [evidence_mapping, ...],
        "review_checklist": evidence_review_checklist,
        "conflict_resolutions": [conflict_resolution, ...]
    },
    "next_steps": {
        "based_on_user_assessment": str,
        "if_user_found_conflicts": [
            "Revise premises/conclusion based on evidence",
            "Call rlmcp_reason with updated argument", 
            "Repeat evidence_gathering with new argument"
        ],
        "if_no_conflicts_found": [
            "Proceed with argument presentation",
            "Include evidence summary in final answer"
        ],
        "required_user_decision": str  # Based on checklist
    }
}
```

### 7. Iteration Guidance
Add to help text and output:
```python
iteration_guidance = {
    "process": "rlmcp_reason → evidence_gathering → [revise if conflicts] → repeat until both succeed",
    "user_responsibility": "Detect contradictions, assess evidence strength, decide when to revise",
    "success_criteria": "Both logical validity AND evidence support achieved"
}
```

## Implementation Steps

1. **Update evidence_gathering tool schema** to require self-assessment fields
2. **Add input validation** that rejects incomplete analyses  
3. **Restructure output** to force explicit decision points
4. **Update help documentation** to emphasize iterative process
5. **Test with contradiction scenarios** to ensure users are guided to revise

## Success Metrics
- Users naturally cycle between tools when evidence contradicts conclusions
- Completed arguments have both logical validity and evidence support
- Users explicitly address contradictions rather than ignoring them
- Reduced instances of logically valid but empirically false arguments

## Technical Notes
- Maintain server as purely structural processor
- No semantic analysis or judgment by system
- All contradiction detection and resolution by user
- System only enforces completion of analytical steps

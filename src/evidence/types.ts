import { LogicFormula } from '../types.js';

export interface Evidence {
  summary: string;        // Brief description of what the evidence shows
  strength: number;       // 0-1 likelihood that evidence supports the premise
  citation: string;       // Source: code, docs, research, conversation, experiment
}

export interface EvidenceRequiredAtom extends LogicFormula {
  evidence: Evidence;
}

export interface EvidenceRequiredImplication {
  premise: LogicFormula;
  conclusion: LogicFormula;
  evidence: Evidence;    // Evidence supporting the implication itself
}

export interface EvidenceRequiredArgument {
  premises: EvidenceRequiredAtom[];
  implications: EvidenceRequiredImplication[];
  conclusion: EvidenceRequiredAtom;
}

export interface EvidenceValidation {
  isValid: boolean;
  missingComponents: string[];  // Missing summary, strength, or citation
  errors: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ComplianceReport {
  isCompliant: boolean;
  missingEvidence: string[];      // Atoms/implications without evidence
  invalidEvidence: string[];      // Evidence missing required components
  requirements: EvidenceRequirement[];
}

export interface EvidenceRequirement {
  type: 'atom' | 'implication';
  target: string;                 // String representation of the logical component
  description: string;            // What evidence is needed for this component
  provided: boolean;              // Whether AI has provided evidence
  evidence?: Evidence;            // The evidence if provided
}
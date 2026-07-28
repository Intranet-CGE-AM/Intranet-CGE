export type VacationDecision = "approve" | "reject";

export function decisionStatus(
  stage: "supervisor" | "final",
  decision: VacationDecision,
) {
  return `${stage}_${decision === "approve" ? "approved" : "rejected"}` as const;
}

export function canCancelVacation(status: string) {
  return ["draft", "submitted", "supervisor_approved"].includes(status);
}

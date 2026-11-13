import type { BeneficiaryStatus } from "@tapat/shared";
import type { ChipTone } from "../../_components/ui";

export const STATUS_CHIP: Record<BeneficiaryStatus, { label: string; tone?: ChipTone }> = {
  approved: { label: "Approved", tone: "mint" },
  uncertain: { label: "Uncertain" },
  evidence_requested: { label: "Evidence requested" },
  rejected: { label: "Rejected", tone: "danger" },
  enrolled: { label: "Enrolled", tone: "mint" },
};

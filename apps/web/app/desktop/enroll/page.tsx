import Enroll from "@/app/(app)/enroll/page";
import { Notice } from "@/app/(app)/_components/ui";
import { Embedded } from "../_components/kit";

export default function DesktopEnroll() {
  return (
    <Embedded
      title="Enroll driver"
      notice={<Notice title="Simulate the card on a laptop">Use <strong>Simulate card</strong> to enroll from a laptop: it is a simulated tap, and the enrollment is still registered on-chain. <strong>Read card</strong> needs Chrome on Android.</Notice>}
    >
      <Enroll />
    </Embedded>
  );
}

import Enroll from "@/app/(app)/enroll/page";
import { Notice } from "@/app/(app)/_components/ui";
import { Embedded } from "../_components/kit";

export default function DesktopEnroll() {
  return (
    <Embedded
      title="Enroll driver"
      notice={<Notice title="Reading a card needs a phone">Web NFC works only in Chrome on Android. Open TAPat on the enrollment phone to read the blank card.</Notice>}
    >
      <Enroll />
    </Embedded>
  );
}

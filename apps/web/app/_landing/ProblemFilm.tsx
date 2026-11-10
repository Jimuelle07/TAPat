import { ProblemFigure } from "./figures/problem/figure";
import type { ProblemKind } from "./figures/problem/shared";

export function ProblemFilm({ kind }: { kind: ProblemKind }) {
  return <ProblemFigure kind={kind} />;
}

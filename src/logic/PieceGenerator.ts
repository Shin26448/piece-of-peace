import { SideType } from "../types";

type Point = { x: number; y: number };

type CubicSeg = {
  // 현재 점(P0)에서 시작한다고 가정
  c1: Point;
  c2: Point;
  end: Point;
};

export type SideSpec = {
  type: SideType;
  seed: number; // FLAT이면 0이어도 됨
  // 같은 경계선을 반대 방향으로 따라가야 할 때(예: bottom, left) true
  reverse?: boolean;
};

/**
 * 핵심 아이디어
 * - 랜덤(seed)은 "조각"이 아니라 "경계선(edge)"에 붙는다.
 * - 같은 edge는 베지어 세그먼트가 완전히 동일해야 한다.
 * - 한 조각은 edge를 정방향으로, 이웃 조각은 역방향으로 따라간다.
 *   => 역방향인 경우 세그먼트를 "reverse"해서 써야 딱 맞는다.
 */
export class PieceGenerator {
  // ==================================================================================
  // [모양 설정] 표준 직소 퍼즐 비율 (100x100 바디 기준)
  // ==================================================================================
  private static readonly TAB_HEIGHT = 0.28;
  private static readonly NECK_WIDTH = 0.22;
  private static readonly HEAD_WIDTH = 0.35;
  private static readonly JITTER = 0.04;
  private static readonly SKEW_LIMIT = 2;

  // seed + len 조합에 대해 동일 edge를 여러 번 만들지 않게 캐시
  private static edgeCache = new Map<string, CubicSeg[]>();

  public static generatePath(sides: {
    top: SideSpec;
    right: SideSpec;
    bottom: SideSpec;
    left: SideSpec;
  }): string {
    // 바디는 100x100 고정
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 100, y: 0 };
    const p2 = { x: 100, y: 100 };
    const p3 = { x: 0, y: 100 };

    let d = `M ${p0.x} ${p0.y}`;
    d += this.sideToPath(sides.top, p0, p1);
    d += this.sideToPath(sides.right, p1, p2);
    d += this.sideToPath(sides.bottom, p2, p3);
    d += this.sideToPath(sides.left, p3, p0);
    d += " Z";
    return d;
  }

  private static sideToPath(spec: SideSpec, start: Point, end: Point): string {
    if (spec.type === SideType.FLAT) {
      return ` L ${end.x} ${end.y}`;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // 표준 로컬 좌표: start=(0,0), end=(len,0)
    // 로컬에서 "위쪽(-y)"이 바깥쪽(tab)으로 보이게 dir를 -1로 둠
    const dir = spec.type === SideType.TAB ? -1 : 1;

    // 같은 edge는 같은 seed로 같은 세그먼트를 만든다.
    // 단, TAB/SLOT은 y방향만 반전되면 되므로, "base"는 dir=+1 기준으로 만들고,
    // 실제 사용 시 dir로 y만 뒤집는다.
    const baseSegs = this.getBaseEdgeSegments(len, spec.seed);

    // dir 적용(탭/홈) + 필요 시 reverse
    let segs = this.applyDir(baseSegs, dir);
    if (spec.reverse) segs = this.reverseSegments(segs, len);

    // 로컬 -> 글로벌 변환(회전+이동)
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const toGlobal = (p: Point): Point => {
      return {
        x: start.x + p.x * cos - p.y * sin,
        y: start.y + p.x * sin + p.y * cos,
      };
    };

    let d = "";
    for (let i = 0; i < segs.length; i++) {
      const g1 = toGlobal(segs[i].c1);
      const g2 = toGlobal(segs[i].c2);
      const ge = toGlobal(segs[i].end);
      d += ` C ${g1.x} ${g1.y}, ${g2.x} ${g2.y}, ${ge.x} ${ge.y}`;
    }
    return d;
  }

  // ==================================================================================
  // Edge 생성(표준 방향, dir=+1 기준)
  // ==================================================================================
  private static getBaseEdgeSegments(len: number, seed: number): CubicSeg[] {
    const key = `${seed}|${len.toFixed(4)}`;
    const cached = this.edgeCache.get(key);
    if (cached) return cached;

    // 간단한 deterministic RNG (seed 기반)
    const random = (offset: number) => {
      const x = Math.sin(seed * 999 + offset) * 10000;
      return x - Math.floor(x);
    };
    const range = (offset: number) => random(offset) * 2 - 1;

    // dir=+1 기준으로 "아래(+y)"로 bulge가 나가게 만든다.
    // 실제 TAB일 때는 dir=-1로 y를 반전해서 위로 나오게 됨.
    const tabH = len * (this.TAB_HEIGHT + range(1) * this.JITTER);
    const neckW = len * (this.NECK_WIDTH + range(2) * this.JITTER);
    const headW = len * (this.HEAD_WIDTH + range(3) * this.JITTER);
    const skew = range(4) * this.SKEW_LIMIT;

    const mid = len / 2;
    const neckL = mid - neckW / 2;
    const neckR = mid + neckW / 2;

    const shoulderY = tabH * 0.15;
    const neckY = tabH * 0.22;
    const headY = tabH;

    const segs: CubicSeg[] = [
      {
        c1: { x: len * 0.2, y: 0 },
        c2: { x: neckL - 2, y: shoulderY },
        end: { x: neckL, y: neckY },
      },
      {
        c1: { x: neckL - 2, y: headY * 0.4 },
        c2: { x: mid + skew - headW * 0.8, y: headY },
        end: { x: mid + skew, y: headY },
      },
      {
        c1: { x: mid + skew + headW * 0.8, y: headY },
        c2: { x: neckR + 2, y: headY * 0.4 },
        end: { x: neckR, y: neckY },
      },
      {
        c1: { x: neckR + 2, y: shoulderY },
        c2: { x: len * 0.8, y: 0 },
        end: { x: len, y: 0 },
      },
    ];

    this.edgeCache.set(key, segs);
    return segs;
  }

  private static applyDir(base: CubicSeg[], dir: number): CubicSeg[] {
    // dir=-1이면 y반전
    const out: CubicSeg[] = [];
    for (let i = 0; i < base.length; i++) {
      out.push({
        c1: { x: base[i].c1.x, y: base[i].c1.y * dir },
        c2: { x: base[i].c2.x, y: base[i].c2.y * dir },
        end: { x: base[i].end.x, y: base[i].end.y * dir },
      });
    }
    return out;
  }

  private static reverseSegments(segs: CubicSeg[], len: number): CubicSeg[] {
    // 전체 경로를 뒤집는다.
    // 규칙: (P0,P1,P2,P3) reversed = (P3,P2,P1,P0)
    // 로컬 좌표 기준 start=(0,0), end=(len,0)이고,
    // reverse 시 x는 (len - x)로 바뀐다.
    const out: CubicSeg[] = [];

    // 원래 세그먼트의 "점들"을 먼저 복원한다.
    // P0는 (0,0)
    const P0: Point[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < segs.length; i++) {
      P0.push({ x: segs[i].end.x, y: segs[i].end.y });
    }

    for (let i = segs.length - 1; i >= 0; i--) {
      // 원래 i번째 세그: (Pi, c1, c2, Pi+1)
      const Pi = P0[i];
      const s = segs[i];

      // reversed 세그: (Pi+1, c2', c1', Pi)
      const rev: CubicSeg = {
        c1: { x: s.c2.x, y: s.c2.y },
        c2: { x: s.c1.x, y: s.c1.y },
        end: { x: Pi.x, y: Pi.y },
      };

      // 좌표계를 "새 start"(원래 end) 기준으로 뒤집기 위해 x를 (len - x)
      rev.c1.x = len - rev.c1.x;
      rev.c2.x = len - rev.c2.x;
      rev.end.x = len - rev.end.x;

      out.push(rev);
    }

    return out;
  }
}

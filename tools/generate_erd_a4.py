"""Sinh sơ đồ ERD khổ A4 ngang (297x210 mm) cho Marka Platform.

Mọi toạ độ tính bằng mm để bản in đúng tỉ lệ 1:1. Nguồn dữ liệu: backend/prisma/schema.prisma.
Chạy: python tools/generate_erd_a4.py
"""

from __future__ import annotations

import math
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs" / "diagrams"

PAGE_W, PAGE_H = 297.0, 210.0
MARGIN_X = 10.0
COL_W = 62.5
COL_GAP = 8.5
COL_X = [MARGIN_X + i * (COL_W + COL_GAP) for i in range(4)]

ROW_TOP = 22.0
ROW_GAP = 9.5

HEAD_H = 5.6
ROW_H = 4.0
PAD_B = 1.4

FS_TITLE = 4.8
FS_SUB = 2.45
FS_TABLE = 3.2
FS_FIELD = 2.8
FS_TYPE = 2.35
FS_TAG = 1.8
FS_LEGEND = 2.2

INK = "#1e293b"
MUTED = "#7c8798"
BORDER = "#94a3b8"

DOMAINS = {
    "id": {"fill": "#dbe9f7", "line": "#2f6690", "label": "Tài khoản & Workspace"},
    "content": {"fill": "#dcefdc", "line": "#2f7d4f", "label": "Nội dung"},
    "publish": {"fill": "#fbe6cd", "line": "#b06a1f", "label": "Đăng bài & Phân tích"},
    "billing": {"fill": "#e6ddf3", "line": "#6b46a8", "label": "Thanh toán & Tín dụng"},
    "ops": {"fill": "#d8ebe7", "line": "#0f6e63", "label": "AI & Vận hành"},
}


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


@dataclass
class Table:
    key: str
    col: int
    row: int
    dom: str
    fields: list[tuple[str, str, str]]
    x: float = 0.0
    y: float = 0.0
    w: float = COL_W
    h: float = 0.0

    @property
    def bottom(self) -> float:
        return self.y + self.h

    @property
    def right(self) -> float:
        return self.x + self.w

    @property
    def mid(self) -> float:
        return self.y + self.h / 2


TABLES: dict[str, Table] = {}


def add_table(key: str, col: int, row: int, dom: str, fields: list[tuple[str, str, str]]) -> None:
    TABLES[key] = Table(key, col, row, dom, fields)


add_table("members", 0, 0, "id", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("userId", "uuid", "FK"),
    ("role", "enum", ""),
    ("allowDirectPublish", "bool", ""),
    ("createdAt", "timestamp", ""),
])
add_table("users", 1, 0, "id", [
    ("id", "uuid", "PK"),
    ("email", "varchar", ""),
    ("name", "varchar", ""),
    ("passwordHash", "varchar", ""),
    ("authProvider", "enum", ""),
    ("systemRole", "enum", ""),
    ("emailVerified", "bool", ""),
])
add_table("workspaces", 2, 0, "id", [
    ("id", "uuid", "PK"),
    ("name", "varchar", ""),
    ("plan", "enum", ""),
    ("remainingCredit", "int", ""),
    ("monthlyQuota", "int", ""),
    ("brandVoice", "json", ""),
    ("planExpiresAt", "timestamp", ""),
])
add_table("invites", 3, 0, "id", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("email", "varchar", ""),
    ("role", "enum", ""),
    ("token", "varchar", ""),
    ("expiresAt", "timestamp", ""),
    ("invitedById", "uuid", "FK"),
])

add_table("tasks", 0, 1, "content", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("title", "varchar", ""),
    ("status", "enum", ""),
    ("assigneeId", "uuid", "FK"),
    ("postId", "uuid", "FK"),
])
add_table("posts", 1, 1, "content", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("title", "varchar", ""),
    ("content", "json", ""),
    ("status", "enum", ""),
    ("assigneeId", "uuid", "FK"),
    ("createdById", "uuid", "FK"),
])
add_table("media", 2, 1, "content", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("postId", "uuid", "FK"),
    ("url", "varchar", ""),
    ("type", "enum", ""),
    ("source", "enum", ""),
    ("createdById", "uuid", "FK"),
])
add_table("channels", 3, 1, "publish", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("platform", "enum", ""),
    ("type", "enum", ""),
    ("name", "varchar", ""),
    ("status", "enum", ""),
])

add_table("orders", 0, 2, "billing", [
    ("id", "uuid", "PK"),
    ("orderCode", "varchar", ""),
    ("workspaceId", "uuid", "FK"),
    ("packageId", "uuid", "FK"),
    ("amount", "int", ""),
    ("status", "enum", ""),
    ("createdById", "uuid", "FK"),
])
add_table("scheduled", 1, 2, "publish", [
    ("id", "uuid", "PK"),
    ("postId", "uuid", "FK"),
    ("channelId", "uuid", "FK"),
    ("scheduledAt", "timestamp", ""),
    ("status", "enum", ""),
    ("externalPostId", "varchar", ""),
    ("publishedAt", "timestamp", ""),
])
add_table("metrics", 2, 2, "publish", [
    ("id", "uuid", "PK"),
    ("scheduledPostId", "uuid", "FK"),
    ("reactions", "int", ""),
    ("comments", "int", ""),
    ("shares", "int", ""),
    ("reach", "int", ""),
])
add_table("aigen", 3, 2, "ops", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("userId", "uuid", "FK"),
    ("postId", "uuid", "FK"),
    ("type", "enum", ""),
    ("status", "enum", ""),
    ("creditCost", "int", ""),
])

add_table("packages", 0, 3, "billing", [
    ("id", "uuid", "PK"),
    ("name", "varchar", ""),
    ("creditAmount", "int", ""),
    ("price", "int", ""),
    ("isActive", "bool", ""),
    ("sortOrder", "int", ""),
])
add_table("ctxtx", 1, 3, "billing", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("type", "enum", ""),
    ("action", "enum", ""),
    ("amount", "int", ""),
    ("balanceAfter", "int", ""),
    ("createdById", "uuid", "FK"),
])
add_table("notifs", 2, 3, "ops", [
    ("id", "uuid", "PK"),
    ("userId", "uuid", "FK"),
    ("workspaceId", "uuid", "FK"),
    ("type", "varchar", ""),
    ("isRead", "bool", ""),
    ("createdAt", "timestamp", ""),
])
add_table("audit", 3, 3, "ops", [
    ("id", "uuid", "PK"),
    ("workspaceId", "uuid", "FK"),
    ("actorId", "uuid", "FK"),
    ("action", "varchar", ""),
    ("targetType", "varchar", ""),
    ("targetId", "varchar", ""),
    ("createdAt", "timestamp", ""),
])


def height(t: Table) -> float:
    return HEAD_H + len(t.fields) * ROW_H + PAD_B


def place_tables() -> None:
    row_y: list[float] = []
    y = ROW_TOP
    for r in range(4):
        row_y.append(y)
        tallest = max(height(t) for t in TABLES.values() if t.row == r)
        y += tallest + ROW_GAP

    for t in TABLES.values():
        t.x = COL_X[t.col]
        t.y = row_y[t.row]
        t.h = height(t)


place_tables()

EXIT_H = 2.6


def top(name: str, frac: float = 0.5) -> tuple[float, float]:
    t = TABLES[name]
    return (t.x + t.w * frac, t.y)


def bottom(name: str, frac: float = 0.5) -> tuple[float, float]:
    t = TABLES[name]
    return (t.x + t.w * frac, t.bottom)


def left(name: str, frac: float = 0.5) -> tuple[float, float]:
    t = TABLES[name]
    return (t.x, t.y + t.h * frac)


def right(name: str, frac: float = 0.5) -> tuple[float, float]:
    t = TABLES[name]
    return (t.right, t.y + t.h * frac)


B0 = max(t.bottom for t in TABLES.values() if t.row == 0)
B1 = max(t.bottom for t in TABLES.values() if t.row == 1)

GUT0 = COL_X[0] + COL_W + COL_GAP / 2
GUT1 = COL_X[1] + COL_W + COL_GAP / 2
GUT2 = COL_X[2] + COL_W + COL_GAP / 2
WSR_X = GUT2 - 0.3
USR_X = PAGE_W - 6.5
TOP_LANE = 18.3


def ws_lane(i: int) -> float:
    return B0 + 3.0 + i * 1.3


@dataclass
class Edge:
    src: str
    dst: str
    pts: list[tuple[float, float]]
    kind: str = "ws"
    card_src: str = "N"
    card_dst: str = "1"


EDGES: list[Edge] = []


def edge(src: str, dst: str, pts, kind="ws", card_src="N", card_dst="1") -> None:
    EDGES.append(Edge(src, dst, pts, kind, card_src, card_dst))


def build_edges() -> None:
    ws = TABLES["workspaces"]
    us = TABLES["users"]

    # --- Hàng 0: thành viên & lời mời --------------------------------------
    edge("members", "users", [right("members", 0.55), left("users", 0.55)], "user")

    edge("members", "workspaces", [
        bottom("members", 0.5),
        (bottom("members", 0.5)[0], ws_lane(0)),
        (ws.x + 26, ws_lane(0)),
        (ws.x + 26, ws.bottom),
    ])

    edge("invites", "workspaces", [left("invites", 0.75), right("workspaces", 0.75)])

    edge("invites", "users", [
        right("invites", 0.5),
        (USR_X, right("invites", 0.5)[1]),
        (USR_X, TOP_LANE),
        (us.x + 15, TOP_LANE),
        (us.x + 15, us.y),
    ], "user", "N", "1")

    # --- Hàng 1: nội dung & kênh ------------------------------------------
    edge("posts", "users", [top("posts", 0.5), bottom("users", 0.5)], "user")

    edge("posts", "workspaces", [
        top("posts", 0.72),
        (top("posts", 0.72)[0], ws_lane(1)),
        (ws.x + 38, ws_lane(1)),
        (ws.x + 38, ws.bottom),
    ])

    edge("tasks", "posts", [(TABLES["tasks"].right, TABLES["posts"].mid), (TABLES["posts"].x, TABLES["posts"].mid)], "flow", "1", "1")

    edge("media", "posts", [(TABLES["media"].x, TABLES["posts"].mid), (TABLES["posts"].right, TABLES["posts"].mid)], "flow")

    edge("posts", "scheduled", [bottom("posts", 0.5), top("scheduled", 0.5)], "flow")

    edge("tasks", "users", [
        right("tasks", 0.62),
        (GUT0 - 3.2, right("tasks", 0.62)[1]),
        (GUT0 - 3.2, us.y + 20),
        (us.x, us.y + 20),
    ], "user")

    edge("tasks", "workspaces", [
        top("tasks", 0.78),
        (top("tasks", 0.78)[0], ws_lane(2)),
        (ws.x + 6, ws_lane(2)),
        (ws.x + 6, ws.bottom),
    ])

    edge("media", "workspaces", [top("media", 0.5), bottom("workspaces", 0.5)])

    edge("media", "users", [
        left("media", 0.55),
        (GUT1 + 0.5, left("media", 0.55)[1]),
        (GUT1 + 0.5, us.y + 22),
        (us.right, us.y + 22),
    ], "user")

    edge("channels", "workspaces", [
        left("channels", 0.45),
        (WSR_X, left("channels", 0.45)[1]),
        (WSR_X, ws.bottom + 1.7),
        (ws.x + 56, ws.bottom + 1.7),
        (ws.x + 56, ws.bottom),
    ])

    # --- Hàng 2: đăng bài, đo lường, AI -----------------------------------
    edge("metrics", "scheduled", [
        left("metrics", 0.5),
        (GUT1 - 0.8, left("metrics", 0.5)[1]),
        (GUT1 - 0.8, TABLES["scheduled"].y + 24),
        (TABLES["scheduled"].right, TABLES["scheduled"].y + 24),
    ], "flow", "1", "1")

    edge("scheduled", "channels", [
        right("scheduled", 0.25),
        (GUT1 + 1.9, right("scheduled", 0.25)[1]),
        (GUT1 + 1.9, B1 + 2.4),
        (TABLES["channels"].x + 30, B1 + 2.4),
        (TABLES["channels"].x + 30, TABLES["channels"].bottom),
    ], "flow")

    edge("aigen", "posts", [
        top("aigen", 0.25),
        (top("aigen", 0.25)[0], B1 + 4.5),
        (TABLES["posts"].right - 8, B1 + 4.5),
        (TABLES["posts"].right - 8, TABLES["posts"].bottom),
    ], "flow")

    edge("aigen", "workspaces", [
        left("aigen", 0.72),
        (WSR_X, left("aigen", 0.72)[1]),
        (WSR_X, ws.bottom + 1.7),
        (ws.x + 56, ws.bottom + 1.7),
        (ws.x + 56, ws.bottom),
    ])

    edge("aigen", "users", [
        right("aigen", 0.5),
        (USR_X, right("aigen", 0.5)[1]),
        (USR_X, TOP_LANE + 1.4),
        (us.x + 23, TOP_LANE + 1.4),
        (us.x + 23, us.y),
    ], "user", "N", "1")

    # --- Hàng 2-3: thanh toán --------------------------------------------
    edge("orders", "packages", [bottom("orders", 0.28), top("packages", 0.28)], "flow")

    edge("orders", "users", [
        right("orders", 0.3),
        (GUT0 - 2.0, right("orders", 0.3)[1]),
        (GUT0 - 2.0, us.y + 23),
        (us.x, us.y + 23),
    ], "user")

    edge("orders", "workspaces", [
        right("orders", 0.62),
        (GUT0 + 0.9, right("orders", 0.62)[1]),
        (GUT0 + 0.9, ws_lane(3)),
        (ws.x + 18, ws_lane(3)),
        (ws.x + 18, ws.bottom),
    ])

    edge("ctxtx", "workspaces", [
        right("ctxtx", 0.3),
        (GUT1 - 1.8, right("ctxtx", 0.3)[1]),
        (GUT1 - 1.8, ws_lane(4)),
        (ws.x + 50, ws_lane(4)),
        (ws.x + 50, ws.bottom),
    ])

    edge("ctxtx", "users", [
        left("ctxtx", 0.55),
        (GUT0 - 0.8, left("ctxtx", 0.55)[1]),
        (GUT0 - 0.8, us.y + 26),
        (us.x, us.y + 26),
    ], "user")

    # --- Hàng 3: vận hành --------------------------------------------------
    edge("notifs", "users", [
        left("notifs", 0.3),
        (GUT1 - 0.6, left("notifs", 0.3)[1]),
        (GUT1 - 0.6, us.y + 18),
        (us.right, us.y + 18),
    ], "user")

    edge("notifs", "workspaces", [
        right("notifs", 0.6),
        (WSR_X, right("notifs", 0.6)[1]),
        (WSR_X, ws.bottom + 1.7),
        (ws.x + 56, ws.bottom + 1.7),
        (ws.x + 56, ws.bottom),
    ], "ws", "N", "")

    edge("audit", "workspaces", [
        left("audit", 0.3),
        (WSR_X, left("audit", 0.3)[1]),
        (WSR_X, ws.bottom + 1.7),
        (ws.x + 56, ws.bottom + 1.7),
        (ws.x + 56, ws.bottom),
    ], "ws", "N", "")

    edge("audit", "users", [
        right("audit", 0.7),
        (USR_X, right("audit", 0.7)[1]),
        (USR_X, TOP_LANE + 1.4),
        (us.x + 31, TOP_LANE + 1.4),
        (us.x + 31, us.y),
    ], "user", "N", "1")


build_edges()

EDGE_STYLE = {
    "ws": {"stroke": DOMAINS["id"]["line"], "dash": None, "width": 0.3},
    "user": {"stroke": "#a16207", "dash": "1.1 0.9", "width": 0.28},
    "flow": {"stroke": DOMAINS["content"]["line"], "dash": None, "width": 0.32},
}


def rounded_path(pts: list[tuple[float, float]], r: float = 1.4) -> str:
    if len(pts) < 3:
        return "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in pts)

    d = [f"M {pts[0][0]:.2f} {pts[0][1]:.2f}"]
    for i in range(1, len(pts) - 1):
        p0, p1, p2 = pts[i - 1], pts[i], pts[i + 1]
        v1 = (p1[0] - p0[0], p1[1] - p0[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1 = math.hypot(*v1)
        l2 = math.hypot(*v2)
        if l1 < 1e-6 or l2 < 1e-6:
            continue
        rr = min(r, l1 / 2, l2 / 2)
        a = (p1[0] - v1[0] / l1 * rr, p1[1] - v1[1] / l1 * rr)
        b = (p1[0] + v2[0] / l2 * rr, p1[1] + v2[1] / l2 * rr)
        d.append(f"L {a[0]:.2f} {a[1]:.2f}")
        d.append(f"Q {p1[0]:.2f} {p1[1]:.2f} {b[0]:.2f} {b[1]:.2f}")
    d.append(f"L {pts[-1][0]:.2f} {pts[-1][1]:.2f}")
    return " ".join(d)


def check_collisions() -> list[str]:
    problems: list[str] = []
    for e in EDGES:
        segs = len(e.pts) - 1
        for i in range(segs):
            (x1, y1), (x2, y2) = e.pts[i], e.pts[i + 1]
            for t in TABLES.values():
                pad = 0.2
                bx1, by1, bx2, by2 = t.x - pad, t.y - pad, t.right + pad, t.bottom + pad
                if abs(y1 - y2) < 1e-6:
                    if not by1 < y1 < by2:
                        continue
                    lo, hi = sorted((x1, x2))
                    overlap = min(hi, bx2) - max(lo, bx1)
                elif abs(x1 - x2) < 1e-6:
                    if not bx1 < x1 < bx2:
                        continue
                    lo, hi = sorted((y1, y2))
                    overlap = min(hi, by2) - max(lo, by1)
                else:
                    continue
                if overlap <= 0.6:
                    continue
                if i == 0 and t.key == e.src:
                    continue
                if i == segs - 1 and t.key == e.dst:
                    continue
                problems.append(f"{e.src}->{e.dst} cắt qua {t.key} (đoạn {i})")
    return problems


def crow_foot(p, q, kind: str, stroke: str) -> list[str]:
    """Ký hiệu chân vịt: 'N' = nhiều, '1' = một. p là điểm trên bảng, q là điểm kế tiếp."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dy) or 1.0
    ux, uy = dx / length, dy / length
    nx, ny = -uy, ux
    out: list[str] = []
    if kind == "N":
        tip = (p[0] + ux * 1.7, p[1] + uy * 1.7)
        for off in (-0.85, 0.0, 0.85):
            a = (p[0] + nx * off, p[1] + ny * off)
            out.append(
                f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{tip[0]:.2f}" y2="{tip[1]:.2f}" '
                f'stroke="{stroke}" stroke-width="0.26" stroke-linecap="round"/>'
            )
    elif kind == "1":
        cx = p[0] + ux * 1.35
        cy = p[1] + uy * 1.35
        a = (cx + nx * 0.8, cy + ny * 0.8)
        b = (cx - nx * 0.8, cy - ny * 0.8)
        out.append(
            f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" '
            f'stroke="{stroke}" stroke-width="0.26" stroke-linecap="round"/>'
        )
    return out


def build_svg() -> str:
    out: list[str] = []
    out.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{PAGE_W}mm" height="{PAGE_H}mm" '
        f'viewBox="0 0 {PAGE_W} {PAGE_H}" font-family="Segoe UI, Arial, sans-serif">'
    )
    out.append(f'<rect width="{PAGE_W}" height="{PAGE_H}" fill="#ffffff"/>')

    out.append(
        f'<text x="{PAGE_W / 2}" y="10.6" text-anchor="middle" font-size="{FS_TITLE}" '
        f'font-weight="700" fill="#0f172a">Marka Platform — Sơ đồ thực thể cơ sở dữ liệu (ERD)</text>'
    )
    out.append(
        f'<text x="{PAGE_W / 2}" y="15.8" text-anchor="middle" font-size="{FS_SUB}" '
        f'fill="#55637a">16 bảng · 28 quan hệ · PostgreSQL · Prisma ORM</text>'
    )

    for e in EDGES:
        st = EDGE_STYLE[e.kind]
        dash = f' stroke-dasharray="{st["dash"]}"' if st["dash"] else ""
        out.append(
            f'<path d="{rounded_path(e.pts)}" fill="none" stroke="{st["stroke"]}" '
            f'stroke-width="{st["width"]}" stroke-linecap="round"{dash}/>'
        )
        for at_start in (True, False):
            text = e.card_src if at_start else e.card_dst
            if not text:
                continue
            p = e.pts[0] if at_start else e.pts[-1]
            q = e.pts[1] if at_start else e.pts[-2]
            out.extend(crow_foot(p, q, text, st["stroke"]))

    for t in TABLES.values():
        dom = DOMAINS[t.dom]
        out.append(
            f'<rect x="{t.x}" y="{t.y}" width="{t.w}" height="{t.h}" rx="1.1" '
            f'fill="#ffffff" stroke="{BORDER}" stroke-width="0.28"/>'
        )
        out.append(
            f'<path d="M {t.x + 1.1} {t.y} H {t.right - 1.1} A 1.1 1.1 0 0 1 {t.right} {t.y + 1.1} '
            f'V {t.y + HEAD_H} H {t.x} V {t.y + 1.1} A 1.1 1.1 0 0 1 {t.x + 1.1} {t.y} Z" '
            f'fill="{dom["fill"]}" stroke="none"/>'
        )
        out.append(
            f'<line x1="{t.x}" y1="{t.y + HEAD_H}" x2="{t.right}" y2="{t.y + HEAD_H}" '
            f'stroke="{dom["line"]}" stroke-width="0.32"/>'
        )
        out.append(
            f'<rect x="{t.x}" y="{t.y}" width="1.5" height="{t.h}" fill="{dom["line"]}" stroke="none"/>'
        )
        out.append(
            f'<text x="{t.x + t.w / 2}" y="{t.y + 3.62}" text-anchor="middle" font-size="{FS_TABLE}" '
            f'font-weight="700" fill="#0f172a">{esc(t.key)}</text>'
        )

        for i, (name, typ, key) in enumerate(t.fields):
            cy = t.y + HEAD_H + (i + 1) * ROW_H - 1.05
            if key:
                tag_color = "#9a5b00" if key == "PK" else MUTED
                out.append(
                    f'<text x="{t.x + 2.2}" y="{cy:.2f}" font-size="{FS_TAG}" font-weight="700" '
                    f'fill="{tag_color}">{key}</text>'
                )
            style = ' font-weight="600"' if key == "PK" else ''
            fill = INK if key else "#334155"
            out.append(
                f'<text x="{t.x + 6.4}" y="{cy:.2f}" font-size="{FS_FIELD}"{style} '
                f'fill="{fill}">{esc(name)}</text>'
            )
            out.append(
                f'<text x="{t.right - 2.0}" y="{cy:.2f}" text-anchor="end" font-size="{FS_TYPE}" '
                f'fill="{MUTED}">{esc(typ)}</text>'
            )

    draw_legend(out)
    draw_notes(out)

    out.append("</svg>")
    return "\n".join(out)


def draw_legend(out: list[str]) -> None:
    y = 194.8
    x = MARGIN_X
    out.append(
        f'<text x="{x}" y="{y}" font-size="{FS_LEGEND}" font-weight="700" fill="#0f172a">Phân hệ</text>'
    )
    x += 12.5
    for dom in DOMAINS.values():
        out.append(
            f'<rect x="{x}" y="{y - 2.9}" width="4.6" height="3.2" rx="0.6" fill="{dom["fill"]}" '
            f'stroke="{dom["line"]}" stroke-width="0.22"/>'
        )
        out.append(
            f'<text x="{x + 5.9}" y="{y}" font-size="{FS_LEGEND}" fill="#334155">{esc(dom["label"])}</text>'
        )
        x += 5.9 + len(dom["label"]) * 1.1 + 6.0

    y = 201.4
    x = MARGIN_X
    out.append(
        f'<text x="{x}" y="{y}" font-size="{FS_LEGEND}" font-weight="700" fill="#0f172a">Quan hệ</text>'
    )
    x += 14.0
    items = [
        ("ws", "N — 1  bảng thuộc workspace"),
        ("user", "N — 1  tham chiếu người dùng"),
        ("flow", "1 — 1 / 1 — N  luồng nội dung"),
    ]
    for kind, label in items:
        st = EDGE_STYLE[kind]
        dash = f' stroke-dasharray="{st["dash"]}"' if st["dash"] else ""
        out.append(
            f'<path d="M {x} {y - 1.0} L {x + 12} {y - 1.0}" fill="none" stroke="{st["stroke"]}" '
            f'stroke-width="0.55"{dash}/>'
        )
        out.extend(crow_foot((x, y - 1.0), (x + 3, y - 1.0), "N", st["stroke"]))
        out.extend(crow_foot((x + 12, y - 1.0), (x + 9, y - 1.0), "1", st["stroke"]))
        out.append(
            f'<text x="{x + 14.2}" y="{y}" font-size="{FS_LEGEND}" fill="#334155">{esc(label)}</text>'
        )
        x += 14.2 + len(label) * 1.1 + 7.5


def draw_notes(out: list[str]) -> None:
    out.append(
        f'<text x="{PAGE_W - MARGIN_X}" y="206.6" text-anchor="end" font-size="1.9" fill="{MUTED}">'
        f'PK: khoá chính · FK: khoá ngoại · Nhiều FK cùng trỏ về một bảng được gộp thành một đường'
        f'</text>'
    )


def main() -> None:
    problems = check_collisions()
    if problems:
        print(f"CẢNH BÁO: {len(problems)} đường nối cắt qua bảng:")
        for p in problems:
            print("  " + p)

    svg = build_svg()
    svg_path = DOCS / "erd_marka_a4.svg"
    svg_path.write_text(svg, encoding="utf-8")
    print(f"SVG: {svg_path}")

    png_path = DOCS / "erd_marka_a4.png"
    subprocess.run(
        ["node", str(ROOT / "tools" / "render_svg.js"), str(svg_path), str(png_path), "300"],
        check=True,
    )
    from PIL import Image

    with Image.open(png_path) as img:
        img.save(png_path, dpi=(300, 300))
    print(f"PNG: {png_path} (3508x2480 px @ 300dpi = 297x210 mm)")


if __name__ == "__main__":
    main()

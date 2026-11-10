"""Gọi hệ gợi ý của website (recommender/engine.js) từ Python.

Mỗi lần gọi chạy ``node streamlit_app/bridge.js``, gửi một yêu cầu JSON qua stdin và đọc
một kết quả JSON từ stdout. Nhờ vậy ứng dụng Streamlit dùng CHÍNH thuật toán của website
và của thực nghiệm offline, không có bản sao thứ hai có thể lệch kết quả.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

APP_DIR = Path(__file__).resolve().parent
ROOT = APP_DIR.parent
BRIDGE = APP_DIR / "bridge.js"
EVALUATION_FILE = ROOT / "evaluation" / "results" / "latest.json"


class BridgeError(RuntimeError):
    """Lỗi khi chạy hệ gợi ý (thiếu Node.js, dữ liệu, hoặc yêu cầu không hợp lệ)."""


def node_executable() -> str | None:
    return shutil.which("node")


def call(request: dict[str, Any], timeout: int = 120) -> Any:
    node = node_executable()
    if not node:
        raise BridgeError(
            "Không tìm thấy Node.js. Hãy cài Node.js 18 trở lên (https://nodejs.org) — "
            "ứng dụng dùng chung bộ máy gợi ý JavaScript với website."
        )
    try:
        proc = subprocess.run(
            [node, str(BRIDGE)],
            input=json.dumps(request, ensure_ascii=False).encode("utf-8"),
            capture_output=True,
            timeout=timeout,
            cwd=str(ROOT),
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise BridgeError("Hệ gợi ý phản hồi quá lâu.") from exc
    output = proc.stdout.decode("utf-8", errors="replace").strip()
    if not output:
        detail = proc.stderr.decode("utf-8", errors="replace").strip().splitlines()
        raise BridgeError("Hệ gợi ý không trả kết quả. " + (detail[-1] if detail else ""))
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as exc:
        raise BridgeError("Kết quả từ hệ gợi ý không hợp lệ.") from exc
    if not payload.get("ok"):
        raise BridgeError(payload.get("error") or "Lỗi không xác định.")
    return payload["data"]


def load_evaluation() -> dict[str, Any] | None:
    """Kết quả thực nghiệm offline do ``npm run evaluate`` sinh ra."""
    if not EVALUATION_FILE.exists():
        return None
    return json.loads(EVALUATION_FILE.read_text(encoding="utf-8"))

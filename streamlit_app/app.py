"""THE STYLE HUB — ứng dụng Streamlit trình diễn hệ gợi ý sản phẩm thời trang.

Chạy (từ thư mục gốc của dự án):
    pip install -r streamlit_app/requirements.txt
    streamlit run streamlit_app/app.py

Ứng dụng dùng CHÍNH bộ máy gợi ý của website (recommender/engine.js) thông qua
streamlit_app/bridge.js, nên gợi ý, lời giải thích và số liệu khớp với website và
với báo cáo thực nghiệm (docs/KET_QUA_THUC_NGHIEM.md).
"""
from __future__ import annotations

import html
import json
import os
from datetime import datetime, timezone

import altair as alt
import pandas as pd
import streamlit as st

import engine_bridge as bridge

st.set_page_config(page_title="THE STYLE HUB · Hệ gợi ý", page_icon="🛍️", layout="wide")

# ---------------------------------------------------------------------------
# Hằng số hiển thị
# ---------------------------------------------------------------------------
# Thành phần của mô hình lai — màu cố định theo thành phần (bảng màu phân loại đã kiểm định
# khả năng phân biệt cho người mù màu, dùng đúng thứ tự). Màu đi theo thành phần, không theo hạng.
COMPONENTS = [
    ("ucf", "Khách hàng có gu tương tự (UserKNN)", "#2a78d6"),
    ("mf", "Sở thích ẩn (BPR)", "#eb6834"),
    ("icf", "Thường được mua cùng (ItemKNN)", "#1baf7a"),
    ("cb", "Thuộc tính sản phẩm (TF-IDF)", "#eda100"),
    ("pop", "Xu hướng mua sắm", "#e87ba4"),
    ("ctx", "Giống sản phẩm đang xem", "#008300"),
    ("session", "Phiên xem gần đây", "#6250d6"),
]
COMPONENT_LABEL = {key: label for key, label, _ in COMPONENTS}
ACCENT = "#2a78d6"
ACCENT_SOFT = "#86b6ef"
EVENT_LABELS = {"view": "Xem", "cart": "Thêm vào giỏ", "wishlist": "Yêu thích", "purchase": "Mua", "rating": "Đánh giá", "review": "Đánh giá"}
GENDER_CHOICES = {"men": "Nam", "women": "Nữ", "kids": "Trẻ em"}
DEFAULT_SITE = os.environ.get("STYLEHUB_SITE_URL", "")

CSS = """
<style>
.sh-hero h1 {font-size: 2.1rem; letter-spacing: .02em; margin-bottom: .2rem;}
.sh-eyebrow {font-size: .75rem; letter-spacing: .18em; text-transform: uppercase; color: #8a7a66; margin-bottom: .35rem;}
.sh-lede {color: #4a4640; max-width: 62rem; line-height: 1.55;}
.sh-grid {display: grid; grid-template-columns: repeat(auto-fill, minmax(178px, 1fr)); gap: 18px; margin: .5rem 0 1rem;}
.sh-card {background: #fff; border: 1px solid #e7e1d8; border-radius: 6px; overflow: hidden; position: relative;}
.sh-card .sh-img {width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block; background: #efeae2;}
.sh-card .sh-body {padding: 10px 12px 12px;}
.sh-rank {position: absolute; top: 8px; left: 8px; background: #111; color: #fff; font-size: 11px; font-weight: 700;
          border-radius: 999px; padding: 2px 8px; letter-spacing: .04em;}
.sh-brand {font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: #8a7a66;}
.sh-name {font-size: 14px; font-weight: 600; line-height: 1.3; margin: 3px 0 4px; color: #111;}
.sh-name a {color: #111; text-decoration: none;} .sh-name a:hover {text-decoration: underline;}
.sh-price {font-size: 13px; color: #2b2925;}
.sh-reason {font-size: 12px; color: #5c5750; margin-top: 7px; line-height: 1.4; border-top: 1px dashed #e7e1d8; padding-top: 7px;}
.sh-chips {display: flex; flex-wrap: wrap; gap: 6px; margin: .25rem 0 .75rem;}
.sh-chip {background: #f1ede6; border: 1px solid #e2dbcf; border-radius: 999px; padding: 3px 10px; font-size: 12.5px; color: #2b2925;}
.sh-note {font-size: .85rem; color: #6b665e;}
</style>
"""
st.markdown(CSS, unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Tiện ích
# ---------------------------------------------------------------------------
def show_chart(chart: alt.Chart) -> None:
    try:
        st.altair_chart(chart, width="stretch")
    except TypeError:  # Streamlit < 1.46
        st.altair_chart(chart, use_container_width=True)


def show_table(df: pd.DataFrame, full: bool = False, **kwargs) -> None:
    if full:  # hiện đủ mọi hàng, không cần cuộn trong bảng
        kwargs["height"] = 38 + 35 * len(df)
    try:
        st.dataframe(df, width="stretch", hide_index=True, **kwargs)
    except TypeError:  # Streamlit < 1.46
        st.dataframe(df, use_container_width=True, hide_index=True, **kwargs)


def fmt_vnd(value: float) -> str:
    return f"{int(round(value)):,}".replace(",", ".") + " ₫"


def fmt_time(ms: float) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%d/%m/%Y %H:%M")


def product_url(product_id: str) -> str | None:
    base = (st.session_state.get("site_url") or "").strip().rstrip("/")
    return f"{base}/product-detail.html?id={product_id}" if base else None


def card_html(product: dict, reason: str | None = None, rank: int | None = None) -> str:
    esc = html.escape
    url = product_url(product["id"])
    name = esc(product["name"])
    name_html = f'<a href="{esc(url)}" target="_blank" rel="noopener">{name}</a>' if url else name
    parts = ['<div class="sh-card">']
    if rank is not None:
        parts.append(f'<span class="sh-rank">#{rank}</span>')
    parts.append(f'<img class="sh-img" src="{esc(product.get("image") or "")}" alt="{name}" loading="lazy">')
    parts.append('<div class="sh-body">')
    parts.append(f'<div class="sh-brand">{esc(product.get("brand") or "")}</div>')
    parts.append(f'<div class="sh-name">{name_html}</div>')
    parts.append(f'<div class="sh-price">{esc(product.get("price") or "")}</div>')
    if reason:
        parts.append(f'<div class="sh-reason">{esc(reason)}</div>')
    parts.append("</div></div>")
    return "".join(parts)


def render_cards(items: list[dict], catalog: dict[str, dict], numbered: bool = True) -> None:
    cards = []
    for i, item in enumerate(items, start=1):
        product = catalog.get(item["id"])
        if product:
            cards.append(card_html(product, item.get("reason"), i if numbered else None))
    if cards:
        st.markdown('<div class="sh-grid">' + "".join(cards) + "</div>", unsafe_allow_html=True)
    else:
        st.info("Chưa có gợi ý phù hợp.")


def chips(values: list[str]) -> None:
    if values:
        st.markdown('<div class="sh-chips">' + "".join(f'<span class="sh-chip">{html.escape(v)}</span>' for v in values) + "</div>",
                    unsafe_allow_html=True)


def contribution_chart(recs: list[dict], catalog: dict[str, dict]) -> None:
    """Tỷ trọng đóng góp của từng thuật toán vào điểm của mỗi sản phẩm được gợi ý."""
    rows = []
    for rank, rec in enumerate(recs, start=1):
        product = catalog.get(rec["id"], {"name": rec["id"]})
        label = f"#{rank} {product['name'][:38]}"
        for key, share in (rec.get("shares") or {}).items():
            if share > 0 and key in COMPONENT_LABEL:
                rows.append({"Sản phẩm": label, "Thứ hạng": rank, "Thành phần": COMPONENT_LABEL[key], "Tỷ trọng (%)": share})
    if not rows:
        st.caption("Danh sách này là gợi ý khám phá (chưa có tín hiệu cá nhân), nên không có phần đóng góp theo thuật toán.")
        return
    df = pd.DataFrame(rows)
    present = [label for _, label, _ in COMPONENTS if label in set(df["Thành phần"])]
    colors = [color for _, label, color in COMPONENTS if label in present]
    order = df.drop_duplicates("Sản phẩm").sort_values("Thứ hạng")["Sản phẩm"].tolist()
    chart = (
        alt.Chart(df)
        .mark_bar(stroke="#ffffff", strokeWidth=2, height={"band": 0.62})
        .encode(
            x=alt.X("Tỷ trọng (%):Q", stack="zero", scale=alt.Scale(domain=[0, 100]), title="Tỷ trọng đóng góp vào điểm gợi ý (%)"),
            y=alt.Y("Sản phẩm:N", sort=order, title=None),
            color=alt.Color("Thành phần:N", scale=alt.Scale(domain=present, range=colors),
                            legend=alt.Legend(orient="right", title="Thành phần", labelLimit=280)),
            order=alt.Order("Thành phần:N"),
            tooltip=["Sản phẩm", "Thành phần", "Tỷ trọng (%)"],
        )
        .properties(height=max(200, 44 * len(order)))
        .configure_axis(grid=False, labelColor="#2b2925", titleColor="#52514e", domainColor="#c9c2b6", labelLimit=300)
        .configure_view(stroke=None)
    )
    show_chart(chart)
    with st.expander("Xem dạng bảng"):
        show_table(df.pivot_table(index=["Thứ hạng", "Sản phẩm"], columns="Thành phần", values="Tỷ trọng (%)", fill_value=0).reset_index(), full=True)


# ---------------------------------------------------------------------------
# Gọi hệ gợi ý (có bộ nhớ đệm — tính toán tất định nên kết quả không đổi giữa các lần gọi)
# ---------------------------------------------------------------------------
@st.cache_data(show_spinner=False, ttl=900)
def bootstrap(source_json: str) -> dict:
    return bridge.call({"cmd": "bootstrap", "source": json.loads(source_json)})


@st.cache_data(show_spinner=False, ttl=900)
def user_view(source_json: str, user_id: str, limit: int) -> dict:
    return bridge.call({"cmd": "user", "source": json.loads(source_json), "userId": user_id, "limit": limit})


@st.cache_data(show_spinner=False, ttl=900)
def quiz_view(source_json: str, quiz_json: str, limit: int) -> dict:
    return bridge.call({"cmd": "quiz", "source": json.loads(source_json), "quiz": json.loads(quiz_json), "limit": limit})


@st.cache_data(show_spinner=False, ttl=900)
def product_view(source_json: str, product_id: str, limit: int, user_id: str | None) -> dict:
    return bridge.call({"cmd": "product", "source": json.loads(source_json), "productId": product_id, "limit": limit, "userId": user_id})


@st.cache_data(show_spinner=False, ttl=900)
def sentiment_view(text: str, stars: int) -> dict:
    return bridge.call({"cmd": "sentiment", "text": text, "stars": stars})


@st.cache_data(show_spinner=False, ttl=300)
def evaluation() -> dict | None:
    return bridge.load_evaluation()


# ---------------------------------------------------------------------------
# Thanh bên: nguồn dữ liệu
# ---------------------------------------------------------------------------
def sidebar_source() -> str:
    with st.sidebar:
        st.markdown("### Nguồn dữ liệu")
        kind = st.radio(
            "Hành vi khách hàng dùng để gợi ý",
            ["sim", "server"],
            format_func=lambda k: "Mô phỏng (mặc định)" if k == "sim" else "Máy chủ của website (server/data)",
            key="source_kind",
        )
        if kind == "sim":
            users = st.slider("Số khách hàng mô phỏng", 100, 600, 300, step=50)
            seed = st.number_input("Seed (giữ nguyên để tái lập kết quả)", min_value=1, max_value=9999, value=7, step=1)
            source = {"kind": "sim", "users": int(users), "seed": int(seed)}
        else:
            source = {"kind": "server"}
            st.caption("Đọc hành vi thật mà backend (npm start) đã ghi nhận trong server/data.")
        st.text_input("Địa chỉ website (để mở trang sản phẩm)", value=DEFAULT_SITE, key="site_url",
                      placeholder="vd: http://localhost:3000")
        st.divider()
        st.caption("Ứng dụng Python (Streamlit) gọi cùng bộ máy gợi ý với website: "
                   "streamlit_app/bridge.js → recommender/engine.js.")
    return json.dumps(source, sort_keys=True)


SOURCE = sidebar_source()


def load_boot() -> dict | None:
    try:
        with st.spinner("Đang khởi tạo mô hình gợi ý…"):
            return bootstrap(SOURCE)
    except bridge.BridgeError as error:
        st.error(str(error))
        return None


def catalog_of(boot: dict) -> dict[str, dict]:
    return {p["id"]: p for p in boot["catalog"]}


# ---------------------------------------------------------------------------
# Trang 1 — Tổng quan
# ---------------------------------------------------------------------------
def page_overview() -> None:
    st.markdown('<div class="sh-hero"><div class="sh-eyebrow">Khóa luận · Hệ gợi ý sản phẩm thời trang trực tuyến</div>'
                "<h1>THE STYLE HUB — Hệ gợi ý lai</h1></div>", unsafe_allow_html=True)
    st.markdown('<p class="sh-lede">Ứng dụng Streamlit trình diễn hệ gợi ý dựa trên <b>hành vi mua sắm</b> (xem, thêm giỏ, '
                "yêu thích, mua), <b>đánh giá</b> (số sao kết hợp cảm xúc bình luận tiếng Việt) và <b>sự tương đồng sở thích "
                "giữa người dùng</b>. Mọi gợi ý được tính bằng chính bộ máy của website.</p>", unsafe_allow_html=True)
    boot = load_boot()
    if not boot:
        return
    stats, source = boot["stats"], boot["source"]
    cols = st.columns(5)
    cols[0].metric("Sản phẩm", f"{stats['items']}")
    cols[1].metric("Khách hàng", f"{stats['users']}")
    cols[2].metric("Cặp khách – sản phẩm", f"{stats['interactions']:,}".replace(",", "."))
    cols[3].metric("Độ thưa ma trận", f"{stats['sparsity'] * 100:.1f}%".replace(".", ","))
    cols[4].metric("Sự kiện hành vi", f"{boot['events']:,}".replace(",", "."))
    if source["kind"] == "sim":
        st.caption(f"{source['label']}: {source['users']} khách hàng, {source['days']} ngày, seed {source['seed']} "
                   f"(sinh bởi evaluation/simulate.js).")
    else:
        st.caption(f"{source['label']} ({source['file']}) · {boot['events']} sự kiện · {stats['users']} khách hàng, "
                   f"trong đó {source['demoUsers']} tài khoản demo (npm run seed:demo)")

    st.subheader("Mô hình lai gồm những thành phần nào?")
    weights = boot["weights"]
    descriptions = {
        "ucf": "Tìm khách hàng có lịch sử giống bạn (cosine, có trọng số ý nghĩa), gợi ý món họ mua/đánh giá cao.",
        "mf": "Phân rã ma trận BPR học sở thích ẩn từ phản hồi ngầm (16 nhân tố).",
        "icf": "Sản phẩm thường được cùng một nhóm khách mua/xem (cosine có co rút).",
        "cb": "So khớp thuộc tính: loại, màu, phong cách, chất liệu, giá (TF-IDF).",
        "pop": "Độ phổ biến gần đây, đã loại phần đóng góp của chính bạn.",
        "ctx": "Độ giống với sản phẩm đang xem (chỉ trên trang sản phẩm).",
        "session": "Các sản phẩm bạn vừa xem trong phiên hiện tại.",
    }
    fmt = lambda v: f"{v:.2f}".replace(".", ",")
    rows = [{"Thành phần": label, "Ý nghĩa": descriptions[key], "Trang chủ": fmt(weights["home"].get(key, 0)),
             "Khách mới": fmt(weights["cold"].get(key, 0)), "Trang sản phẩm": fmt(weights["product"].get(key, 0))}
            for key, label, _ in COMPONENTS]
    st.table(pd.DataFrame(rows).set_index("Thành phần"))
    st.caption("Ba cột cuối là trọng số của từng thành phần trong từng ngữ cảnh. Trọng số được tinh chỉnh bằng grid search trên tập validation, rồi tự điều chỉnh theo lượng dữ liệu của từng khách "
               "(khách ít tương tác dựa nhiều hơn vào thuộc tính và xu hướng). Kết quả lọc đa dạng bằng MMR (λ = 0,8).")

    catalog = pd.DataFrame(boot["catalog"])
    left, right = st.columns(2)
    with left:
        st.markdown("**Số sản phẩm theo ngành hàng**")
        dept = catalog.groupby("departmentLabel").size().reset_index(name="Số sản phẩm").rename(columns={"departmentLabel": "Ngành hàng"})
        show_chart(
            alt.Chart(dept).mark_bar(color=ACCENT, cornerRadiusEnd=4, height={"band": 0.6})
            .encode(x=alt.X("Số sản phẩm:Q"), y=alt.Y("Ngành hàng:N", sort="-x", title=None), tooltip=["Ngành hàng", "Số sản phẩm"])
            .properties(height=220).configure_axis(grid=False).configure_view(stroke=None)
        )
    with right:
        st.markdown("**Số sản phẩm theo khoảng giá**")
        tier_labels = boot["labels"]["price"]
        tiers = catalog.groupby("priceTier").size().reindex(boot["priceTiers"], fill_value=0).reset_index(name="Số sản phẩm")
        tiers["Khoảng giá"] = tiers["priceTier"].map(lambda t: tier_labels.get(t, t).replace("giá ", "").capitalize())
        show_chart(
            alt.Chart(tiers).mark_bar(color=ACCENT, cornerRadiusEnd=4, height={"band": 0.6})
            .encode(x=alt.X("Số sản phẩm:Q"), y=alt.Y("Khoảng giá:N", sort=tiers["Khoảng giá"].tolist(), title=None),
                    tooltip=["Khoảng giá", "Số sản phẩm"])
            .properties(height=220).configure_axis(grid=False).configure_view(stroke=None)
        )
    st.caption("Khoảng giá: bình dân < 1,5 triệu · tầm trung < 4 triệu · cao cấp < 8 triệu · xa xỉ từ 8 triệu.")


# ---------------------------------------------------------------------------
# Trang 2 — Gợi ý cá nhân hóa
# ---------------------------------------------------------------------------
def describe_user(user: dict) -> str:
    counts = user.get("counts") or {}
    gender = GENDER_CHOICES.get(user.get("gender"), "")
    bits = [user["id"] + (" (demo)" if user.get("demo") else "")]
    if gender:
        bits.append(gender)
    bits.append(f"{counts.get('view', 0)} lượt xem")
    bits.append(f"{counts.get('purchase', 0)} lần mua")
    if counts.get("rating"):
        bits.append(f"{counts['rating']} đánh giá")
    return " · ".join(bits)


def render_dna(dna: dict) -> None:
    if not dna:
        return
    st.markdown(f"**Hồ sơ phong cách (Style DNA):** {html.escape(dna.get('persona') or 'Chưa đủ dữ liệu')}")
    values = [f"{x['label']} {x['share']}%" for group in ("styles", "colors", "types", "prices") for x in dna.get(group, [])[:2]]
    chips(values)


def page_personal() -> None:
    st.title("Gợi ý cho từng khách hàng")
    st.markdown('<p class="sh-lede">Chọn một khách hàng để xem lịch sử hành vi và danh sách gợi ý trang chủ dành riêng cho họ, '
                "kèm lời giải thích và mức đóng góp của từng thuật toán.</p>", unsafe_allow_html=True)
    boot = load_boot()
    if not boot:
        return
    catalog = catalog_of(boot)
    users = sorted(boot["users"], key=lambda u: (-(u.get("counts") or {}).get("purchase", 0), -(u.get("counts") or {}).get("view", 0), u["id"]))
    if not users:
        st.info("Nguồn dữ liệu chưa có khách hàng nào.")
        return
    c1, c2 = st.columns([3, 1])
    user_id = c1.selectbox("Khách hàng (sắp theo mức độ mua sắm)", [u["id"] for u in users],
                           format_func=lambda uid: describe_user(next(u for u in users if u["id"] == uid)))
    limit = c2.slider("Số gợi ý", 4, 16, 8, step=4)
    try:
        with st.spinner("Đang tính gợi ý…"):
            view = user_view(SOURCE, user_id, limit)
    except bridge.BridgeError as error:
        st.error(str(error))
        return
    user = next(u for u in users if u["id"] == user_id)
    if user.get("quiz"):
        quiz = user["quiz"]
        labels = boot["labels"]
        st.caption("Câu trả lời quiz Style DNA của khách (mô phỏng): "
                   + ", ".join([GENDER_CHOICES.get(quiz.get("gender"), "")]
                               + [labels["style"].get(s, s) for s in quiz.get("styles", [])]
                               + [labels["color"].get(c, c) for c in quiz.get("colors", [])]))
    render_dna(view["dna"])

    st.subheader("Gợi ý dành riêng cho khách hàng này")
    render_cards(view["recommendations"], catalog)
    st.subheader("Vì sao có những gợi ý này?")
    contribution_chart(view["recommendations"], catalog)

    tab_history, tab_neighbors = st.tabs(["Lịch sử hành vi gần đây", "Khách hàng có gu tương tự"])
    with tab_history:
        rows = []
        for e in view["history"]:
            product = catalog.get(e["item"], {})
            detail = ""
            if e["type"] in ("rating", "review") and e.get("value") is not None:
                detail = "★" * int(e["value"]) + ("  " + e["text"] if e.get("text") else "")
            rows.append({"Ảnh": product.get("image", ""), "Sản phẩm": product.get("name", e["item"]),
                         "Hành vi": EVENT_LABELS.get(e["type"], e["type"]), "Chi tiết": detail, "Thời gian": fmt_time(e["ts"])})
        if rows:
            show_table(pd.DataFrame(rows), column_config={"Ảnh": st.column_config.ImageColumn(width="small"),
                                                          "Chi tiết": st.column_config.TextColumn(width="large")})
        else:
            st.info("Khách hàng chưa có hành vi nào.")
    with tab_neighbors:
        if view["neighbors"]:
            df = pd.DataFrame(view["neighbors"]).rename(columns={"user": "Khách hàng", "sim": "Độ tương đồng (cosine)", "common": "Sản phẩm chung"})
            show_table(df, column_config={"Độ tương đồng (cosine)": st.column_config.ProgressColumn(min_value=0.0, max_value=1.0, format="%.3f")})
            st.caption("UserKNN: cosine trên điểm hành vi đã nén log, nhân trọng số ý nghĩa min(số sản phẩm chung, 4) / 4.")
        else:
            st.info("Chưa tìm được khách hàng tương tự (khách còn ít dữ liệu).")


# ---------------------------------------------------------------------------
# Trang 3 — Khách hàng mới (cold-start + quiz Style DNA)
# ---------------------------------------------------------------------------
def page_quiz() -> None:
    st.title("Khách hàng mới — quiz Style DNA")
    st.markdown('<p class="sh-lede">Khách chưa có lịch sử mua sắm (bài toán <b>khởi đầu lạnh — cold-start</b>). '
                "Hệ thống dùng câu trả lời quiz và bộ trọng số riêng cho khách mới (dựa nhiều hơn vào thuộc tính và xu hướng), "
                "đồng thời giới hạn mềm theo giới tính.</p>", unsafe_allow_html=True)
    boot = load_boot()
    if not boot:
        return
    labels, catalog = boot["labels"], catalog_of(boot)
    with st.form("quiz"):
        c1, c2 = st.columns(2)
        gender = c1.radio("Bạn mua cho", list(GENDER_CHOICES), format_func=GENDER_CHOICES.get, horizontal=True)
        budget = c2.selectbox("Ngân sách", boot["priceTiers"], index=1, format_func=lambda t: labels["price"][t].capitalize())
        styles = st.multiselect("Phong cách yêu thích (tối đa 3)", list(labels["style"]), default=["minimal", "casual"],
                                format_func=lambda s: labels["style"][s].capitalize(), max_selections=3)
        colors = st.multiselect("Màu sắc yêu thích (tối đa 3)", list(labels["color"]), default=["black", "beige"],
                                format_func=lambda c: labels["color"][c].replace("màu ", "").capitalize(), max_selections=3)
        types = st.multiselect("Loại sản phẩm quan tâm (không bắt buộc)", list(labels["type"]), placeholder="Chọn loại sản phẩm",
                               format_func=lambda t: labels["type"][t].capitalize(), max_selections=3)
        limit = st.slider("Số gợi ý", 4, 16, 8, step=4)
        st.form_submit_button("Xem gợi ý", type="primary")
    quiz = {"gender": gender, "styles": styles, "colors": colors, "types": types, "budget": budget}
    try:
        with st.spinner("Đang tính gợi ý…"):
            view = quiz_view(SOURCE, json.dumps(quiz, sort_keys=True), limit)
    except bridge.BridgeError as error:
        st.error(str(error))
        return
    render_dna(view["dna"])
    st.subheader("Gợi ý cho khách hàng mới")
    render_cards(view["recommendations"], catalog)
    st.subheader("Vì sao có những gợi ý này?")
    contribution_chart(view["recommendations"], catalog)


# ---------------------------------------------------------------------------
# Trang 4 — Sản phẩm tương tự & phối đồ
# ---------------------------------------------------------------------------
def page_product() -> None:
    st.title("Sản phẩm tương tự & gợi ý phối đồ")
    st.markdown('<p class="sh-lede">Gợi ý trên trang chi tiết sản phẩm: kết hợp độ giống với sản phẩm đang xem và sở thích của '
                "khách; phần phối đồ chọn quần/giày/áo hợp màu, hợp phong cách và cùng tầm giá.</p>", unsafe_allow_html=True)
    boot = load_boot()
    if not boot:
        return
    catalog = catalog_of(boot)
    products = boot["catalog"]
    departments = sorted({p["departmentLabel"] for p in products})
    c1, c2, c3 = st.columns([1, 2, 1.4])
    dept = c1.selectbox("Ngành hàng", departments, index=departments.index("Nam") if "Nam" in departments else 0)
    options = [p["id"] for p in products if p["departmentLabel"] == dept]
    product_id = c2.selectbox("Sản phẩm", options, format_func=lambda pid: f"{catalog[pid]['name']} — {catalog[pid]['price']}")
    viewer_options = [""] + [u["id"] for u in boot["users"]]
    viewer = c3.selectbox("Người đang xem", viewer_options, format_func=lambda u: "Khách vãng lai" if not u else u)
    try:
        with st.spinner("Đang tính gợi ý…"):
            view = product_view(SOURCE, product_id, 8, viewer or None)
    except bridge.BridgeError as error:
        st.error(str(error))
        return
    product = catalog[product_id]
    left, right = st.columns([1, 3])
    with left:
        st.markdown('<div class="sh-grid" style="grid-template-columns:1fr">' + card_html(product) + "</div>", unsafe_allow_html=True)
    with right:
        labels = boot["labels"]
        st.markdown("**Thuộc tính dùng cho gợi ý nội dung**")
        chips([labels["type"].get(product["type"], product["type"] or ""), labels["gender"].get(product["gender"], "")]
              + [labels["color"].get(c, c) for c in product["colors"]]
              + ["phong cách " + labels["style"].get(s, s) for s in product["styles"]]
              + [labels["price"].get(product["priceTier"], "")])
        tab_similar, tab_outfit = st.tabs(["Có thể bạn cũng thích", "Hoàn thiện set đồ"])
        with tab_similar:
            render_cards(view["similar"], catalog)
        with tab_outfit:
            groups = {"top": "Áo phối cùng", "bottom": "Quần phối cùng", "footwear": "Giày phối cùng", "outerwear": "Áo khoác phối cùng"}
            if not view["outfit"]:
                st.info("Chưa có gợi ý phối đồ cho sản phẩm này.")
            for category in groups:
                items = [o for o in view["outfit"] if o["category"] == category]
                if items:
                    st.markdown(f"**{groups[category]}**")
                    render_cards(items, catalog, numbered=False)


# ---------------------------------------------------------------------------
# Trang 5 — Kết quả thực nghiệm
# ---------------------------------------------------------------------------
METRICS = [("p5", "P@5"), ("r5", "R@5"), ("n5", "NDCG@5"), ("p10", "P@10"), ("r10", "R@10"), ("n10", "NDCG@10"),
           ("hr10", "HR@10"), ("mrr10", "MRR@10"), ("coverage10", "Độ phủ@10"), ("ild10", "Đa dạng ILD@10"), ("nov10", "Mới lạ@10")]


def metric_table(results: dict) -> pd.DataFrame:
    rows = []
    for name, values in results.items():
        row = {"Thuật toán": name}
        for key, label in METRICS:
            if key in values:
                row[label] = values[key]["mean"]
        rows.append(row)
    return pd.DataFrame(rows)


def page_evaluation() -> None:
    st.title("Kết quả thực nghiệm offline")
    R = evaluation()
    if not R:
        st.warning("Chưa có kết quả. Chạy `npm run evaluate` để sinh evaluation/results/latest.json.")
        return
    cfg = R["config"]
    st.markdown(f'<p class="sh-lede">Dữ liệu <b>{"mô phỏng" if R["dataKind"] == "simulated" else "thật"}</b>: {cfg["users"]} người dùng × '
                f'{cfg["items"]} sản phẩm thật, {cfg["seeds"]} seed. Tách dữ liệu theo thời gian (huấn luyện trước ngày 105, đánh giá '
                f'ngày 105–120); số liệu là trung bình ± độ lệch chuẩn qua các seed. Nguồn: <code>evaluation/results/latest.json</code> '
                f'(sinh lúc {html.escape(R["generatedAt"][:16].replace("T", " "))} UTC).</p>', unsafe_allow_html=True)
    main = R["main"]
    hybrid, legacy, ucf = main["Hybrid v2 (tinh chỉnh)"], main["Thuật toán cũ (v1)"], main["User-based CF (k-NN)"]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("NDCG@10 — Hybrid tinh chỉnh", f"{hybrid['n10']['mean']:.3f}",
              f"{(hybrid['n10']['mean'] / legacy['n10']['mean'] - 1) * 100:+.0f}% so với thuật toán cũ")
    c2.metric("NDCG@10 — thuật toán cũ (v1)", f"{legacy['n10']['mean']:.3f}")
    c3.metric("HR@10 — Hybrid", f"{hybrid['hr10']['mean']:.3f}")
    c4.metric("Độ phủ danh mục @10", f"{hybrid['coverage10']['mean'] * 100:.0f}%")

    st.subheader("NDCG@10 theo thuật toán")
    df = pd.DataFrame([{"Thuật toán": name, "NDCG@10": v["n10"]["mean"], "Thấp": v["n10"]["mean"] - v["n10"]["std"],
                        "Cao": v["n10"]["mean"] + v["n10"]["std"], "Độ lệch chuẩn": v["n10"]["std"],
                        "Nhóm": "Mô hình đề xuất" if name == "Hybrid v2 (tinh chỉnh)" else "So sánh"} for name, v in main.items()])
    order = df.sort_values("NDCG@10", ascending=False)["Thuật toán"].tolist()
    base = alt.Chart(df).encode(y=alt.Y("Thuật toán:N", sort=order, title=None))
    bars = base.mark_bar(cornerRadiusEnd=4, height={"band": 0.62}).encode(
        x=alt.X("NDCG@10:Q", title="NDCG@10 (trung bình 3 seed)"),
        color=alt.Color("Nhóm:N", scale=alt.Scale(domain=["Mô hình đề xuất", "So sánh"], range=[ACCENT, ACCENT_SOFT]),
                        legend=alt.Legend(orient="bottom", title=None)),
        tooltip=["Thuật toán", alt.Tooltip("NDCG@10:Q", format=".3f"), alt.Tooltip("Độ lệch chuẩn:Q", format=".3f")])
    errors = base.mark_rule(color="#52514e", strokeWidth=1.5).encode(x="Thấp:Q", x2="Cao:Q")
    show_chart((bars + errors).properties(height=380).configure_axis(grid=False, labelLimit=320).configure_view(stroke=None))
    st.caption("Vạch ngang trên mỗi cột là ± 1 độ lệch chuẩn giữa các seed.")

    st.subheader("Bảng đầy đủ các độ đo")
    table = metric_table(main)
    show_table(table, full=True, column_config={label: st.column_config.NumberColumn(format="%.3f") for _, label in METRICS})

    st.subheader("Kiểm định ý nghĩa thống kê (hoán vị ghép cặp)")
    sig = pd.DataFrame([{"So sánh": s["label"], "Chênh lệch NDCG@10": s["meanDiff"], "p-value": s["pValue"],
                         "Kết luận": "Có ý nghĩa (p < 0,05)" if s["pValue"] < 0.05 else "Chưa đủ khác biệt"} for s in R["significance"]])
    show_table(sig, column_config={"Chênh lệch NDCG@10": st.column_config.NumberColumn(format="%+.4f"),
                                   "p-value": st.column_config.NumberColumn(format="%.4f")})

    st.subheader("Khách hàng mới (cold-start, ≤ 2 lượt tương tác tích cực)")
    show_table(metric_table(R["coldStart"]["results"])[["Thuật toán", "P@5", "NDCG@5", "R@10", "NDCG@10", "HR@10"]], full=True,
               column_config={k: st.column_config.NumberColumn(format="%.3f") for k in ["P@5", "NDCG@5", "R@10", "NDCG@10", "HR@10"]})

    left, right = st.columns(2)
    with left:
        st.markdown("**Trọng số sau tinh chỉnh**")
        w = pd.DataFrame([{"Thành phần": COMPONENT_LABEL.get(k, k), "Khách quen": R["defaultWeights"].get(k, 0),
                           "Khách mới": R["coldWeights"].get(k, 0)} for k in ["ucf", "mf", "icf", "cb", "pop", "session"]])
        show_table(w, full=True, column_config={"Khách quen": st.column_config.NumberColumn(format="%.2f"),
                                     "Khách mới": st.column_config.NumberColumn(format="%.2f")})
    with right:
        st.markdown(f"**Đánh đổi chính xác – đa dạng của MMR (chọn λ = {R['lambda']['chosen']})**")
        lam = pd.DataFrame(R["lambda"]["rows"]).rename(columns={"lambda": "λ", "ndcg10": "NDCG@10 (validation)", "ild10": "Đa dạng ILD@10", "coverage10": "Độ phủ@10"})
        show_table(lam, full=True, column_config={c: st.column_config.NumberColumn(format="%.3f") for c in lam.columns if c != "λ"})

    st.markdown("**Tác dụng của phân tích cảm xúc bình luận**")
    show_table(pd.DataFrame([{"Cấu hình": s["label"], "NDCG@10": s["n10"], "R@10": s["r10"]} for s in R["sentiment"]]),
               column_config={"NDCG@10": st.column_config.NumberColumn(format="%.4f"), "R@10": st.column_config.NumberColumn(format="%.4f")})
    st.caption(f"Độ chính xác của bộ phân tích cảm xúc trên tập kiểm tra riêng: {R['sentimentHeldout'] * 100:.1f}%. "
               "Dữ liệu là mô phỏng: kết quả chứng minh cài đặt đúng và so sánh tương đối giữa các thuật toán; "
               "cần đánh giá lại khi có dữ liệu khách hàng thật (`npm run evaluate -- --data=server`).")


# ---------------------------------------------------------------------------
# Trang 6 — Phân tích cảm xúc bình luận
# ---------------------------------------------------------------------------
EXAMPLES = ["Áo đẹp, vải mềm, mặc rất thoải mái", "Vải hơi mỏng, form không đẹp như hình", "Áo đẹp nhưng giao hàng chậm quá",
            "Không đẹp lắm, tạm được so với giá"]


def page_sentiment() -> None:
    st.title("Phân tích cảm xúc bình luận tiếng Việt")
    st.markdown('<p class="sh-lede">Bình luận được chấm điểm cảm xúc bằng từ điển tiếng Việt (có xử lý phủ định, từ nhấn mạnh và câu '
                "“… nhưng …”). Điểm này được trộn với số sao để ra <b>điểm đánh giá hiệu dụng</b> mà hệ gợi ý sử dụng: "
                "r<sub>eff</sub> = 0,7 × số sao + 0,3 × (3 + 2 × cảm xúc).</p>", unsafe_allow_html=True)
    example = st.selectbox("Chọn câu mẫu hoặc tự nhập bên dưới", ["(tự nhập)"] + EXAMPLES)
    text = st.text_area("Nội dung bình luận", value="" if example == "(tự nhập)" else example, height=90)
    stars = st.slider("Số sao khách chấm", 1, 5, 4)
    if not text.strip():
        st.info("Nhập một bình luận để phân tích.")
        return
    try:
        result = sentiment_view(text.strip(), stars)
    except bridge.BridgeError as error:
        st.error(str(error))
        return
    c1, c2, c3 = st.columns(3)
    c1.metric("Điểm cảm xúc (−1 → 1)", f"{result['score']:+.3f}")
    c2.metric("Nhận định", result["labelVi"])
    c3.metric("Điểm đánh giá hiệu dụng", f"{result['effective']:.2f} / 5", f"{result['effective'] - stars:+.2f} so với số sao")
    if result["matches"]:
        show_table(pd.DataFrame([{"Từ / cụm từ": m["phrase"], "Giá trị": m["value"], "Bị phủ định": "Có" if m.get("negated") else ""}
                                 for m in result["matches"]]))
    else:
        st.caption("Không tìm thấy từ mang cảm xúc trong từ điển — điểm cảm xúc bằng 0.")


# ---------------------------------------------------------------------------
# Điều hướng
# ---------------------------------------------------------------------------
pages = [
    st.Page(page_overview, title="Tổng quan", icon=":material/dashboard:", default=True),
    st.Page(page_personal, title="Gợi ý cho khách hàng", icon=":material/person_search:", url_path="goi-y-ca-nhan"),
    st.Page(page_quiz, title="Khách hàng mới (Style DNA)", icon=":material/quiz:", url_path="khach-hang-moi"),
    st.Page(page_product, title="Sản phẩm tương tự & phối đồ", icon=":material/checkroom:", url_path="san-pham-tuong-tu"),
    st.Page(page_evaluation, title="Kết quả thực nghiệm", icon=":material/monitoring:", url_path="thuc-nghiem"),
    st.Page(page_sentiment, title="Phân tích cảm xúc", icon=":material/reviews:", url_path="cam-xuc"),
]
st.navigation(pages).run()

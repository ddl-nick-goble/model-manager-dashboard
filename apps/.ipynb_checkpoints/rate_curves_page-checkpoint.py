import streamlit as st
import pandas as pd
import altair as alt
import calendar
from domino.data_sources import DataSourceClient
from datetime import date, datetime

# ─── Data access ────────────────────────────────────────────────────────────
ds = DataSourceClient().get_datasource("market_data")

@st.cache_data(ttl=120)
def get_available_dates() -> list[date]:
    df = ds.query("""
        SELECT DISTINCT curve_date
          FROM rate_curves
         ORDER BY curve_date
    """).to_pandas()
    df["curve_date"] = pd.to_datetime(df["curve_date"])
    return df["curve_date"].dt.date.tolist()

@st.cache_data
def load_curve_for_date(selected_date: date) -> pd.DataFrame:
    sql = f"""
    SELECT tenor_num, rate
      FROM rate_curves
     WHERE curve_date = '{selected_date}'
     ORDER BY tenor_num;
    """
    return ds.query(sql).to_pandas()

# ─── Callbacks to modify session_state ────────────────────────────────────────
def on_date_change():
    new = st.session_state.selected_date
    if new not in st.session_state.selected_dates:
        st.session_state.selected_dates.append(new)

def remove_pills():
    selected = st.session_state.pills_selected
    if "Clear all" in selected:
        st.session_state.selected_dates = []
    else:
        for s in selected:
            d = datetime.strptime(s, "%Y/%m/%d").date()
            if d in st.session_state.selected_dates:
                st.session_state.selected_dates.remove(d)
    st.session_state.pills_selected = []

# ─── Helper to pick closest earlier date ──────────────────────────────────────
def closest_before(target: date, all_dates: list[date]) -> date | None:
    candidates = [d for d in all_dates if d <= target]
    return max(candidates) if candidates else None

# ─── App ────────────────────────────────────────────────────────────────────
def app():
    dates = get_available_dates()
    latest = dates[-1]

    # Compute defaults (EOY, EOM)
    prev_year_end = date(latest.year - 1, 12, 31)
    ye_candidate = closest_before(prev_year_end, dates)
    if latest.month == 1:
        lm_year, lm_month = latest.year - 1, 12
    else:
        lm_year, lm_month = latest.year, latest.month - 1
    last_day = calendar.monthrange(lm_year, lm_month)[1]
    prev_month_end = date(lm_year, lm_month, last_day)
    me_candidate = closest_before(prev_month_end, dates)

    # Seed session state
    if "selected_dates" not in st.session_state:
        init = [latest]
        if ye_candidate and ye_candidate not in init:
            init.append(ye_candidate)
        if me_candidate and me_candidate not in init:
            init.append(me_candidate)
        st.session_state.selected_dates = init
    if "selected_date" not in st.session_state:
        st.session_state.selected_date = latest

    # ─── TOP CONTROLS ──────────────────────────────────────────────────────────
    c1, c2 = st.columns(2)
    with c1:
        st.date_input(
            "Select curve date",
            key="selected_date",
            min_value=dates[0],
            max_value=latest,
            on_change=on_date_change
        )
    with c2:
        opts = [d.strftime("%Y/%m/%d") for d in st.session_state.selected_dates] + ["Clear all"]
        st.pills(
            label="Dates selected so far (click to remove or clear all):",
            options=opts,
            selection_mode="multi",
            default=[],
            key="pills_selected",
            on_change=remove_pills
        )

    # ─── Load & combine curves ────────────────────────────────────────────────
    all_dfs = []
    for dt in st.session_state.selected_dates:
        df = load_curve_for_date(dt)
        if not df.empty:
            df["curve_date"] = dt
            all_dfs.append(df)

    if not all_dfs:
        st.warning("Pick a date above to see its curve—and it will stay in the plot history!")
        return

    history_df = pd.concat(all_dfs, ignore_index=True)
    history_df["curve_date_str"] = history_df["curve_date"].apply(
        lambda d: d.strftime("%Y/%m/%d")
    )

    # ─── Determine scale_mode (default linear) ─────────────────────────────────
    scale_mode = st.session_state.get("scale_mode", "linear")

    # ─── Build X encoding for chart ────────────────────────────────────────────
    if scale_mode == "even spacing":
        # enable vertical grid lines for ordinal axis
        x_enc = alt.X(
            "tenor_num:O",
            title="Tenor (yrs)",
            axis=alt.Axis(
                labelExpr="format(datum.value, '.2f')",
                labelAngle=0,
                grid=True
            )
        )
    else:
        x_enc = alt.X(
            "tenor_num:Q",
            title="Tenor (yrs)",
            axis=alt.Axis(
                labelAngle=0,
                grid=True  # quantitative also shows grid
            )
        )

    # ─── Plot curves ───────────────────────────────────────────────────────────
    chart = (
        alt.Chart(history_df)
        .mark_line(point=True)
        .encode(
            x=x_enc,
            y=alt.Y(
                "rate:Q",
                title="Rate (%)",
                scale=alt.Scale(zero=False),
                axis=alt.Axis(labelExpr="format(datum.value, '.2f') + '%'", grid=True)
            ),
            color=alt.Color("curve_date_str:N", title="Curve Date"),
            tooltip=[
                alt.Tooltip("curve_date_str:N", title="Date"),
                alt.Tooltip("tenor_num:Q", title="Tenor (yrs)"),
                alt.Tooltip("rate:Q", title="Rate", format=".2f")
            ],
        )
        .properties(width=700, height=400)
        .interactive()
    )
    st.altair_chart(chart, use_container_width=True)

    # ─── X-AXIS SPACING TOGGLE UNDER THE CHART ─────────────────────────────────
    st.radio(
        "X-axis spacing:",
        options=["linear", "even spacing"],
        index=0,
        key="scale_mode",
        horizontal=True
    )

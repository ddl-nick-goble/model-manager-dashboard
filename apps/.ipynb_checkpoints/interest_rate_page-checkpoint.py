import streamlit as st
import pandas as pd
import altair as alt
from domino.data_sources import DataSourceClient

st.markdown(
    """
    **Overview:**  
    Browse daily interest rate curves in the `dbo.market_data.rate_curves` table.
    Select a date to plot the curve across the entire term structure (ie. today - 30Y).
    """
)

@st.cache_data(ttl=120)
def load_reference_rates():
    ds = DataSourceClient().get_datasource("market_data")
    sql = """
        SELECT rate_type,
               rate_date,
               rate,
               volume_in_billions
          FROM reference_rates
         ORDER BY rate_date;
    """
    df = ds.query(sql).to_pandas()
    df["rate_date"] = pd.to_datetime(df["rate_date"])
    return df

def overlay_legend(orient='none'):
    return alt.Legend(
        orient=orient,
        direction='vertical',
        titleFontSize=12,
        labelFontSize=11,
        title='Rate Type'
    )

def app():
    st.markdown(
        """
        <style>
        .main .block-container {
            padding-top: 1rem;
            padding-bottom: 1rem;
            padding-left: 2rem;
            padding-right: 2rem;
        }
        </style>
        """,
        unsafe_allow_html=True
    )

    df = load_reference_rates()

    # --- Pivot and prep for SOFR spread ---
    rate_pivot = df.pivot(index="rate_date", columns="rate_type", values="rate")
    spread_df = rate_pivot.subtract(rate_pivot["Secured Overnight Financing Rate"], axis=0)
    spread_df["rate_date"] = spread_df.index
    spread_long = spread_df.drop(columns=["Secured Overnight Financing Rate"]).melt(
        id_vars="rate_date", var_name="rate_type", value_name="spread"
    )

    # --- Create charts ---
    rate_chart = (
        alt.Chart(df).mark_line(point=True).encode(
            x=alt.X("rate_date:T", title=""),
            y=alt.Y(
                "rate:Q",
                title="Overnight Rate (%)",
                axis=alt.Axis(labelExpr="format(datum.value, '.2f') + '%'")
            ),
            color=alt.Color("rate_type:N", legend=overlay_legend('top-left')),
            tooltip=[
                alt.Tooltip("rate_date:T", title="Date"),
                alt.Tooltip("rate:Q", title="Rate", format=".2f"),
                alt.Tooltip("rate_type:N", title="Type")
            ]
        ).properties(height=400).interactive()
         .configure_axis(labelFont='Inter', titleFont='Inter')
         .configure_legend(labelFont='Inter', titleFont='Inter')
         .configure_title(font='Inter')
    )

    volume_chart = (
        alt.Chart(df).mark_bar().encode(
            x=alt.X("rate_date:T", title=""),
            y=alt.Y(
                "volume_in_billions:Q",
                title="Volume ($ billion)",
                axis=alt.Axis(labelExpr="'$' + format(datum.value, ',.0f')")
            ),
            color=alt.Color("rate_type:N", legend=overlay_legend('top-left')),
            tooltip=[
                alt.Tooltip("rate_date:T", title="Date"),
                alt.Tooltip("volume_in_billions:Q", title="Volume"),
                alt.Tooltip("rate_type:N", title="Type")
            ]
        ).properties(height=400).interactive()
         .configure_axis(labelFont='Inter', titleFont='Inter')
         .configure_legend(labelFont='Inter', titleFont='Inter')
         .configure_title(font='Inter')
    )

    spread_chart = (
        alt.Chart(spread_long).mark_line(point=False).encode(
            x=alt.X("rate_date:T", title=""),
            y=alt.Y("spread:Q", title="Spread vs SOFR (%)", axis=alt.Axis(format=".2f")),
            color=alt.Color("rate_type:N", legend=overlay_legend('bottom-left')),
            tooltip=[
                alt.Tooltip("rate_date:T", title="Date"),
                alt.Tooltip("rate_type:N", title="Rate"),
                alt.Tooltip("spread:Q", title="Spread", format=".2f")
            ]
        ).properties(height=400).interactive()
         .configure_axis(labelFont='Inter', titleFont='Inter')
         .configure_legend(labelFont='Inter', titleFont='Inter')
         .configure_title(font='Inter')
    )

    # --- Layout 2x3 ---
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Overnight Rates Over Time")
        st.altair_chart(rate_chart, use_container_width=True)

    with col2:
        st.subheader("Volume over Time (in Billions)")
        st.altair_chart(volume_chart, use_container_width=True)

    with col1:
        st.subheader("SOFR Spread over Time")
        st.altair_chart(spread_chart, use_container_width=True)

    with col2:
        st.subheader("Volume by Rate Type (Latest Day)")
        latest_date = df["rate_date"].max()
        latest_df = df[df["rate_date"] == latest_date]

        bar_chart = (
            alt.Chart(latest_df).mark_bar().encode(
                x=alt.X("rate_type:N", title=""),
                y=alt.Y("volume_in_billions:Q", title="Volume ($ billion)"),
                color=alt.Color("rate_type:N", legend=None),
                tooltip=[
                    alt.Tooltip("rate_type:N", title="Rate Type"),
                    alt.Tooltip("volume_in_billions:Q", title="Volume", format=",.0f")
                ]
            ).properties(height=400).interactive()
             .configure_axis(labelFont='Inter', titleFont='Inter')
             .configure_legend(labelFont='Inter', titleFont='Inter')
             .configure_title(font='Inter')
        )
    
        st.altair_chart(bar_chart, use_container_width=True)


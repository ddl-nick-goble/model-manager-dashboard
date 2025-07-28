import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from datetime import datetime
from pathlib import Path
import sys

from domino.data_sources import DataSourceClient  

def app():
    ds = DataSourceClient().get_datasource("market_data")
    
    @st.cache_data
    def fetch_curve_types():
        sql = """
        SELECT DISTINCT curve_type
        FROM rate_curves
        ORDER BY curve_type;
        """
        df = ds.query(sql).to_pandas()
        return df["curve_type"].tolist()
    
    curve_types = fetch_curve_types()
    selected_curve = st.sidebar.selectbox("Curve Type", curve_types)
    
    @st.cache_data
    def fetch_dates(curve_type):
        sql = f"""
        SELECT DISTINCT curve_date
        FROM rate_curves
        WHERE curve_type = '{curve_type}'
        ORDER BY curve_date;
        """
        df = ds.query(sql).to_pandas()
        df["curve_date"] = pd.to_datetime(df["curve_date"])
        return df["curve_date"].dt.date.tolist()
    
    available_dates = fetch_dates(selected_curve)
    min_date, max_date = min(available_dates), max(available_dates)
    
    start_date = st.sidebar.date_input("Start Date", min_date, min_value=min_date, max_value=max_date)
    end_date = st.sidebar.date_input("End Date", max_date, min_value=min_date, max_value=max_date)
    if start_date > end_date:
        st.sidebar.error("Start Date must be ≤ End Date")
    
    @st.cache_data
    def fetch_tenors(curve_type):
        sql = f"""
        SELECT DISTINCT tenor_num
        FROM rate_curves
        WHERE curve_type = '{curve_type}'
        ORDER BY tenor_num;
        """
        df = ds.query(sql).to_pandas()
        return sorted(df["tenor_num"].tolist())
    
    tenors = fetch_tenors(selected_curve)
    
    @st.cache_data
    def fetch_rate_curves(curve_type, start_date, end_date):
        sql = f"""
        SELECT curve_date, tenor_num, rate
        FROM rate_curves
        WHERE curve_type = '{curve_type}'
          AND curve_date BETWEEN '{start_date}' AND '{end_date}'
          AND tenor_num IN ({','.join(str(t) for t in tenors)})
        ORDER BY curve_date, tenor_num;
        """
        return ds.query(sql).to_pandas()
    
    rates_df = fetch_rate_curves(selected_curve, start_date, end_date)
    rates_df["curve_date"] = pd.to_datetime(rates_df["curve_date"])
    
    if rates_df.empty:
        st.warning("No data available for the selected range and curve type.")
        st.stop()
    
    # Pivot & forward‐fill missing tenor values
    pivot = (
        rates_df
        .pivot(index="curve_date", columns="tenor_num", values="rate")
        .sort_index()
    )
    pivot = pivot.ffill(axis=0)
    
    date_index = pivot.index
    tenor_index = pivot.columns.tolist()
    date_strs = [d.strftime("%Y-%m-%d") for d in date_index]
    z_values = pivot.values  # shape = (n_dates, n_tenors)
    
    # ─────────────────────────────────────────────────────────────
    # Reverse the date axis so it isn’t “upside‐down”
    # ─────────────────────────────────────────────────────────────
    date_strs = date_strs[::-1]
    z_values = z_values[::-1, :]
    
    # Build and display a larger Plotly 3D surface
    fig = go.Figure(
        data=[
            go.Surface(
                x=tenor_index,
                y=date_strs,
                z=z_values,
                colorscale="Viridis",
                showscale=True,
                colorbar=dict(title="Yield (%)")
            )
        ]
    )
    
    fig.update_layout(
        title=f"Yield Curve Surface: {selected_curve}",
        scene=dict(
            xaxis=dict(title="Tenor (years)"),
            yaxis=dict(title="Curve Date"),
            zaxis=dict(title="Rate (%)", autorange=True),
        ),
        margin=dict(l=20, r=20, t=60, b=20),
        height=1000
    )
    
    st.plotly_chart(fig, use_container_width=True, height=1000)

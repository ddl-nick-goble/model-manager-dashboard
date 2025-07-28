import streamlit as st
import pandas as pd
from domino.data_sources import DataSourceClient
from datetime import date
import pandas as pd

def format_coupon(v):
    # If the cell is NaN, show a dash; otherwise format with two decimals + “%”
    return "–" if pd.isna(v) else f"{v:.2f}%"

def app():
    # ─── Page Header ─────────────────────────────────────────────────────────────
    st.markdown(
        """
        **Overview:**  
        Browse daily bond-based liability inventory found in the `dbo.market_data.tsy_inventory` view.
        Select a date on the sidebar to see summary metrics, a type-level breakdown, and drill into individual issues.
        """
    )
    
    # ─── Data Access Functions ───────────────────────────────────────────────────
    @st.cache_data(show_spinner=False, ttl=300)
    def get_inventory_dates() -> list[date]:
        ds = DataSourceClient().get_datasource("market_data")
        df = (
            ds.query(
                "SELECT DISTINCT inventory_date FROM tsy_inventory ORDER BY inventory_date"
            )
            .to_pandas()
        )
        df["inventory_date"] = pd.to_datetime(df["inventory_date"]).dt.date
        return df["inventory_date"].tolist()
    
    @st.cache_data(show_spinner=False, ttl=300)
    def load_inventory(inv_date: date) -> pd.DataFrame:
        ds = DataSourceClient().get_datasource("market_data")
        sql = (
            "SELECT * FROM tsy_inventory "
            f"WHERE inventory_date = '{inv_date}' "
            "ORDER BY maturity_date"
        )
        df = ds.query(sql).to_pandas()
        for col in ["issue_date", "maturity_date", "auction_date"]:
            df[col] = pd.to_datetime(df[col]).dt.date
        df.rename(columns={"int_rate": "coupon"}, inplace=True)
        df["price_per100"] = pd.to_numeric(df["price_per100"], errors="coerce")
        return df
    
    # ─── Sidebar Controls ────────────────────────────────────────────────────────
    with st.sidebar:
        st.header("Controls")
        dates = get_inventory_dates()
        if not dates:
            st.error("No inventory dates found in `tsy_inventory` view.")
            st.stop()
        selected_date = st.date_input(
            "Select Inventory Date",
            value=dates[-1],
            min_value=dates[0],
            max_value=dates[-1],
        )
    
    # ─── Main Content ────────────────────────────────────────────────────────────
    df = load_inventory(selected_date)
    
    if not df.empty:
        # Overall KPIs
        total_qty = df["quantity"].sum()
        avg_coupon = (df["coupon"] * df["quantity"]).sum() / total_qty
    
        # ─── KPI Metrics ─────────────────────────────────────────────────────────
        k1, k2 = st.columns([2, 1])
        k1.metric("Total Notional", f"{total_qty:,.0f}")
        k2.metric("Weighted Avg Coupon", f"{avg_coupon:.2f}%")
    
        st.markdown("---")
    
        # ─── Summary by Security Type ────────────────────────────────────────────
        today = pd.to_datetime(selected_date)
        summary_df = (
            df.assign(
                time_to_maturity_years=lambda d: (
                    (pd.to_datetime(d["maturity_date"]) - today).dt.days / 365
                )
            )
            .groupby("security_type")
            .agg(
                total_count=("cusip", "count"),
                avg_time_to_maturity_years=("time_to_maturity_years", "mean"),
                avg_coupon=("coupon", "mean"),
                avg_price_per100=("price_per100", "mean"),
                total_notional_millions=("quantity", lambda x: x.sum() / 1e6),
            )
            .reset_index()
        )
        
        # Rename for display
        summary_df.rename(
            columns={
                "security_type": "Security Type",
                "total_count": "Total Count",
                "avg_time_to_maturity_years": "Avg Time to Maturity (yrs)",
                "avg_coupon": "Avg Coupon (%)",
                "avg_price_per100": "Avg Price ($)",
                "total_notional_millions": "Total Notional (M)",
            },
            inplace=True,
        )
        
        # Sort by maturity
        summary_df = summary_df.sort_values(
            by="Avg Time to Maturity (yrs)", ascending=False
        )
        
        # Style & format
        styled = (
            summary_df.style
            .format({
                "Total Count":         "{:d}",
                "Avg Time to Maturity (yrs)": "{:.2f}",
                "Avg Coupon (%)":      format_coupon,
                "Avg Price ($)":       "${:.2f}",
                "Total Notional (M)":  "{:.2f}M",
            })
            .set_properties(**{"text-align": "right"})
        )
        
        st.subheader("Summary by Security Type")
        st.table(styled)
    
    
        st.markdown("---")
    
        # ─── Detailed Inventory ─────────────────────────────────────────────────
        st.subheader("Detailed Inventory")
        types = df["security_type"].unique()
        chosen = st.multiselect("Security Types", options=types, default=list(types))
        filtered = df[df["security_type"].isin(chosen)]
        st.dataframe(filtered, use_container_width=True)
    
        csv = filtered.to_csv(index=False).encode("utf-8")
        st.download_button(
            "📥 Download CSV",
            data=csv,
            file_name=f"inventory_{selected_date}.csv",
            mime="text/csv",
        )

import streamlit as st

def app():
    st.title("Home")
    
    pages = [
        ("Overnight Rates", "Inspect current overnight interest rates."),
        ("Rate Curves", "View and compare yield curves."),
        ("Treasury Inventory", "Browse the latest treasury inventory data."),
        ("Treasury Risk", "Dive into treasury risk analytics."),
    ]
    
    for page_name, desc in pages:
        if st.button(page_name):
            st.experimental_set_query_params(page=page_name)
        st.write(f"*{desc}*")
    

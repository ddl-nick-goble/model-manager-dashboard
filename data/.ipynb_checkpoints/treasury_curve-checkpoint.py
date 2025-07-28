from scipy.interpolate import interp1d

def get_yield_curve(as_of_date, data_source):
    """
    Query the rate_curves table and return a linear interpolator of tenor_num → rate.
    """
    query = f"""
    SELECT tenor_num, rate
    FROM rate_curves
    WHERE curve_type = 'US Treasury Par'
      AND curve_date = '{as_of_date.date()}'
      AND rate IS NOT NULL
    ORDER BY tenor_num;
    """
    df = data_source.query(query).to_pandas()

    if df.empty:
        raise ValueError(f"No yield curve data found for {as_of_date.date()}")

    # Create interpolator (you can switch to kind='cubic' if needed)
    return interp1d(df["tenor_num"], df["rate"], kind="linear", fill_value="extrapolate")

def bump_curve(base_yc, shift_bp):
    def f(t_arr):
        return base_yc(t_arr) + (shift_bp / 100.0)
    return f

shocks = {
    'u25':  +25,
    'd25':  -25,
    'u100': +100,
    'd100': -100,
    'u200': +200,
    'd200': -200,
}

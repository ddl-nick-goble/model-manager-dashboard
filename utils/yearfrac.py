from datetime import date, datetime

def year_fraction_act_act(start_date, end_date):
    """
    Calculate the year fraction between two dates using the ACT/ACT (ISDA) convention.
    
    Accepts datetime.date or datetime.datetime for start_date and end_date.
    Splits across calendar years, weighting by whether each year is 365 or 366 days.
    """
    # Normalize to date
    if isinstance(start_date, datetime):
        start_date = start_date.date()
    if isinstance(end_date, datetime):
        end_date = end_date.date()
    
    # If reversed, swap
    if start_date > end_date:
        start_date, end_date = end_date, start_date

    def is_leap_year(year):
        return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

    frac = 0.0
    current = start_date

    while current < end_date:
        # end of this calendar year
        next_year_start = date(current.year + 1, 1, 1)
        segment_end = min(end_date, next_year_start)
        days = (segment_end - current).days
        days_in_year = 366 if is_leap_year(current.year) else 365
        frac += days / days_in_year
        current = segment_end

    return frac

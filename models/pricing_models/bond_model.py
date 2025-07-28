import pandas as pd
import numpy as np

class Bond:
    def __init__(self, cusip, issue_date, maturity_date, coupon, frequency, quantity, face_value=100):
        self.cusip = cusip
        self.issue_date = pd.to_datetime(issue_date)
        self.maturity_date = pd.to_datetime(maturity_date)
        self.coupon_rate = float(coupon) if pd.notna(coupon) else 0.0
        self.frequency = frequency
        self.quantity = float(quantity)
        self.face_value = float(face_value)

        # Determine periods per year
        self.freq_per_year = 2 if frequency == 'Semi-Annual' else 1
        months = int(12 / self.freq_per_year)

        # Build cashflow dates (vector of coupon dates)
        dates = []
        date = self.issue_date
        while date < self.maturity_date:
            date = date + pd.DateOffset(months=months)
            dates.append(date)
        self.dates = np.array(dates)

        # Cashflow amounts (vector)
        coupon_amt = self.face_value * self.coupon_rate / 100 / self.freq_per_year
        flows = np.full(len(self.dates), coupon_amt, dtype=float)
        flows[-1] += self.face_value  # add redemption at maturity
        self.flows = flows

    @staticmethod
    def make_krd_shock_matrix(ttm_mat, key_tenors):
        """
        Build shock matrices for each key tenor (1,2,3,5,7,10,20,30).
        Because we multiply weight * 0.01, each matrix entry is a 1bp shock (0.01%).
        """
        ext_t = [0] + key_tenors + [50]
        n_keys = len(key_tenors)
        shock_mats = np.zeros((n_keys,) + ttm_mat.shape, dtype=float)

        for idx, kt in enumerate(key_tenors):
            t_prev = ext_t[idx]
            t_next = ext_t[idx+2]

            if idx == 0:
                # first key: weight = 1 for t <= kt; ramp down to 0 at t_next
                weight = np.where(
                    ttm_mat <= kt,
                    1.0,
                    np.where(
                        (ttm_mat > kt) & (ttm_mat < t_next),
                        (t_next - ttm_mat) / (t_next - kt),
                        0.0
                    )
                )

            elif idx == n_keys - 1:
                # last key: weight = 1 for t >= kt; ramp up from 0 at t_prev
                weight = np.where(
                    ttm_mat >= kt,
                    1.0,
                    np.where(
                        (ttm_mat > t_prev) & (ttm_mat < kt),
                        (ttm_mat - t_prev) / (kt - t_prev),
                        0.0
                    )
                )

            else:
                # middle keys: ramp 0→1 from t_prev to kt, then 1→0 from kt to t_next
                weight = np.where(
                    (ttm_mat >= t_prev) & (ttm_mat <= kt),
                    (ttm_mat - t_prev) / (kt - t_prev),
                    np.where(
                        (ttm_mat > kt) & (ttm_mat <= t_next),
                        (t_next - ttm_mat) / (t_next - kt),
                        0.0
                    )
                )

            # multiply by 0.01 → a 1 bp shock
            shock_mats[idx] = weight * 0.01

        return shock_mats

    @classmethod
    def price_batch_with_sensitivities(cls, bonds, as_of_date, yield_curve):
        """
        Vectorized pricing for multiple Bond instances, computing:

          • Dirty price (PV of all future CFs under base curve)
          • Accrued interest (AI) at as_of_date
          • Clean price = Dirty price − Accrued interest
          • dv01        (parallel 1bp shift): PV_base − PV(curve+1bp)
          • krds        (per‐1bp key‐rate shocks at tenors [1,2,3,5,7,10,20,30])

        Returns:
          pvs_base        (dirty prices),
          accrued_interest, 
          clean_prices,
          dv01            (1bp parallel),
          krd_matrix      (each column is key‐rate DV for 1bp)
        """
        ao = pd.to_datetime(as_of_date)
        n = len(bonds)
        max_cf = max(len(b.dates) for b in bonds)

        # Initialize mats
        flows_mat = np.zeros((n, max_cf), dtype=float)
        ttm_mat   = np.zeros((n, max_cf), dtype=float)

        # To collect accrued interest
        accrued_arr = np.zeros(n, dtype=float)

        # Build flows_mat, ttm_mat, and compute accrued for each bond
        for i, b in enumerate(bonds):
            # Time to each coupon date, in years
            raw_ttm = (b.dates.astype('datetime64[D]') - ao.to_datetime64()) \
                      / np.timedelta64(1, 'D') / 365.25

            # Zero out any cashflows at or before valuation date (we'll zero those flows, and mark TTM=NaN)
            ttm = np.where(raw_ttm <= 0.0, np.nan, raw_ttm)

            # Fill first k positions in the mats
            k = len(b.dates)
            flows_mat[i, :k] = b.flows
            ttm_mat[i, :k]   = ttm

            # If ttm was NaN (coupon date ≤ as_of_date), remove that flow
            flows_mat[i, :k] = np.where(np.isnan(ttm), 0.0, b.flows)

            # ===== Accrued Interest Calculation =====
            # 1) coupon amount per period
            coupon_amt = b.face_value * b.coupon_rate / 100 / b.freq_per_year

            # 2) find next coupon date strictly > as_of_date
            future_coupons = [d for d in b.dates if d > ao]
            if len(future_coupons) == 0:
                # Already matured or no future coupon → no accrual
                accrued_arr[i] = 0.0
            else:
                next_coupon = future_coupons[0]
                # find its index to get previous coupon
                idx_next = list(b.dates).index(next_coupon)

                if idx_next == 0:
                    # first coupon is still in future → last coupon is issue_date
                    prev_coupon = b.issue_date
                else:
                    prev_coupon = b.dates[idx_next - 1]

                # accrual fraction between prev_coupon and next_coupon
                accrual_days = (ao - prev_coupon).days
                period_days  = (next_coupon - prev_coupon).days
                accrual_frac = accrual_days / period_days if period_days > 0 else 0.0

                # accrued interest = coupon_amt × fraction
                accrued_arr[i] = coupon_amt * accrual_frac

        # Get the base yields (in percent) for each flow TTM
        rates_pct = yield_curve(ttm_mat)
        # For any NaN-ttm, force rate = 0 so DF = 1
        rates_pct = np.where(np.isnan(ttm_mat), 0.0, rates_pct)

        # 1) Dirty price = sum(flows × exp(−r×ttm))
        dfs_base = np.exp(-(rates_pct / 100) * np.nan_to_num(ttm_mat))
        pvs_base = (flows_mat * dfs_base).sum(axis=1)

        # Clean price = Dirty price − Accrued
        clean_prices = pvs_base - accrued_arr

        # 2) dv01 → parallel 1bp shift
        dfs_par = np.exp(-((rates_pct + 0.01) / 100) * np.nan_to_num(ttm_mat))
        pvs_par = (flows_mat * dfs_par).sum(axis=1)
        dv01    = pvs_base - pvs_par

        # 3) key‐rate dv (krd) for each tenor, now 1bp each
        key_tenors = [1,2,3,5,7,10,20,30]
        shock_mats = cls.make_krd_shock_matrix(ttm_mat, key_tenors)
        n_keys = len(key_tenors)

        krd_matrix = np.zeros((n, n_keys), dtype=float)
        for idx in range(n_keys):
            shock_pct = shock_mats[idx]  # this is ±0.01 at max (i.e. 1bp)
            dfs_k = np.exp(-((rates_pct + shock_pct) / 100) * np.nan_to_num(ttm_mat))
            pvs_k = (flows_mat * dfs_k).sum(axis=1)
            krd_matrix[:, idx] = pvs_base - pvs_k

        qtys = np.array([b.quantity for b in bonds])

        pvs_base        *= qtys
        accrued_arr     *= qtys
        clean_prices    *= qtys
        dv01            *= qtys
        krd_matrix      *= qtys[:, None]  # broadcast to (n_bonds, n_keys)
        
        return pvs_base, accrued_arr, clean_prices, dv01, krd_matrix

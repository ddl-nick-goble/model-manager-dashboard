import numpy as np
from sklearn.base import BaseEstimator
from arch.univariate import arch_model

class GARCHCovarianceModel(BaseEstimator):
    """
    Multivariate covariance via univariate GARCH(1,1) + static correlation.
    
    - Fits a GARCH(1,1) to each column of X.
    - Computes standardized residuals, then sample correlation.
    - Builds covariance at final time: D_t · R · D_t, with D_t = diag(sigma_t).
    """
    name = "GARCH(1,1)"

    def __init__(self, p: int = 1, q: int = 1):
        self.p = p
        self.q = q
        self._cov = None

    def fit(self, X, y=None):
        """
        X : array-like, shape (n_obs, n_series)
        """
        X = np.asarray(X)
        n_obs, n_ser = X.shape

        # store conditional volatilities & standardized residuals
        cond_vol = np.zeros((n_obs, n_ser))
        std_resid = np.zeros((n_obs, n_ser))

        for i in range(n_ser):
            # zero‐mean GARCH(p,q)
            g = arch_model(X[:, i], mean="zero", vol="GARCH",
                           p=self.p, q=self.q, dist="normal")
            res = g.fit(disp="off")
            cond_vol[:, i] = res.conditional_volatility
            std_resid[:, i] = res.resid / cond_vol[:, i]

        # static correlation of standardized residuals
        corr = np.corrcoef(std_resid.T)

        # covariance at last time point
        last_sigma = cond_vol[-1, :]
        D = np.diag(last_sigma)
        self._cov = D @ corr @ D
        return self

    def predict(self, X):
        """
        Returns the same covariance matrix for each sample in X.
        """
        m = np.asarray(X).shape[0]
        return np.repeat(self._cov[np.newaxis, :, :], m, axis=0)

    @property
    def covariance_(self):
        """Latest estimated covariance matrix."""
        return self._cov
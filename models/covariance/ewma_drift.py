import numpy as np
from sklearn.base import BaseEstimator

class EWMADriftCovarianceModel(BaseEstimator):
    """
    Exponentially-Weighted Covariance with drift:
      μ_t    = λ·μ_{t-1} + (1-λ)·r_t
      cov_t = λ·cov_{t-1} + (1-λ)·( (r_t - μ_t)(r_t - μ_t)' )
    """
    name = "ewmaDrift"

    def __init__(self, decay: float = 0.94):
        self.decay = decay
        self._cov = None
        self._drift = None

    def fit(self, X, y=None):
        """
        X: array of shape (T, N), rows = return vectors across N tenors
        """
        lam = self.decay
        T, N = X.shape

        cov   = np.zeros((N, N), dtype=float)
        drift = np.zeros(N,      dtype=float)

        for t in range(T):
            r = X[t]                               # shape (N,)
            drift = lam * drift + (1 - lam) * r    # update mean
            delta = r - drift
            cov   = lam * cov   + (1 - lam) * np.outer(delta, delta)

        self._cov   = cov
        self._drift = drift
        return self

    def predict(self, X):
        """
        Return cov for each sample so this plays nicely in pipelines/MLflow.
        """
        m = X.shape[0]
        return np.repeat(self._cov[np.newaxis, :, :], repeats=m, axis=0)

    @property
    def covariance_(self):
        """Most-recently computed covariance matrix."""
        return self._cov

    @property
    def drift_(self):
        """Most-recently computed drift (mean) vector."""
        return self._drift

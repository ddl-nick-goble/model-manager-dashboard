import numpy as np
from sklearn.base import BaseEstimator

class EWMACovarianceModel(BaseEstimator):
    """
    Exponentially-Weighted Covariance:
      cov_t = λ⋅cov_{t-1} + (1-λ)⋅(Δr_t Δr_t')
    """
    name = "ewmaDriftless"

    def __init__(self, decay: float = 0.94):
        self.decay = decay
        self._cov = None

    def fit(self, X, y=None):
        lam = self.decay
        T, N = X.shape
        cov = np.zeros((N, N), dtype=float)
        for t in range(T):
            x = X[t].reshape(-1, 1)
            cov = lam * cov + (1 - lam) * (x @ x.T)
        self._cov = cov
        return self

    def predict(self, X):
        """
        Return the same covariance matrix for each sample in X.
        This makes it a valid sklearn-style estimator and lets MLflow 
        log it properly.
        """
        m = X.shape[0]
        # shape (m, N, N)
        return np.repeat(self._cov[np.newaxis, :, :], repeats=m, axis=0)

    @property
    def covariance_(self):
        return self._cov

import numpy as np
from sklearn.base import BaseEstimator
from sklearn.covariance import LedoitWolf

class LedoitWolfCovarianceModel(BaseEstimator):
    """Covariance estimator with optimal shrinkage (Ledoit–Wolf)."""

    name = "LedoitWolf"

    def __init__(self):
        self._cov = None

    def fit(self, X, y=None):
        """
        X: array-like, shape (n_obs, n_tenors)
        """
        lw = LedoitWolf().fit(X)
        self._cov = lw.covariance_
        return self

    def predict(self, X):
        """
        We just return the same covariance for each sample.
        """
        m = X.shape[0]
        return np.repeat(self._cov[np.newaxis, :, :], m, axis=0)

    @property
    def covariance_(self):
        return self._cov

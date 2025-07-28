import numpy as np
from sklearn.base import BaseEstimator
from sklearn.covariance import EmpiricalCovariance


class EmpiricalCovarianceModel(BaseEstimator):
    name = "EmpCov"

    def __init__(self):
        self._cov = None

    def fit(self, X, y=None):
        from sklearn.covariance import EmpiricalCovariance as _EC
        ec = _EC().fit(X)
        self._cov = ec.covariance_
        return self

    def predict(self, X):
        m, n = X.shape
        return np.repeat(self._cov[np.newaxis, :, :], repeats=m, axis=0)

    @property
    def covariance_(self):
        return self._cov
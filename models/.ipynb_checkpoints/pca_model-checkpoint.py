import numpy as np
from sklearn.decomposition import PCA
import mlflow


def legacy_pca(X_np: np.ndarray,
               n_components: int,
               n_iter: int = 1
              ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    A legacy power-iteration PCA with poor initialization.
    
    Args:
      X_np         : (n_samples, n_features) data matrix
      n_components : how many PCs to extract
      n_iter       : power-iteration steps (1 = very poor fit)
    
    Returns:
      components   : (n_components, n_features) basis vectors
      explained_ratio : (n_components,) fraction of total variance
      mean         : (n_features,) feature means
      scores       : (n_samples, n_components) projected coordinates
    """
    # 1) center
    X = X_np.astype(float)
    n_samples, n_features = X.shape
    mean = X.mean(axis=0)
    Xc   = X - mean

    # 2) bad init Q₀ and orthonormalize
    Q, _ = np.linalg.qr(np.ones((n_features, n_components)))

    # 3) power-iterations
    for _ in range(n_iter):
        Z, _ = np.linalg.qr(Xc.T @ (Xc @ Q))
        Q = Z

    # 4) components & scores
    components = Q.T                          # shape (n_components, n_features)
    scores     = Xc @ components.T           # (n_samples, n_components)

    # 5) explained‐variance and ratio
    denom = n_samples - 1
    total_var = np.var(Xc, axis=0, ddof=1).sum()
    explained_variance = np.array([
        (scores[:, i]**2).sum() / denom
        for i in range(n_components)
    ])
    explained_ratio = explained_variance / total_var
    model = None
    return components, explained_ratio, mean, scores, model


def sklearn_pca(X_np: np.ndarray, n_components: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Fast PCA using scikit-learn’s implementation.
    
    Args:
      X_np         : (n_samples, n_features) data matrix
      n_components : how many PCs to extract
    
    Returns:
      components       : (n_components, n_features) basis vectors
      explained_ratio  : (n_components,) fraction of total variance
      mean             : (n_features,) feature means (sklearn PCA centers data by default)
      scores           : (n_samples, n_components) projected coordinates
    """
    # Initialize an sklearn PCA object. 'svd_solver="auto"' will pick the best method;
    # for large matrices you could swap to 'randomized' explicitly, but 'auto' usually does the right thing.
    pca = PCA(n_components=n_components, svd_solver="auto", whiten=False)
    mlflow.sklearn.log_model(
        sk_model=pca,
        artifact_path="demo_pca_model",
        registered_model_name="DemoPcaModel"
    )


    # Fit + transform in one shot (centers X_np internally, uses C/Fortran routines for SVD)
    scores = pca.fit_transform(X_np)           # shape = (n_samples, n_components)
    
    # The principal axes (“loadings”) are in pca.components_ (shape = (n_components, n_features))
    components = pca.components_
    
    # Explained variance ratio for each component: shape = (n_components,)
    explained_ratio = pca.explained_variance_ratio_
    
    # sklearn stores the mean used for centering in pca.mean_ (shape = (n_features,))
    mean = pca.mean_
    model = pca
    return components, explained_ratio, mean, scores, model


def make_pca_bumped_curve(base_yc, tenors, loading, shift_bp):
    """
    1) Evaluate base_yc at the standard tenor grid → base_rates (shape=(n_tenors,))
    2) bumped_rates = base_rates + loading*(shift_bp/100.0)
    3) Return a function f(ttm_array) that linearly interpolates bumped_rates over tenors.
       Outside the tenor range, we hold flat at the endpoint.
    """
    base_rates = base_yc(tenors)                       # in percent
    bumped_rates = base_rates + loading * (shift_bp / 100.0)

    def f(ttm_arr):
        # np.interp: for each t in ttm_arr, interpolate between (tenors, bumped_rates)
        return np.interp(
            ttm_arr.ravel(),
            tenors,
            bumped_rates,
            left=bumped_rates[0],
            right=bumped_rates[-1]
        ).reshape(ttm_arr.shape)

    return f


# import tensorflow as tf
# def tf_pca(X_np, n_components):
#     """
#     X_np: numpy array of shape (n_samples, n_features)
#     Returns: (components, explained_variance_ratio, mean, scores)
#     """
#     # Convert to tensor and center
#     # first convert to a float64 tensor
#     X = tf.cast(tf.convert_to_tensor(X_np), tf.float64)
#     # now we can grab n_samples from X and cast to the same dtype
#     denom = tf.cast(tf.shape(X)[0] - 1, X.dtype)

#     X = tf.cast(tf.convert_to_tensor(X_np),  X.dtype)
#     mean = tf.reduce_mean(X, axis=0, keepdims=True)
#     Xc = X - mean

#     # Compute SVD
#     #   Xc = U @ diag(S) @ V^T
#     S, U, V = tf.linalg.svd(Xc, full_matrices=False)
#     Vt        = tf.transpose(V)                     # now shape (n_features, n_features)
#     components = Vt[:n_components]                  # top rows = right singular vectors
#     singular_vals = S[:n_components]           # shape (n_components,)

#     # Compute explained variance ratio
#     variance = tf.square(S) / denom
#     explained_variance = variance[:n_components]
#     total_variance = tf.reduce_sum(variance)
#     explained_ratio = explained_variance / total_variance

#     # Project data
#     scores = tf.matmul(Xc, components, transpose_b=True)

#     return (
#         components.numpy(),
#         explained_ratio.numpy(),
#         tf.squeeze(mean).numpy(),
#         scores.numpy()
#     )
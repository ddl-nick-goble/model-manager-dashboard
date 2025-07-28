# FSI Risk Modeling

This repository contains a modular quantitative research toolkit developed to support model development, validation, and deployment within the investment ecosystem. It provides a shared foundation for quants, model validators, and technologists to collaborate on research workflows in a governed, production-aligned environment.  

---

## 🔍 Purpose

The `quant-lib` project enables quantitative teams to:
- Rapidly prototype and validate financial models in Python 
- Leverage consistent data structures and model interfaces
- Track model performance over time with MLflow
- Run workflows across sandbox, staging, and production environments

---

## 📁 Directory Overview
data/ – Input datasets, config files, processed outputs

models/ – Core model implementations (curve, pricing, risk, etc.)

notebooks/ – Interactive analysis, validation, and exploratory work

scripts/ – Executable CLI tools and batch model runners

tests/ – Unit and integration tests for model reliability

utils/ – Common utilities: date math, SQL, plotting helpers

docs/ – Methodology, assumptions, governance documentation

environments/ – Environment files for sandbox/staging/production



---

## 🚦 Environments

This repo supports development and deployment across three standardized environments:

| Environment | Description |
|-------------|-------------|
| **Sandbox** | For exploratory development, prototyping, and experimentation by quantitative researchers. |
| **Staging** | Used by model validators and reviewers for formal testing, validation, and governance review. |
| **Production** | Stable environment for executing approved models with full data access and monitoring. |

Environment configuration is driven by environment variables and project structure. See [`docs/environment_setup_instructions.md`](docs/environment_setup_instructions.md) for more.

---

## 🛠️ Key Features

- 📈 PCA and other curve modeling utilities
- 🧮 Closed-form and Monte Carlo pricing engines
- 🧾 Structured model logging and artifact tracking with MLflow
- 🔍 Built-in support for DV01, factor exposures, and stress testing
- ✅ Validation-ready with test coverage and assumptions tracking

---

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/quant-lib.git
   cd quant-lib
2. Set up your environment:
   ```bash
    conda env create -f environments/sandbox.yaml  # or staging.yaml / production.yaml
    conda activate quant-lib
3. Run a demo script:
   ```bash
    python scripts/run_rolling_pca.py 2024-12-31

---

## 🧪 Testing

Run all unit tests:
  ```bash
  pytest tests/
  ```

---

## 📄 Governance & Documentation

Refer to the docs/ directory for:

Methodology explanations

Model limitations

Assumptions tracking

Governance workflows

All production models must go through staging validation and be tagged for release.

## 👥 Contributors
This project is maintained by Quantitative Research and Model Governance teams, in collaboration with internal engineering partners.

## 🛡️ Disclaimer
This repository is intended for internal research and demonstration purposes only. It is not intended for public use or distribution. All models are subject to formal validation and approval before production deployment.

import os
from domino.data_sources import DataSourceClient
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from config import env


# TODO - setup different instances for different environments
datasource_mappings = {
    'production': 'market_data',
    'staging':    'market_data',
    'sandbox':    'market_data'
}

def get_data_source():
    print(f'getting data source for {env}')
    return DataSourceClient().get_datasource(datasource_mappings.get(env))
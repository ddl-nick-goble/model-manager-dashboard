import os

if 'data_env' not in os.environ.keys():
    print("'data_env' not found in environment. Defaulting to 'sandbox' env.")
env = os.environ.get('data_env', 'sandbox')
print(f'setting env to {env} data')
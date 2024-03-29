import os

from dataclasses import dataclass
from typing import List
from dotenv import load_dotenv

@dataclass
class NetnameCredentials:
    """A student's Concordia login information"""
    username: str
    password: str

# How to get an app password (link: https://support.google.com/mail/answer/185833?hl=en-GB)
# 1. go to manage my google account (link: https://myaccount.google.com/security)
# 2. Under "Signing in to Google" confirm that "2-Step Verification" is "On" for the account.
# 3. Under "Signing in to Google" Select "App passwords".
# 4. Select the app as "Mail" and the device as "Other (Custom name)" and name it (e.g: moodle_notifications).
# 5. Copy the app password, it will be in a yellow box and looks like: "XXXX XXXX XXXX XXXX"
@dataclass
class EmailCredentials:
    """A person's email login information"""
    email       : str
    app_password: str

def get_env_variable(key: str) -> str:
    """Returns the value corresponding to the given key and raises an exception if the key is not found"""
    # Loading in the environment variables stored in the .env folder
    load_dotenv(override=True)
    if key not in os.environ:
        raise Exception(f"The key '{key}' is not present in the local environment variables")
    
    return os.environ.get(key)

def get_env_netname_credentials() -> NetnameCredentials:
    """Returns the Credentials defined in the environment variables with keys 'USERNAME' and 'PASSWORD'"""
    username = get_env_variable("USERNAME")
    password = get_env_variable("PASSWORD")
    return NetnameCredentials(username, password)

def get_env_email_credentials() -> EmailCredentials:
    """Returns the Credentials defined in the environment variables with keys 'EMAIL' and 'APP_PASSWORD'"""
    email        = get_env_variable("EMAIL")
    app_password = get_env_variable("APP_PASSWORD")
    return EmailCredentials(email, app_password)

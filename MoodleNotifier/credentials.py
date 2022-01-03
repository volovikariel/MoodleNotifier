import os

from dotenv import load_dotenv


class Credentials:
    """A student's Concordia login information"""
    
    def __init__(self, username: str, password: str) -> None:
        self.username = username
        self.password = password

def getEnvVariable(key: str) -> str:
    """Returns the value corresponding to the given key and raises an exception if the key is not found"""
    if key not in os.environ:
        raise Exception(f"The key '{key}' is not present in the local environment variables")
    
    return os.environ.get(key)

def getEnvCredentials() -> Credentials:
    """Returns the Credentials defined in the environment variables with keys 'USERNAME' and 'PASSWORD'"""
    # Loading in the environment variables stored in the .env folder
    load_dotenv()
    username = getEnvVariable("USERNAME")
    password = getEnvVariable("PASSWORD")
    return Credentials(username, password)

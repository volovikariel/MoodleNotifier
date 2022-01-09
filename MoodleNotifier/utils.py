from datetime import datetime
import os

def get_formatted_time() -> str:
    return datetime.now().strftime('%d/%m/%Y %H:%M:%S')

def file_exists(file_path: str) -> bool:
    return os.path.isfile(file_path)

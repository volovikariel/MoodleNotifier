from datetime import datetime

def get_formatted_time() -> str:
    return datetime.now().strftime('%d/%m/%Y %H:%M:%S')
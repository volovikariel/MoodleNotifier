import os
from datetime import datetime
from textwrap import dedent


def get_formatted_time() -> str:
    """Gets time in the format day/month/year hour:minute:second."""
    return datetime.now().strftime('%d/%m/%Y %H:%M:%S')

def file_exists(file_path: str) -> bool:
    """Returns true if the file exists or false if it doesn't."""
    return os.path.isfile(file_path)

def create_default_env_file() -> None:
    """Creates the '.env' file with default values."""
    file_content = dedent("""\
                            #Your concordia portal username
                            USERNAME="concordia.ca\\\\example"
                            #Your Concordia portal password
                            PASSWORD=""
                            #Your gmail email
                            EMAIL="@gmail.com"
                            #The gmail APP password
                            # How to get an app password (instructions tkaen from: https://support.google.com/mail/answer/185833?hl=en-GB)
                            # 1. go to manage my google account (link: https://myaccount.google.com/security)
                            # 2. Under "Signing in to Google" confirm that "2-Step Verification" is "On" for the account.
                            # 3. Under "Signing in to Google" Select "App passwords".
                            # 4. Select the app as "Mail" and the device as "Other (Custom name)" and name it (e.g: moodle_notifications).
                            # 5. Copy the app password, it will be in a yellow box and looks like: "XXXX XXXX XXXX XXXX"
                            APP_PASSWORD=""
                            #The list of recipients that will be notified of posts/deletions
                            EMAIL_RECIPIENTS='["@gmail.com"]'
                            #Delay in hours, minutes, and seconds
                            DELAY_HOURS=0
                            DELAY_MINUTES=5
                            DELAY_SECONDS=0""")
    with open(".env", "w+") as env_file:
        env_file.write(file_content)
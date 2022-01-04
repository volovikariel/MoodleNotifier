import smtplib

from email.message import EmailMessage
from datetime import datetime

# How to get an app password (link: https://support.google.com/mail/answer/185833?hl=en-GB)
# 1. go to manage my google account (link: https://myaccount.google.com/security)
# 2. Under "Signing in to Google" confirm that "2-Step Verification" is "On" for the account.
# 3. Under "Signing in to Google" Select "App passwords".
# 4. Select the app as "Mail" and the device as "Other (Custom name)" and name it (e.g: moodle_notifications).
# 5. Copy the app password, it will be in a yellow box and looks like: "XXXX XXXX XXXX XXXX"
def send_email(content: str, email_from: str, email_to: str, app_password: str) -> None:
    """We send an email from email_from to email-to with the provided content through an SMTP server using GMAIL as the provider"""

    msg = EmailMessage()
    msg.add_header("Content-Type","text/html")
    msg.set_content(content, subtype="HTML")

    msg["Subject"] = f"[{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}] New Moodle Post"
    msg["From"]    = email_from
    msg["To"]      = email_to

    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.starttls()
        server.login(email_from, app_password)
        server.send_message(msg)

if __name__ == "__main__":
    """We only ever run this if we're testing the notification functions"""
    import os
    from dotenv import load_dotenv
    # Storing the APP_PASSWORD in a .env file so we need to load it in
    load_dotenv()
    email        = os.environ.get("EMAIL")
    app_password = os.environ.get("APP_PASSWORD")
    send_email("<b>Test content</b>", email, email, app_password)
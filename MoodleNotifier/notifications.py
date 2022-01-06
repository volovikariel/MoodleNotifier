import smtplib
from email.message import EmailMessage
from typing import List

from moodle_notifier import get_formatted_time
from credentials import EmailCredentials


# How to get an app password (link: https://support.google.com/mail/answer/185833?hl=en-GB)
# 1. go to manage my google account (link: https://myaccount.google.com/security)
# 2. Under "Signing in to Google" confirm that "2-Step Verification" is "On" for the account.
# 3. Under "Signing in to Google" Select "App passwords".
# 4. Select the app as "Mail" and the device as "Other (Custom name)" and name it (e.g: moodle_notifications).
# 5. Copy the app password, it will be in a yellow box and looks like: "XXXX XXXX XXXX XXXX"
def notify_email(subject: str, content_body: str, email_credentials: EmailCredentials, email_to: List[str], course_link: str, course_name: str) -> None:
    """We send an email from the user to the email_to list, with the provided subject and content, through an SMTP server (using GMAIL as the provider)"""
    msg = EmailMessage()

    content_header = f"<header>Retrieved from the <a href={course_link}>{course_name}</a> course page</header>"
    content_footer = f"<footer>Sent at: <b>{get_formatted_time()}</b></footer>"
    msg.set_content(content_header + content_body + content_footer, subtype="HTML")

    msg["Subject"] = subject
    msg["From"]    = email_credentials.email
    msg["To"]      = email_to

    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.starttls()
        server.login(email_credentials.email, email_credentials.app_password)
        server.send_message(msg)

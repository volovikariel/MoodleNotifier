from email.message import EmailMessage
import smtplib
from dataclasses import dataclass
from typing import List

from dotenv import load_dotenv

from credentials import EmailCredentials, get_env_variable
from utils import get_formatted_time, log_with_time


@dataclass
class EmailContent:
    course_link: str
    course_name: str
    content_body: str

    def get_formatted_content(self) -> str:
        content_header = f"""<header>
                                Retrieved from the <a href={self.course_link}>{self.course_name}</a> course page ({get_formatted_time()})
                            </header>
                          """
        separator = "<hr>"
        content_footer = f"""
                            <footer>
                                This is an automated Moodle Notification.
                                If you have any questions, message PshychozPath#4190 on Discord. 
                             </footer>
                          """
        return content_header + separator + self.content_body + separator + content_footer


@dataclass
class Email:
    """Class represents an email that can be sent"""
    subject: str
    content: EmailContent

    def send(self, email_sender_credentials: EmailCredentials, email_recipients: List[str]) -> None:
        message = EmailMessage()
        message["From"]    = email_sender_credentials.email
        message["To"]      = email_recipients
        message["Subject"] = self.subject
        message.set_content(self.content.get_formatted_content(), subtype="HTML")
        
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_sender_credentials.email, email_sender_credentials.app_password)
            log_with_time("Sending an email")
            server.send_message(message)

def get_env_email_recipients() -> List[str]:
    """Returns environment variable called 'EMAIL_RECIPIENTS'"""
    load_dotenv()
    import json
    return json.loads(get_env_variable("EMAIL_RECIPIENTS"))
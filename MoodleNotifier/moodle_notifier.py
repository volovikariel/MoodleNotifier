#!/usr/bin/env python3.10
import pathlib
import pickle
import sched
from sched import scheduler
from typing import List, Set

import requests
from bs4 import BeautifulSoup
from requests.models import Response
from requests.sessions import Session
from dotenv import load_dotenv

from credentials import (NetnameCredentials, get_env_email_credentials,
                         get_env_netname_credentials, get_env_variable)
from email_utils import Email, EmailContent, getEnvEmailRecipients
from utils import create_default_env_file, file_exists, get_formatted_time

MOODLE_LOGIN_PAGE = "https://moodle.concordia.ca/moodle/login/index.php"

def grant_session_iDP(response: Response, session: Session) -> Response:
    """Grants the current session an iDP by posting the SAMLResponse to a specific url. Return the response page."""
    soup         = BeautifulSoup(response.content, "lxml")
    # HTML contains a hidden form with a URL to POST to and the SAMLResponse value
    url          = soup.find("form").get("action")
    SAMLResponse = soup.find("input").get("value")
    response     = session.post(url, {"SAMLResponse": SAMLResponse})

    return response

def goto_login_page(response: Response, session: Session) -> Response:
    """Go to the (Concordia) Netname login page. Return the response page."""
    # The "Click here to log in using your Netname" button's URL
    url      = BeautifulSoup(response.content, "lxml").select_one("a[href^='https://moodle.concordia.ca/moodle/auth/saml2/login.php']").get("href")
    response = session.get(url)
    
    return response

def login(response: Response, session: Session, credentials: NetnameCredentials) -> Response:
    """Log into the (Concorida) Netname login page with the given credentials. Return the response page."""
    # The form POST method's action contains the URL to post to when we have entered our login information
    url        = BeautifulSoup(response.content, "lxml").select_one("form[action^='https://fas.concordia.ca:443']").get("action")
    login_info = {"UserName": credentials.username,"Password": credentials.password}
    response   = session.post(url, login_info)

    return response

def grant_session_MDL_SSP_AuthToken(response: Response, session: Session) -> Response:
    """Grants the current session an MDL_SSP_AuthToken cookie by simply posting to a specific URL with our SAMLResponse value."""
    soup         = BeautifulSoup(response.content, "lxml")
    url          = soup.find("form").get("action")
    SAMLResponse = soup.find("input").get("value")
    response     = session.post(url, {"SAMLResponse": SAMLResponse})

    return response

def get_session(credentials: NetnameCredentials) -> Session:
    """Returns a session whose cookies are fully set and ready to access Moodle."""
    # The session to be returned. This will store all of the cookies as we go along
    session  = requests.Session()

    # We try to access the MOODLE_LOGIN_PAGE which will lead to a series of redirections which grant us necessary cookies to proceed 
    response = session.get(MOODLE_LOGIN_PAGE)
    
    # HTML contains a hidden form with a URL to POST to and a SAMLResponse value
    response = grant_session_iDP(response, session)

    # We're still at the initial login page, but we now have an "iDP" which is necessary for SAML authentication
    response = goto_login_page(response, session)

    # We now login to the page
    response = login(response, session, credentials)

    # We get ahold of the last necessary cookie before gaining full access to Moodle
    response = grant_session_MDL_SSP_AuthToken(response, session)

    return session

def get_mainpage_content(session: Session) -> bytes:
    """Returns the main moodle page content."""
    MOODLE_PAGE = "https://moodle.concordia.ca/moodle/"
    return session.get(MOODLE_PAGE).content

def get_course_links(session: Session) -> List[str] or List[None]:
    """Returns the course links present in the sidebar."""
    moodle_page_content = get_mainpage_content(session)
    return [el.parent.get("href") for el in BeautifulSoup(moodle_page_content, "lxml").select(".list-group-item .ml-1")]

def guarantee_directory_existance(directory_path: str) -> None:
    """We create the directory if it does not already exist."""
    pathlib.Path(directory_path).mkdir(parents=True, exist_ok=True)

def create_course_file(course_name: str) -> None:
    """Create the course file with an empty set as its content."""
    guarantee_directory_existance("./Pickles/")
    course_filepath = f"./Pickles/{course_name}"
    with open(course_filepath, "wb+") as course_file:
        pickle.dump(set(), course_file, protocol=pickle.HIGHEST_PROTOCOL)

def is_pickle_file(course_filepath: str) -> bool:
    """Returns true if the file_path is a pickle file, or false if it doesn't."""
    is_valid_pickle_file = True
    with open(course_filepath, "rb") as file:
        try:
            # This will fail if the file hasn't been "pickle.dump"ed before
            pickle.load(file)
        except EOFError:
            is_valid_pickle_file = False

    return is_valid_pickle_file

def dump_post_ids(course_filepath: str, post_ids: set) -> None:
    """Dumps (sets) the post_ids into the course file"""
    with open(course_filepath, "wb") as file:
        pickle.dump(post_ids, file, protocol=pickle.HIGHEST_PROTOCOL)

def get_post_html(soup: BeautifulSoup, post_id: str) -> str:
    """Returns the HTML of a post given its post_id"""
    return str(soup.find(id=post_id))

def get_post_contents(soup: BeautifulSoup, post_ids: Set[str]) -> Set[str]:
    """Returns the set of HTML content given a set of post_ids"""
    return { get_post_html(soup, post_id) for post_id in post_ids }

def is_logged_in(session: Session) -> bool:
    """
    Return true or false depending on if the given Session is logged into Moodle.
    Does this by checking the footer of the page moodle page which indicates whether the user is logged in.
    """
    main_page_content = get_mainpage_content(session)
    soup              = BeautifulSoup(main_page_content, 'lxml')
    login_status      = soup.select_one(".logininfo").text

    if "You are logged in" in login_status:
        return True
    elif "You are not logged in" in login_status:
        return False
    else:
        raise Exception("Error while checking whether we are logged in. Investigate >.>")

def minutes_to_seconds(minutes: int) -> int:
    """Convert # minutes into # seconds and returns the # of seconds"""
    return minutes * 60

def hours_to_seconds(hours: int) -> int:
    """Convert # hours into # seconds and returns the # of seconds"""
    return hours * 60 * 60 

def get_scheduler_delay() -> int:
    """Get the scheduler delay from the given 'DELAY_HOURS', 'DELAY_MINUTES' and 'DELAY_SECONDS' present in the environment variables"""
    num_hours   = int(get_env_variable("DELAY_HOURS"))
    num_minutes = int(get_env_variable("DELAY_MINUTES"))
    num_seconds = int(get_env_variable("DELAY_SECONDS"))
    hours_in_seconds:   int = hours_to_seconds(num_hours)
    minutes_in_seconds: int = minutes_to_seconds(num_minutes)
    seconds:            int = num_seconds
    return hours_in_seconds + minutes_in_seconds + seconds

# TODO: Fetch & Notify = decouple somehow???
def fetch_and_notify(session: Session, scheduler: scheduler) -> None:
    print(f"[{get_formatted_time()}] Fetching everything", flush=True)
    
    # Check if the user is properly logged in
    while not is_logged_in(session):
        print("Not logged in, attempting to get a new session", flush=True)
        session = get_session(get_env_netname_credentials())

    # Fetch the course links
    course_links = get_course_links(session)
    print(f"Course links: {course_links}")

    # Go through each course's page
    for course_link in course_links:
        course_page_soup = BeautifulSoup(session.get(course_link).content, "lxml")
        course_name      = course_page_soup.select_one(".page-context-header").text
        posts            = course_page_soup.select("li[id^=module]")
        current_post_ids = { post.get("id") for post in posts }
        
        # Create course_file for this specific course if it does not exist
        course_filepath = f"./Pickles/{course_name}"
        if not file_exists(course_filepath) or not is_pickle_file(course_filepath):
            create_course_file(course_name)
        
        email_content = EmailContent(course_link, course_name, "")
        with open(course_filepath, "rb") as file: 
            # Find the differences between the current course post state and the previous one
            previous_post_ids: set = pickle.load(file)
            added_post_ids         = current_post_ids.difference(previous_post_ids)
            deleted_post_ids       = previous_post_ids.difference(current_post_ids)
            
            num_additions     = len(added_post_ids)
            num_deletions     = len(deleted_post_ids)
            should_send_email = num_additions > 0 or num_deletions > 0

            # Send an email if there are either post additions or post deletions 
            if should_send_email:
                # Build the email body
                if num_additions > 0:
                    email_content.content_body += "<h2>Added:</h2>\n"
                    email_content.content_body += "<hr>".join(get_post_contents(course_page_soup, added_post_ids))
                if num_deletions > 0:  
                    email_content.content_body += "<h2>Deleted:</h2>\n"
                    email_content.content_body += "<hr>".join(get_post_contents(course_page_soup, deleted_post_ids))
                
                email_subject = f"[{course_name}] +{num_additions} -{num_deletions}"
                # Send the email
                Email(email_subject, email_content).send(get_env_email_credentials(), getEnvEmailRecipients())
        # Update the current state in the course_file
        dump_post_ids(course_filepath, current_post_ids)

    scheduler.enter(get_scheduler_delay(), 1, fetch_and_notify, (session, scheduler))

    print(f"[{get_formatted_time()}] Done fetching and rescheduling.", end="\n\n", flush=True)
 
if __name__ == "__main__":
    try:
        if not file_exists(".env"):
            create_default_env_file()
        user_credentials = get_env_netname_credentials()
        session          = get_session(user_credentials)
        
        print(f"[{get_formatted_time()}] Starting scheduler", flush=True)
        scheduler = sched.scheduler()
        scheduler.enter(0, 1, fetch_and_notify, (session, scheduler))
        scheduler.run()
    except Exception as e:
        print(f"Exception:\n{e}", flush=True)
        # TODO: Handle exception somehow ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))

# Miscellaneous info
# Activities
# https://docs.moodle.org/311/en/Activities
# Resources
# https://docs.moodle.org/311/en/Resources
# Non-core packages (modules)
# https://docs.moodle.org/311/en/Scheduler_module
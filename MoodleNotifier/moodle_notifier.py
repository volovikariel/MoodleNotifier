#!/usr/bin/env python3.10
import pathlib
import pickle
import sched
import time
from sched import scheduler
from typing import List, Set

import requests
from bs4 import BeautifulSoup
from requests.models import Response
from requests.sessions import Session

from credentials import (NetnameCredentials, getEnvEmailCredentials,
                         getEnvNetnameCredentials)
from email_utils import Email, EmailContent, getEnvEmailRecipients
from utils import file_exists, get_formatted_time

MOODLE_LOGIN_PAGE = "https://moodle.concordia.ca/moodle/login/index.php"

def grant_session_iDP(response: Response, session: Session) -> Response:
    """Grants the current session an iDP by posting the SAMLResponse to a specific url."""
    soup         = BeautifulSoup(response.content, "lxml")
    # HTML contains a hidden form with a URL to POST to and the SAMLResponse value
    url          = soup.find("form").get("action")
    SAMLResponse = soup.find("input").get("value")
    response     = session.post(url, {"SAMLResponse": SAMLResponse})

    return response

def goto_login_page(response: Response, session: Session) -> Response:
    """We are going to the (Concordia) Netname login page"""
    # The "Click here to log in using your Netname" button's URL
    url      = BeautifulSoup(response.content, "lxml").select_one("a[href^='https://moodle.concordia.ca/moodle/auth/saml2/login.php']").get("href")
    response = session.get(url)
    
    return response

def login(response: Response, session: Session, credentials: NetnameCredentials) -> Response:
    """We are logging into the (Concorida) Netname login page with the given credentials"""
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
    """Returns a session whose cookies are fully set and ready to access Moodle"""
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
    MOODLE_PAGE = "https://moodle.concordia.ca/moodle/"
    return session.get(MOODLE_PAGE).content

def get_course_links(session: Session) -> List[str] or List[None]:
    """Returns the course links present in the sidebar"""
    moodle_page_content = get_mainpage_content(session)
    if len(BeautifulSoup(moodle_page_content, "lxml").select(".list-group-item .ml-1")) == 0:
        print(f"No links found: {moodle_page_content}", flush=True)

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
    """
    Returns true if the file_path is a pickle file, or false if it doesn't.
    """
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
    return str(soup.find(id=post_id))

def get_post_contents(soup: BeautifulSoup, post_ids: Set[str]) -> Set[str]:
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

# TODO: Fetch & Notify = separate functions
def fetch_and_notify(session: Session, scheduler: scheduler) -> None:
    print(f"[{get_formatted_time()}] Fetching everything", flush=True)
    
    # If we're not logged in, as indicated by the footer, we create ourselves a new session
    # TODO: Do this in another function before each fetch call
    while not is_logged_in(session):
        print(f"\n\nGetting a new session\n\n", flush=True)
        session = get_session(getEnvNetnameCredentials())

    course_links = get_course_links(session)
    print(f"Course links: {course_links}")

    # Geting all activity postings
    for course_link in course_links:
        course_page_soup = BeautifulSoup(session.get(course_link).content, "lxml")
        course_name      = course_page_soup.select_one(".page-context-header").text
        posts            = course_page_soup.select("li[id^=module]")
        post_ids         = { post.get("id") for post in posts }
        
        course_filepath = f"./Pickles/{course_name}"
        if not file_exists(course_filepath) or not is_pickle_file(course_filepath):
            create_course_file(course_name)
        
        email_content = EmailContent(course_link, course_name, "")
        # We check if the file contents match the current state
        with open(course_filepath, "rb") as file: 
            previous_post_ids: set = pickle.load(file)
            added_post_ids         = post_ids.difference(previous_post_ids)
            deleted_post_ids       = previous_post_ids.difference(post_ids)
            
            num_additions     = len(added_post_ids)
            num_deletions     = len(deleted_post_ids)
            should_send_email = num_additions > 0 or num_deletions > 0

            if num_additions > 0:
                email_content.content_body += "<h2>Added:</h2>\n"
                email_content.content_body += "\n".join(get_post_contents(course_page_soup, added_post_ids))
            
            if num_deletions > 0:
                email_content.content_body += "<h2>Deleted:</h2>\n"
                email_content.content_body += "\n".join(get_post_contents(course_page_soup, deleted_post_ids))

            if should_send_email:
                email_subject = f"[{course_name}] +{num_additions} -{num_deletions}"
                # Notify
                Email(email_subject, email_content).send(getEnvEmailCredentials(), getEnvEmailRecipients())

        # We dump the current post_ids so that we can check if posts were added/removed in the future
        dump_post_ids(course_filepath, post_ids)
           
    SECOND = 1
    MINUTE = 60*SECOND
    scheduler.enter(5*MINUTE, 1, fetch_and_notify, (session, scheduler))

    print(f"[{get_formatted_time()}] Done fetching and rescheduled", end="\n\n", flush=True)

def main() -> None:
    """Function which calls other functions"""
    user_credentials = getEnvNetnameCredentials()
    session          = get_session(user_credentials)
    # Scheduler calls a function that does the following:
        # while not logged in
            # Try to log in
        # Fetch the post_ids on each course
        # if file not exist
            # create file with empty {} as contents
                # creates folder if needed
        # Compare post_ids with existing file - pass the sets of new/deleted posts to a notify function which sends email or whatever other notification is set
    
    print(f"[{get_formatted_time()}] Starting scheduler", flush=True)
    scheduler = sched.scheduler()
    scheduler.enter(0, 1, fetch_and_notify, (session, scheduler))
    scheduler.run()

        
if __name__ == "__main__":
    try:
        # main()

        print(is_logged_in(None))
    except Exception as e:
        print(f"Exception:\n{e}", flush=True)

# Miscellaneous info
# Default page
# -------------
# Course links = [el.parentElement.href for el in $$(".list-group-item .ml-1")]

# Course page
# -------------
# Postings = $$("li[id^=module]")

# Activities
# https://docs.moodle.org/311/en/Activities
# Resources
# https://docs.moodle.org/311/en/Resources
# Non-core packages (modules)
# https://docs.moodle.org/311/en/Scheduler_module

from typing import Tuple

import requests
from bs4 import BeautifulSoup
from requests.models import Response
from requests.sessions import Session

from credentials import Credentials, getEnvCredentials

MOODLE_LOGIN_PAGE = "https://moodle.concordia.ca/moodle/login/index.php"

def grant_session_iDP(response: Response, session: Session) -> Response:
    """Grants the current session an iDP by posting the SAMLResponse to a specific url"""
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

def login(response: Response, session: Session, credentials: Credentials) -> Response:
    """We are logging into the (Concorida) Netname login page with the given credentials"""
    # The form POST method's action contains the URL to post to when we have entered our login information
    url        = BeautifulSoup(response.content, "lxml").select_one("form[action^='https://fas.concordia.ca:443']").get("action")
    login_info = {"UserName": credentials.username,"Password": credentials.password}
    response   = session.post(url, login_info)

    return response

def grant_session_MDL_SSP_AuthToken(response: Response, session: Session) -> Response:
    """Grants the current session an MDL_SSP_AuthToken cookie by simply posting to a specific URL with our SAMLResponse value"""
    soup         = BeautifulSoup(response.content, "lxml")
    url          = soup.find("form").get("action")
    SAMLResponse = soup.find("input").get("value")
    response     = session.post(url, {"SAMLResponse": SAMLResponse})

    return response

def get_session(credentials: Credentials) -> Session:
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

def main() -> None:
    """Function which calls other functions"""
    MOODLE_PAGE      = "https://moodle.concordia.ca/moodle/"
    user_credentials = getEnvCredentials()
    session          = get_session(user_credentials)

    # Writing the Moodle page to test that we're properly logged in (TODO: remove when no longer needed)
    with open("MoodlePage.html", "wb") as f:
        f.write(session.get(MOODLE_PAGE).content)

    # Default page
    # -------------
    # Course links = [el.parentElement.href for el in $$(".list-group-item .ml-1")]
    
    # Course page
    # -------------
    # Postings = $$(".activity")

    # Activities
    # https://docs.moodle.org/311/en/Activities
    # Resources
    # https://docs.moodle.org/311/en/Resources
    # Non-core packages (modules)
    # https://docs.moodle.org/311/en/Scheduler_module

if __name__ == "__main__":
    try: 
        main()
    except Exception as e:
        print(e)

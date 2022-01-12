Run `$ git clone -b v2 https://github.com/volovikariel/moodle-notifier.git` to clone this repo.

Alternatively, you should be able toswitch to this branch after cloning by running `$ git checkout v2` after running `$ git clone https://github.com/volovikariel/moodle-notifier.git`.

Then install all the dependencies by running 
`$ python3 -m pip -r requirements.txt`.

*note*: Run py -3 instead of python3 on Windows
*note*: You need python version 3+ to run the code so make sure to install that [here](https://www.python.org/downloads/)

Now try to run the program by running `$ python3 moodle_notifier.py` (this will generate you a `.env` file).

Do this inside the `.env` file:

Put in your concordia username.

Put in your concordia password.

Put in your email (only works with GMAIL).

Put in your email app password.
```
# How to get an app password (link: https://support.google.com/mail/answer/185833?hl=en-GB)
# 1. go to manage my google account (link: https://myaccount.google.com/security)
# 2. Under "Signing in to Google" confirm that "2-Step Verification" is "On" for the account.
# 3. Under "Signing in to Google" Select "App passwords".
# 4. Select the app as "Mail" and the device as "Other (Custom name)" and name it (e.g: moodle_notifications).
# 5. Copy the app password, it will be in a yellow box and looks like: "XXXX XXXX XXXX XXXX"
```
Put in the email(s) who you want to receive the notification emails.

Now put in the delay you'd like to have before a fetch happens. Note that very low times don't really make sense - more often isn't better here, it'll just spam the server. I recommend you set it to 10 minutes or so.

You can now try running the program by running `$ python3 moodle_notifier.py`

## Running the program in the background
### If you're on Linux or Mac OSX
You can run `$ nohup python3 moodle_notifier.py &` and then close the terminal and it'll run in the background.

If you ever want to kill the process you can do `$ ps -e | grep python3` and then do `$ kill -9 id_returned`.
*note:* If you have several programs running on `python3`, then I'm not sure how further help you narrow it down. I use `python3.10` and I never have other processes using it, so perhaps do the same?

### If you're on Windows
You can run `$ pythonw.exe moodle_notifier.py` in command prompt to run the process in the background.
To kill the process, you can open the task manager and kill `pythonw.exe`.

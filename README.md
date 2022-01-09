To switch to this branch, run `$ git checkout v2` after running `$ git clone https://github.com/volovikariel/moodle-notifier.git`.

Alternatively, you should be able to run `$ git clone -b v2 https://github.com/volovikariel/moodle-notifier.git` and not need to checkout.

Once you've cloned the repository, change directory into MoodleNotifier.

Then install all the dependencies by running 
`$ python3 -m pip install requests bs4 python-dotenv lxml`.

*note*: I only tested the code by using version 3+ of python so I recommend you do the same.

Paste this into a `.env` file which will lie in the same directory as your `.py` files.
```
USERNAME="concordia.ca\\..."
PASSWORD="CONCORDIA_PASSWORD_HERE"
EMAIL="example@gmail.com"
APP_PASSWORD="YOUR_GMAIL_APP_PASSWORD_HERE"
EMAIL_RECIPIENTS='["example@gmail.com"]'
DELAY_HOURS=0
DELAY_MINUTES=5
DELAY_SECONDS=0
```

Put in your concordia username.
Put in your concordia password.
Put in your email (only works with GMAIL right now).
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
### If you're on linux
You can run `$ nohup python3 moodle_notifier.py &` 
and then close the terminal and it'll run in the background.

If you ever want to kill the process you can do `$ps -e | grep python3` and then do `$ kill -9 id_returned`.
*note:* If you have several programs running on `python3`, then I'm not sure how further help you narrow it down. I use `python3.10` and I never have other processes using it, so perhaps do the same?

### If you're on MacOS
You can run `$ screen` then run `$ python3 moodle_notifier.py` and then press cmnd+A and then press D - it should be running in the background now.
If you ever want to kill the process - run `$ screen -x` to resume the screen in question and then type cmnd+Z (or cmnd+C or cmnd+D) to kill the python script.

Paste this into a `.env`file which will lie in the sam directory as your `.py` file.
```
USERNAME="concordia.ca\\..."
PASSWORD="CONCORDIA_PASSWORD_HERE"
EMAIL="example@gmail.com"
APP_PASSWORD="YOUR_GMAIL_APP_PASSWORD_HERE"
EMAIL_RECIPIENTS='["example@gmail.com", "optional_other_email@gmail.com"]'
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
Put in your email as a recipient and any of your friends who also want to be notified.

Try running the program by calling python3 or above (type hints don't seem to work for other versions?) by calling 

`$ python3 moodle_notifier.py`

If you get error messages saying that you don't have some modules installed, put in
`$ python3 -m pip install package_which_it_says_you_dont_have`

You'll have to do this a few times..sorry.

If you're on linux you can run 
`$ nohup python3 moodle_notifier.py &` 
and then close the terminal and it'll run in the background.
If you want to kill the process you can do 

`$ps -e | grep python3` and then do `$ kill -9 id_returned`
- do note that if you get several things returned, I don't really know how to help you kill the right one - good luck~

If you're on MacOS you can run 
`$ screen`
then run 
`$ python3 moodle_notifier.py`
and then press ctrl+A and then press D - it should be running in the background now.
If you ever want to resume the screen and kill the process - run `$ screen -x` and press ctrl+D or whatever else to kill the python script.

```
$ python3 -m pip install requests bs4 python-dotenv
```

## Pre-requisites:
Make sure you have the following installed: [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git), [python3+](https://www.python.org/downloads/)

## Setting up your environment

### Downloading the repository
To clone the repo run the following in your terminal. 
```bash
git clone https://github.com/volovikariel/moodle-notifier.git
``` 

### Installing the depdencies
Then install all dependencies required to run the script by by running the following in your terminal. 
```bash
python3 -m pip -r requirements.txt
```
NOTE: On Windows, you may have to use `py -3` instead of `python3` 

### Specifying your configuration
Run the following in your terminal to generate a `.env` file (which stores all your configuration).
```bash
python3 moodle_notifier.py
```
Inside the `.env` file, do the following:
1. Put in your concordia username.
2. Put in your concordia password.
3. Put in your email (only works with GMAIL).
4. Put in your email app password.
<details>
  <summary>How to get an app password</summary>
  
  1. go to [manage my google account](https://myaccount.google.com/security)
  2. Under "Signing in to Google" confirm that "2-Step Verification" is "On" for the account.
  3. Under "Signing in to Google" Select "App passwords".
  4. Select the app as "Mail" and the device as "Other (Custom name)" and name it (e.g: moodle_notifications).
  5. Copy the app password, it will be in a yellow box and looks like: "XXXX XXXX XXXX XXXX".
</details>
5. Put in the email(s) you want to receive the notifications.
6. Now put in the delay between fetches you'd like to have.

### Running the program
You can now try running the program by running 
```bash
python3 moodle_notifier.py
```

## Running the program in the background
### If you're on Linux or Mac OSX
You can run the following in your terminal before closing it to have the script run in the background.
```bash
nohup python3 moodle_notifier.py &
```

If you ever want to kill the process you can run the following in your terminal to first find the process id, and then kill that process.
```bash
ps -e | grep python3
``` 
```bash
kill -9 id_returned
```

*note:* If you have several programs running on `python3`, then I'm not sure how further help you narrow it down. I use `python3.10` and I never have other processes using it.

### If you're on Windows
You can run the following in your terminal to run the script in the background
```bash
pythonw.exe moodle_notifier.py
```

To kill the process, you can open the task manager and kill the process called `pythonw.exe`.

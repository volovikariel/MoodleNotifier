# :stopwatch:	 moodle-notifier :stopwatch:
###### :construction:		Currently in Alpha :construction:	
Application that sits cozily in your tray, checking for new document uploads/deletions on Moodle.

### :question:	How to install it :question:	
1. Go to [releases](https://github.com/volovikariel/Moodle_Notifier/releases/)
2. Select the latest release available for your operating system
3. Download and install the file (filetype specific instructions are written in `releases`)

### :question: How to run it :question:
###### Windows
Run the `.exe` file and it should now be accessible system wide [runnable by clicking the windows key and typing in moodle-notifier]

###### Linux (Ubuntu/Debian)
Type `$ sudo dpkg -i path/to/file.deb` in the CLI and it should be accessible system wide.
You can run it by typing in `moodle-notifier` in the CLI or in a  window switcher like `dmenu` or `rofi`. 

###### :warning:	MacOS (very unstable - no one with a Mac to test it :cry:)

### :exclamation: Note :exclamation:
Toggle the window's visibility by pressing `Control+Alt+w` or `Command+Alt+w`

# Contributing
Create `Issues` if there are features you want added or you notice some bugs.

Whether you want to refactor the code to make it more readable or add a new feature - fork the repository and send a pull request! 

Any help is appreciated :heart:

# Plans
**Version Milestone**|**Change**|**Status**</br>:x: or :construction: or :heavy_check_mark:
---|---|---
v0.2.0 | Write out the documentation | :x:
v0.2.5 | Have a separate tab in the program which allows the user to store links (for Zoom and such) | :x:
v??? | Have TODO lists built into the program | :x:
v??? | Automatic Github draft release when `$electron-forge make-[version]` is ran | :x:
v??? | Automatic update detection on new Github release | :x:
v1.0.0 | Fully working version written in Typescript | :x:

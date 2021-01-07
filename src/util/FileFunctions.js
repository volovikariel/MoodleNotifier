/*
 * This is a utility class with functions for interacting with files.
 */

const Constants = require('./Constants');
const fs = require('fs');

module.exports = {
    // Returns the contents of a file as an array - filled line by line.
    getFileLines(filePath) {
        const files = fs.readFileSync(filePath)
            .toString()
            .split('\n')
        if(files[files.length -1] === '') {
            files.splice(files.length - 1, 1);
        }
        return files;
    }
    ,
    getFirstLine() {
        return this.getFileLines(Constants.NOTIFICATIONLOG_FILEPATH)[0];
    },
    numOfLinesInFile(filePath) {
        return this.getFileLines(filePath).length;
    },
    /* Records changes for the 'state' of notifications [the list, which ones were dismissed, when were new ones added, etc.]
     * This is used for 'CTRL+Z' functionality to go back in states.
     * When the user reaches the notification limit's number of notifications, it starts replacing them in a Queue fashion.
     * First line that was added goes away, then a new one is added to the back.
     *
     * The last element can also be removed by pressing 'CTRL+Z'
     */
    saveNotificationState(state) {
        let numLines = this.numOfLinesInFile(Constants.NOTIFICATIONLOG_FILEPATH)
        // Append to end of file if we haven't reached the NOTIFICATION_LIMIT
        if(numLines < Constants.NOTIFICATION_LIMIT) {
            // If the file is just an empty line, don't add a \n
            fs.appendFileSync(Constants.NOTIFICATIONLOG_FILEPATH, `${(numLines === 0 && this.getFirstLine() === '') ? '' : '\n'}${JSON.stringify(state)}`, (err) => {
                if(err) console.error(err);
            })
        }
        // Remove the first line and append the latest notification instead if we've reached the NOTIFICATION_LIMIT
        else if(numLines >= Constants.NOTIFICATION_LIMIT){
            let updatedFile = this.getFileLines(Constants.NOTIFICATIONLOG_FILEPATH);
            updatedFile.shift()
            updatedFile = `${updatedFile.join('\n')}\n${JSON.stringify(state)}`

            fs.writeFileSync(Constants.NOTIFICATIONLOG_FILEPATH, updatedFile, (err) => {
                if(err) console.error(err);
            })
        }
    },
    getLastLine(filePath) {
        let fileLines = this.getFileLines(filePath);
        if(fileLines.length > 0) {
            return fileLines[fileLines.length - 1]
        }
        else {
            return []
        }
    },
    deleteLastLine(filePath) {
        const fileLines = this.getFileLines(filePath);
        fileLines.pop();
        if(fileLines.length > 0) {
            fs.writeFileSync(filePath, fileLines.join('\n'), (err) => {
                if(err) console.error(err)
            })
        }
    },
    // Return the list of contents of the file as json
    fileToJSON(filePath) {
        try {
            let data = fs.readFileSync(filePath);
            return JSON.parse(data);
        } 
        catch (err) {
            // File does not exist
            if(err.code === 'ENOENT') {
                console.error(`FILE '${filePath}' NOT FOUND`);
                return undefined;
            }
            console.error(`Some other error occured when trying to read ${filePath}: ${err}`);
        }
    },
    overwriteFile(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data));
    },
    appendFile(filePath, data) {
        fs.appendFile(filePath, `${new Date()}:\n${JSON.stringify(data)}\n\n`, (err) => {
            if(err) console.error(err);
        });
    },
    // Creates the files if they don't exist
    createFiles() {
        try {
            fs.writeFileSync(Constants.ENV_FILEPATH, `USERNAME=''\nPASSWORD=''`, { flag: 'wx' });
            fs.writeFileSync(Constants.NOTIFICATIONLOG_FILEPATH, '', { flag: 'wx' });
            fs.writeFileSync(Constants.DATALOG_FILEPATH, '', { flag: 'wx' });
            fs.writeFileSync(Constants.CURRENT_FILES_FILEPATH, '', { flag: 'wx' });
        } catch (err) {
            // Means the file already exists
        }
    }
}

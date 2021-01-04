/*
 * This is a utility class with functions for interacting with files.
 */

const Constants = require('./constants');
const fs = require('fs')

module.exports = {
    getFirstState() {
        const stateFileArray = fs.readFileSync(Constants.NOTIFICATIONLOG_FILEPATH)
            .toString()
            .split('\n')
        return stateFileArray[0]
    },
    numOfLinesInFile(fileName) {
        const stateFileArray = fs.readFileSync(fileName)
            .toString()
            .split('\n')
        if(stateFileArray[stateFileArray.length - 1] === '') {
            stateFileArray.splice(stateFileArray.length - 1, 1)
        }
        return stateFileArray.length
    },
    saveState(state) {
        let numLines = module.exports.numOfLinesInFile(Constants.NOTIFICATIONLOG_FILEPATH)
        // Append to end of file if we haven't reached the NOTIFICATION_LIMIT
        if(numLines < Constants.NOTIFICATION_LIMIT) {
            // If the file is just an empty line, don't add a \n
            fs.appendFileSync(Constants.NOTIFICATIONLOG_FILEPATH, `${(numLines === 0 && module.exports.getFirstState() === '') ? '' : '\n'}${JSON.stringify(state)}`, (err) => {
                if(err) console.error(err);
            })
        }
        // Remove the first line and append the latest notification instead if we've reached the NOTIFICATION_LIMIT
        else if(numLines >= Constants.NOTIFICATION_LIMIT){
            let updatedFile = fs.readFileSync(Constants.NOTIFICATIONLOG_FILEPATH)
                .toString()
                .split('\n')
            if(updatedFile[updatedFile.length - 1] === '') {
                updatedFile.splice(updatedFile.length - 1, 1)
            }
            updatedFile.shift()
            updatedFile = `${updatedFile.join('\n')}\n${JSON.stringify(state)}`

            fs.writeFileSync(Constants.NOTIFICATIONLOG_FILEPATH, updatedFile, (err) => {
                if(err) console.error(err);
            })
        }
    },
    getLastState() {
        let stateFileArray = fs.readFileSync(Constants.NOTIFICATIONLOG_FILEPATH)
            .toString()
            .split('\n')
        if(stateFileArray[stateFileArray.length - 1] === '') {
            stateFileArray.splice(stateFileArray.length - 1, 1)
        }
        if(stateFileArray.length > 0) {
            return stateFileArray[stateFileArray.length - 1]
        }
        else {
            return []
        }
    },
    deleteLastState() {
        const stateFileArray = fs.readFileSync(Constants.NOTIFICATIONLOG_FILEPATH)
            .toString()
            .split('\n')
        stateFileArray.splice(stateFileArray.length - 1, 1)
        // If you have no more previous states saved, do nothing
        if(stateFileArray.length === 0) {
            return;
        }
        fs.writeFileSync(Constants.NOTIFICATIONLOG_FILEPATH, stateFileArray.join('\n'), (err) => {
            if(err) console.error(err)
        })
    },
    readDataInFile() {
        try {
            let data = fs.readFileSync(Constants.CURRENT_FILES_FILEPATH);
            return JSON.parse(data);
        } 
        catch (err) {
            // File does not exist
            if(err.code === "ENOENT") {
                console.error(`FILE '${Constants.CURRENT_FILES_FILEPATH}' NOT FOUND`);
                return undefined;
            }
            console.error(`Some other error occured when trying to read ${Constants.CURRENT_FILES_FILEPATH}: ${err}`);
        }
    },
    saveDataInFile(data) {
        fs.writeFileSync(Constants.CURRENT_FILES_FILEPATH, `${JSON.stringify(data)}\n\n`);
    },
    logFileChanges(data) {
        fs.appendFile(Constants.DATALOG_FILEPATH, `${new Date()}:\n${JSON.stringify(data)}\n\n`, (err) => {
            if(err) console.error(err);
        });
    }
}

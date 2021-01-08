const path = require('path')
const { app } = require('electron');
module.exports = Object.freeze({
    // CONSTANTS
    FRONTEND_HTML_FILEPATH: `${app.getAppPath()}/../Frontend/index.html`,
    TRAYICON_DEFAULT_FILEPATH: `${app.getAppPath()}/../Frontend/aww.png`,
    TRAYICON_NOTIFICATION_FILEPATH: `${app.getAppPath()}/../Frontend/bunny_with_hat.jpg`,
    NOTIFICATIONLOG_FILEPATH: path.resolve(app.getPath('userData'), 'notifications.txt'),
    DATALOG_FILEPATH: path.resolve(app.getPath('userData'), 'data.txt'),
    CURRENT_FILES_FILEPATH: path.resolve(app.getPath('userData'), 'currentFiles.txt'),
    ENV_FILEPATH: path.resolve(app.getPath('userData'), '.env'),
    NOTIFICATION_LIMIT: 10,
    RATIO_WINDOW_TO_SCREEN: 1/3,
})

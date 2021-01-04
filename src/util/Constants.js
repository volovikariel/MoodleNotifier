const path = require('path')
module.exports = Object.freeze({
    // CONSTANTS
    FRONTEND_HTML_FILEPATH: path.resolve(__dirname, '../../Frontend/index.html'),
    NOTIFICATIONLOG_FILEPATH: path.resolve(__dirname, '../files/notifications.txt'),
    DATALOG_FILEPATH: path.resolve(__dirname, '../files/data.txt'),
    CURRENT_FILES_FILEPATH: path.resolve(__dirname, '../files/currentFiles.txt'),
    TRAYICON_DEFAULT_FILEPATH: path.resolve(__dirname, '../../Frontend/aww.png'),
    TRAYICON_NOTIFICATION_FILEPATH: path.resolve(__dirname, '../../Frontend/bunny_with_hat.jpg'),
    ENV_FILEPATH: path.resolve(__dirname, '../../.env'),
    NOTIFICATION_LIMIT: 10,
    RATIO_WINDOW_TO_SCREEN: 1/3,
})

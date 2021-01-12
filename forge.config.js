const path = require('path');

module.exports = {
  "name": "moodle-notifier-forge",

  "packagerConfig": {
    // If it returns true, it ignores the file
    "ignore": function(file) {
      const FILES_TO_IGNORE = ['.env', '.git', '.gitignore'];
      // Returns true if the file checked is in ignoredFiles
      return FILES_TO_IGNORE.includes(path.basename(file));
    },
    "icon": "icon"
  },

  "makers": [
    {
      "name": "@electron-forge/maker-squirrel",
      "config": {
        "name": "moodle-notifier"
      }
    },
    {
      "name": "@electron-forge/maker-deb",
      "config": {
        "maintainer": "Ariel Volovik"
      }
    }
  ],

  "publishers": [
    {
      "name": "@electron-forge/publisher-github",
      "config": {
        "repository": {
          "owner": "volovikariel",
          "name": "moodle-notifier"
        },
        "prerelease": true,
        "draft": true
      }
    }
  ],

}

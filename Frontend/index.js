const { ipcRenderer } = require('electron');
const { dialog } = require('electron').remote;
const fs = require('fs');
let notifications = []


document.querySelector('#audioNotificationSlider').addEventListener('input', () => {
  document.querySelector('audio').volume = document.querySelector('#audioNotificationSlider').value;
})

ipcRenderer.on('display-data', (event, args) => {
  if(args.append === true) {
    notifications = notifications.concat(args.notifications)
  }
  else {
    notifications = args.notifications
  }
  displayData(notifications)
});

function renderedFile(file, index) {
  return `
    <file-card id="${index}">
        <details>
          <summary>
            <header>
            ${file.change}</br>
            ${file.pageName}</br>
            ${file.sectionName}</br>
            </header>
          </summary>
          <div class="textDiv">
            Notification added at: ${file.date}</br>
            <a href="#" onclick="const { shell } = require('electron'); shell.openExternal('${file.link}')">${(file.change === 'ADDED') ? file.fileName : ''}</a>
          </div>
        </details>
        <div class="buttonDiv">
          <button class="dismissBtns">Dismiss</button>
        </div>
      </file-card>`
}

function displayData(data) {
  // Change tray icon based on data length
  if(data.length > 0) {
    ipcRenderer.send('setTrayIcon', 'notificationIcon')
  }
  else {
    ipcRenderer.send('setTrayIcon', 'defaultIcon')
  }

  let html = data.map((file, index) => renderedFile(file, index)).join('');

  document.querySelector('#container').innerHTML = html;
}

document.addEventListener('click', (event) => {
  if(event.target.matches('.dismissBtns')) {
    notifications.splice(event.target.closest('file-card').id, 1)
    displayData(notifications)
    ipcRenderer.send('saveState', notifications);
  }
  if(event.target.matches('.loginBtn')) {
    let username = document.querySelector('.username').value
    let password = document.querySelector('.password').value
    if(username === '' || password === '') {
      alert('Empty username or password, please re-enter valid ones')
      return;
    }
    setLoginFormVisibility(false);
    document.querySelector('.username').value = ''
    document.querySelector('.password').value = ''
    ipcRenderer.send('setLoginInfo', { USERNAME: username, PASSWORD: password })
  }

  if(event.target.matches('#changeUserBtn')) {
    if(document.querySelector('#loginForm').style.display === 'block') {
      setLoginFormVisibility(false)
    }
    else {
      setLoginFormVisibility(true)
    }
  }

  if(event.target.matches('#wantLoadAtStartup')) {
    ipcRenderer.send('setStartAtLogin', document.querySelector('#wantLoadAtStartup').checked)
  }

  if(event.target.matches('#removeAllNotificationsBtn')) {
    // Prevent the spamming of the 'removeAllNotifications' button leading to just a bunch of `[]`
    if(notifications.length > 0) {
      notifications = [];
      displayData(notifications);
      ipcRenderer.send('saveState', notifications);
    }
  }

  if(event.target.matches('#audioNotificationSoundBtn')) {
    let audioNotificationFilePath = dialog.showOpenDialogSync({
      properties: ['openFile'],
      filters: [{ name: 'audio file', extensions: ['wav', 'mp3', 'mp4']}]
    })
    // If it wasn't cancelled - set the path to this new one
    if(audioNotificationFilePath) {
      playNotificationAudio({ audioNotificationFilePath: audioNotificationFilePath[0], audioNotificationVolume: document.querySelector('#audioNotificationSlider').value });
    }
  }
})

ipcRenderer.on('setLoginFormVisibility', (event, args) => {
  document.querySelector('.username').value = '';
  document.querySelector('.password').value = '';
  setLoginFormVisibility(args.visible)
});

function setLoginFormVisibility(visible) {
  if(visible === true) {
    document.querySelector('#loginForm').style.display = 'block'
    document.querySelector('.username').focus();
  }
  else {
    document.querySelector('#loginForm').style.display = 'none'
  }
}

ipcRenderer.on('setLoggedInAs', (event, args) => {
  if(args.USERNAME) {
    document.querySelector('#loggedInAs').innerText = `Logged in as ${args.USERNAME}`;
  }
  // Just a message
  else if(args.MESSAGE) {
    document.querySelector('#loggedInAs').innerText = args.MESSAGE;
  }
});

ipcRenderer.on('alert', (event, args) => {
  alert(args);
});

ipcRenderer.on('setStartAtLoginIsEnabled', (event, args) => {
  document.querySelector('#wantLoadAtStartup').checked = args.isEnabled;
});

ipcRenderer.on('play-notification-audio', (event, args) => {
  let configJSON = args.json;
  // If the audioFilePath is set AND the path is correct, use it
  if(fs.existsSync(configJSON.audioNotificationFilePath)) {
    playNotificationAudio(configJSON)
  }
  else {
    playNotificationAudio()
  }
});

function playNotificationAudio(configJSON) {
  let filePath = configJSON.audioNotificationFilePath;
  let volume = configJSON.audioNotificationVolume;

  let audioNotificationSource = document.querySelector('#audioNotificationSource');
  let audioNotificationSoundBtn = document.querySelector('#audioNotificationSoundBtn');
  let audioNotificationSlider = document.querySelector('#audioNotificationSlider');
  let audio = document.querySelector('audio');

  // If there's a preset filepath in the Configuration file - load it, else - load the default
  if(filePath) {
    audioNotificationSource.src = filePath;
  }
  else {
    ipcRenderer.invoke('get-constants').then(Constants => {
      filePath = Constants.DEFAULT_NOTIFICATION_SOUND_FILEPATH;
    });
  }


  // If the filepath is valid, play the audio as a preview to the user
  if(fs.existsSync(filePath)) {
    // If it exists, set the colour back to normal
    audioNotificationSoundBtn.style.backgroundColor = 'white';
    // Need to load the new audio file
    audio.load();
    audio.volume = volume || 0.05;
    audioNotificationSlider.value = volume || 0.05;
    audio.play();
  }
  else {
    audioNotificationSoundBtn.style.backgroundColor = 'red';
  }
}

ipcRenderer.on('get-new-configuration', (event, args) => {
  // It's prefixed with file:// so ignore those 7 letters (0,1,...,6) and start directly at 7
  let audioNotificationFilePath = decodeURI(document.querySelector('#audioNotificationSource').src.substring(7));
  let audioNotificationVolume = document.querySelector('#audioNotificationSlider').value;

  let object = {};
  object.audioNotificationFilePath = audioNotificationFilePath;
  object.audioNotificationVolume = audioNotificationVolume;
  ipcRenderer.send('set-new-configuration', JSON.stringify(object));
});

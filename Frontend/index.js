const { ipcRenderer } = require("electron");
let notifications = []

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
})

ipcRenderer.on('setLoginFormVisibility', (event, args) => {
  document.querySelector('.username').value = '';
  document.querySelector('.password').value = '';
  setLoginFormVisibility(args.visible)
});

function setLoginFormVisibility(visible) {
  if(visible === true) {
    document.querySelector('#loginForm').style.display = 'block'
  }
  else {
    document.querySelector('#loginForm').style.display = 'none'
  }
}

ipcRenderer.on('alert', (event, args) => {
  alert(args);
});

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
          <a href="#" onclick="const { shell } = require('electron'); shell.openExternal('${file.link}')">${(file.change === 'Added') ? file.fileName : ''}</a>
          </div>
        </details>
        <div class="buttonDiv">
          <button class="dismissBtn">Dismiss</button>
        </div>
      </file-card>`
}

function displayData(data) {
  // Change tray icon based on data length
  if(data.length > 0) {
    ipcRenderer.send('setTrayIcon', 'notificationIcon')
  }
  else {
    ipcRenderer.send('setTrayIcon', 'default')
  }

  let html = data.map((file, index) => renderedFile(file, index)).join('');

  document.querySelector('#container').innerHTML = html;
}

document.addEventListener('click', (event) => {
  if(event.target.matches('.dismissBtn')) {
    notifications.splice(event.target.closest('file-card').id, 1)
    displayData(notifications)
    ipcRenderer.send('saveState', notifications);
  }
  if(event.target.matches('.loginBtn')) {
    let username = document.querySelector('.username').value
    let password = document.querySelector('.password').value
    if(username === '' || password === '') {
      ipcRenderer.send('log', 'Empty username/password')
      return;
    }
    toggleDisplayVisibility();
    document.querySelector('.username').value = ''
    document.querySelector('.password').value = ''
    ipcRenderer.send("setLoginInfo", { USERNAME: username, PASSWORD: password })
  }

  if(event.target.matches('#changeUser')) {
    toggleDisplayVisibility()
  }

  if(event.target.matches('#wantLoadAtStartup')) {
    ipcRenderer.send('setStartAtLogin', document.querySelector('#wantLoadAtStartup').checked)
  }
})

ipcRenderer.on('toggleHidden', (args) => {
  document.querySelector('.username').value = '';
  document.querySelector('.password').value = '';
  toggleDisplayVisibility()
});

function toggleDisplayVisibility() {
  if(document.querySelector('#signupForm').style.display == 'none') {
    document.querySelector('#signupForm').style.display = 'block'
  }
  else {
    document.querySelector('#signupForm').style.display = 'none'
  }
}

ipcRenderer.on('alert', (event, args) => {
  alert(args);
});

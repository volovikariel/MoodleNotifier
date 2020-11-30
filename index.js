const { ipcRenderer } = require("electron");

let notifications = []

ipcRenderer.on('display-data', (event, data) => {
  // Set up initial notifications before any dismissals
  notifications = notifications.concat(data)
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
          Date added: ${file.date}</br>
          <a href="#" onclick="const { shell } = require('electron'); shell.openExternal('${file.link}')">${file.fileName}</a>
          </div>
        </details>
        <div class="buttonDiv">
          <button class="dismissBtn">Dismiss</button>
        </div>
      </file-card>`
}

function displayData(data) {
  let html = data.map((file, index) => renderedFile(file, index)).join('');
  document.querySelector('#container').innerHTML = html;
}

document.addEventListener('click', (event) => {
  if(event.target.matches('.dismissBtn')) {
    notifications.splice(event.target.closest('file-card').id, 1)
    displayData(notifications)
  }
  if(event.target.matches('.loginBtn')) {
    let username = event.target.parentNode.querySelector('.username').value
    let password = event.target.parentNode.querySelector('.password').value
    ipcRenderer.send("setLoginInfo", {username: username, password: password})
  }

  if(event.target.matches('#changeUser')) {
    toggleHidden()
  }

})

ipcRenderer.on('toggleHidden', (args) => {
  document.querySelector('.username').value = '';
  document.querySelector('.password').value = '';
  toggleHidden()
});

function toggleHidden() {
  if(document.querySelector('#signupForm').style.visibility == 'hidden') {
    document.querySelector('#signupForm').style.visibility = 'visible'
  }
  else {
    document.querySelector('#signupForm').style.visibility = 'hidden'
  }
}

(function() {
  let isExitDialogShown = false;
  let exitDialogTimer = null;
  let isAuthenticated = false;
  let isExplicitExit = false;

  const isAndroid = /Android/i.test(navigator.userAgent);
  
  function checkAuthState() {
    return document.getElementById('chat-screen') && 
           document.getElementById('chat-screen').style.display !== 'none';
  }

  function createExitDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'exit-confirmation-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    
    const dialogContent = document.createElement('div');
    dialogContent.id = 'exit-dialog-content';
    dialogContent.style.cssText = `
      background-color: #2a2a2a;
      border-radius: 12px;
      padding: 25px;
      width: 85%;
      max-width: 320px;
      animation: dialogAppear 0.3s forwards;
      box-shadow: 0 5px 20px rgba(0,0,0,0.3);
      border-top: 3px solid #7289da;
    `;

    const dialogTitle = document.createElement('h3');
    dialogTitle.textContent = '¿Salir de WhatSapo?';
    dialogTitle.style.cssText = `
      margin: 0 0 15px 0;
      color: #e0e0e0;
      font-size: 18px;
      text-align: center;
    `;

    const dialogMessage = document.createElement('p');
    dialogMessage.textContent = '¿Estás seguro de que quieres salir de la aplicación?';
    dialogMessage.style.cssText = `
      margin: 0 0 20px 0;
      color: #aaa;
      font-size: 14px;
      text-align: center;
    `;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      gap: 10px;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    cancelButton.style.cssText = `
      flex: 1;
      padding: 12px;
      background-color: #444;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    `;
    cancelButton.addEventListener('click', handleCancelExit);

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Salir';
    confirmButton.style.cssText = `
      flex: 1;
      padding: 12px;
      background-color: #f04747;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    `;
    confirmButton.addEventListener('click', handleConfirmExit);

    dialog.addEventListener('click', function(e) {
      if (e.target === dialog) {
        e.stopPropagation();
        e.preventDefault();
        const content = document.getElementById('exit-dialog-content');
        if (content) {
          content.style.animation = 'dialogShake 0.4s';
          setTimeout(() => {
            content.style.animation = 'dialogAppear 0.3s forwards';
          }, 400);
        }
      }
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);

    dialogContent.appendChild(dialogTitle);
    dialogContent.appendChild(dialogMessage);
    dialogContent.appendChild(buttonContainer);
    dialog.appendChild(dialogContent);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes dialogAppear {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes dialogShake {
        0% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        50% { transform: translateX(10px); }
        75% { transform: translateX(-10px); }
        100% { transform: translateX(0); }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(dialog);

    setTimeout(() => {
      dialog.style.opacity = '1';
    }, 10);

    return dialog;
  }

  function showExitDialog() {
    if (isExitDialogShown) return;
    
    isExitDialogShown = true;
    createExitDialog();
  }

  function closeExitDialog() {
    const dialog = document.getElementById('exit-confirmation-dialog');
    if (dialog) {
      dialog.style.opacity = '0';
      setTimeout(() => {
        if (dialog && dialog.parentNode) {
          dialog.parentNode.removeChild(dialog);
        }
      }, 200);
    }
    
    isExitDialogShown = false;
    
    if (exitDialogTimer) {
      clearTimeout(exitDialogTimer);
      exitDialogTimer = null;
    }
  }

  function handleCancelExit() {
    closeExitDialog();
    
    history.pushState(null, null, window.location.href);
  }

  function handleConfirmExit() {
    isExplicitExit = true;
    closeExitDialog();
    
    window.removeEventListener('popstate', handlePopState, { capture: true });
    window.removeEventListener('beforeunload', handleBeforeUnload);
    
    const exitMessage = document.createElement('div');
    exitMessage.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.9);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      color: #fff;
      font-size: 18px;
    `;
    exitMessage.innerHTML = `
      <div style="margin-bottom: 20px;">Saliendo de WhatSapo...</div>
      <div class="spinner" style="
        width: 40px;
        height: 40px;
        border: 3px solid rgba(114, 137, 218, 0.3);
        border-radius: 50%;
        border-top-color: #7289da;
        animation: spin 0.8s linear infinite;
      "></div>
    `;
    
    document.body.appendChild(exitMessage);
    
    setTimeout(() => {
      try {
        window.location.href = "about:blank";
      } catch (e) {
        window.close();
      }
      
      setTimeout(() => {
        try {
          history.go(-4);
        } catch (e) {
          window.location.href = window.location.origin;
        }
      }, 200);
    }, 500);
  }

  function handlePopState(event) {
    isAuthenticated = checkAuthState();
    
    if (isAuthenticated) {
      window.history.pushState(null, null, window.location.href);
      
      if (!isExitDialogShown) {
        showExitDialog();
      } else {
        const content = document.getElementById('exit-dialog-content');
        if (content) {
          content.style.animation = 'dialogShake 0.4s';
          setTimeout(() => {
            content.style.animation = 'dialogAppear 0.3s forwards';
          }, 400);
        }
      }
    }
  }

  function isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement.tagName === 'INPUT' || 
           activeElement.tagName === 'TEXTAREA' || 
           activeElement.isContentEditable;
  }

  function handleBeforeUnload(e) {
    if (window.isManualRefresh) {
      return;
    }
    
    if (isAuthenticated && !isExplicitExit) {
      e.preventDefault();
      e.returnValue = '';

      if (!isExitDialogShown) {
        showExitDialog();
      }
      
      history.pushState(null, null, window.location.href);
      return '¿Estás seguro de que quieres salir?';
    }
  }

  function initBackButtonHandler() {
    if (!isAndroid) return;
    history.pushState(null, null, window.location.href);
    history.pushState(null, null, window.location.href);
    history.pushState(null, null, window.location.href);
    window.addEventListener('popstate', handlePopState, { capture: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    window.addEventListener('keydown', function(e) {
      if (isAuthenticated && e.key === 'Backspace' && !isInputFocused()) {
        e.preventDefault();
        if (!isExitDialogShown) {
          showExitDialog();
        }
      }
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initBackButtonHandler();
  } else {
    document.addEventListener('DOMContentLoaded', initBackButtonHandler);
  }

  document.addEventListener('DOMContentLoaded', function() {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'style') {
          isAuthenticated = checkAuthState();
        }
      });
    });
    
    const authScreen = document.getElementById('auth-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    if (authScreen) observer.observe(authScreen, { attributes: true });
    if (chatScreen) observer.observe(chatScreen, { attributes: true });
  });
  
  window.handleBeforeUnload = handleBeforeUnload;
  window.isExplicitExit = isExplicitExit;
})();
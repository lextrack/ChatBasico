document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando aplicación...');
    
    window.ChatApp = {
        version: '1.0.1',
        initialized: false,
        isOnline: navigator.onLine,
        debug: false,
        
        config: {
            messageLimit: 50,
            maxRetries: 3,
            retryInterval: 3000,
            encryptionEnabled: true,
            autoReconnect: true
        },
        
        state: {
            initRetries: 0,
            initializationState: 'pending',
            connectionError: null
        },
        
        init: function() {
            this.checkPrerequisites()
                .then(() => {
                    console.log('Verificación de prerequisitos completada');
                    this.setupEventListeners();
                    this.updateOnlineStatus();
                    this.state.initializationState = 'initialized';
                    this.initialized = true;
                })
                .catch(error => {
                    console.error('Error durante inicialización:', error);
                    this.state.initializationState = 'failed';
                    this.state.connectionError = error.message;
                    this.handleInitializationError(error);
                });
        },
        
        checkPrerequisites: function() {
            return new Promise((resolve, reject) => {
                // Verificar Firebase
                if (typeof firebase === 'undefined') {
                    return reject(new Error('Firebase no está cargado correctamente'));
                }

                if (!window.crypto || !window.crypto.subtle) {
                    return reject(new Error('Tu navegador no soporta encriptación segura (Web Crypto API)'));
                }

                try {
                    localStorage.setItem('testLocalStorage', '1');
                    localStorage.removeItem('testLocalStorage');
                } catch (e) {
                    return reject(new Error('No se puede acceder al almacenamiento local. Verifica la configuración de privacidad de tu navegador'));
                }

                resolve();
            });
        },

        handleInitializationError: function(error) {
            let errorMessage;
            
            switch (error.message) {
                case 'Firebase no está cargado correctamente':
                    errorMessage = 'No se pudo conectar al servidor. Por favor, verifica tu conexión a internet y recarga la página.';
                    if (this.state.initRetries < this.config.maxRetries) {
                        this.state.initRetries++;
                        console.log(`Reintentando cargar Firebase (intento ${this.state.initRetries}/${this.config.maxRetries})...`);
                        setTimeout(() => this.init(), this.config.retryInterval);
                        return;
                    }
                    break;
                    
                case 'Tu navegador no soporta encriptación segura (Web Crypto API)':
                    errorMessage = 'Tu navegador no soporta las funciones de seguridad necesarias. Por favor, usa un navegador moderno como Chrome, Firefox, Safari o Edge.';
                    break;
                    
                case 'No se puede acceder al almacenamiento local. Verifica la configuración de privacidad de tu navegador':
                    errorMessage = 'No se puede acceder al almacenamiento local. La aplicación requiere acceso a localStorage para funcionar. Por favor, verifica la configuración de privacidad de tu navegador.';
                    break;
                    
                default:
                    errorMessage = 'Ha ocurrido un error al inicializar la aplicación. Por favor, recarga la página.';
            }
            
            alert(errorMessage);
            
            const authScreen = document.getElementById('auth-screen');
            const errorElement = document.createElement('div');
            errorElement.className = 'initialization-error';
            errorElement.innerHTML = `
                <div class="error-icon">⚠️</div>
                <div class="error-message">${errorMessage}</div>
                <button class="retry-button">Reintentar</button>
            `;
            
            if (authScreen) {
                const authCard = authScreen.querySelector('.auth-card');
                if (authCard) {
                    authCard.insertBefore(errorElement, authCard.firstChild);

                    const retryButton = errorElement.querySelector('.retry-button');
                    if (retryButton) {
                        retryButton.addEventListener('click', () => {
                            errorElement.remove();
                            this.state.initRetries = 0;
                            this.init();
                        });
                    }
                }
            }
        },
        
        setupEventListeners: function() {
            window.addEventListener('online', () => this.updateOnlineStatus());
            window.addEventListener('offline', () => this.updateOnlineStatus());

            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && this.initialized) {
                    this.checkFirebaseConnection();
                }
            });
            
            window.addEventListener('beforeunload', (e) => {
                const isChatScreen = document.getElementById('chat-screen') && 
                                     document.getElementById('chat-screen').style.display !== 'none';

                if (isChatScreen && !window.backButtonHandlerDisabled && !window.isManualRefresh) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });
        },
        
        updateOnlineStatus: function() {
            this.isOnline = navigator.onLine;
            if (!this.isOnline && this.initialized) {
                console.log('Desconectado de la red');
                this.showConnectionStatus('offline');
            } else if (this.isOnline && this.initialized) {
                console.log('Conexión de red restaurada');
                this.checkFirebaseConnection();
                this.showConnectionStatus('online');
            }
        },

        checkFirebaseConnection: function() {
            if (!this.isOnline || !firebase.database) return;
            
            const connectedRef = firebase.database().ref(".info/connected");
            connectedRef.on("value", (snap) => {
                if (snap.val() === true) {
                    console.log("Conectado a Firebase");
                    this.showConnectionStatus('online');
                } else {
                    console.log("Desconectado de Firebase");
                    this.showConnectionStatus('firebase-offline');
                }
            });
        },
        
        showConnectionStatus: function(status) {
            let statusBar = document.getElementById('connection-status');
            
            if (!statusBar) {
                statusBar = document.createElement('div');
                statusBar.id = 'connection-status';
                document.body.appendChild(statusBar);
                
                const style = document.createElement('style');
                style.textContent = `
                    #connection-status {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        padding: 5px 10px;
                        text-align: center;
                        font-size: 14px;
                        font-weight: bold;
                        z-index: 9999;
                        display: none;
                        transition: all 0.3s ease;
                    }
                    #connection-status.online {
                        background-color:rgba(67, 181, 130, 0.75);
                        color: white;
                    }
                    #connection-status.offline {
                        background-color:rgba(240, 71, 71, 0.75);
                        color: white;
                    }
                    #connection-status.firebase-offline {
                        background-color:rgba(250, 168, 26, 0.75);
                        color: white;
                    }
                    #connection-status.show {
                        display: block;
                    }
                `;
                document.head.appendChild(style);
            }
            
            switch (status) {
                case 'online':
                    statusBar.textContent = 'Conexión restaurada';
                    statusBar.className = 'online show';
                    setTimeout(() => {
                        statusBar.classList.remove('show');
                    }, 3000);
                    break;
                    
                case 'offline':
                    statusBar.textContent = 'Sin conexión - Algunas funciones pueden no estar disponibles';
                    statusBar.className = 'offline show';
                    break;
                    
                case 'firebase-offline':
                    statusBar.textContent = 'Reconectando al servidor...';
                    statusBar.className = 'firebase-offline show';
                    break;
            }
        },
        
        toggleDebug: function(enable) {
            this.debug = enable;
            console.log(`Modo debug ${enable ? 'activado' : 'desactivado'}`);
        },
        log: function(...args) {
            if (this.debug) {
                console.log('[ChatApp]', ...args);
            }
        }
    };
    
    window.ChatApp.init();
});

(function() {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiCodePosition = 0;
    
    document.addEventListener('keydown', function(e) {
        if (e.key === konamiCode[konamiCodePosition]) {
            konamiCodePosition++;
            
            if (konamiCodePosition === konamiCode.length) {
                if (window.ChatApp) {
                    const newDebugState = !window.ChatApp.debug;
                    window.ChatApp.toggleDebug(newDebugState);
                    
                    const message = document.createElement('div');
                    message.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background-color: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 20px;
                        border-radius: 10px;
                        z-index: 9999;
                        font-size: 16px;
                        text-align: center;
                    `;
                    message.innerHTML = `<div>🎮 Modo debug ${newDebugState ? 'ACTIVADO' : 'DESACTIVADO'} 🎮</div>`;
                    document.body.appendChild(message);
                    
                    setTimeout(() => {
                        message.remove();
                    }, 3000);
                }
                
                konamiCodePosition = 0;
            }
        } else {
            konamiCodePosition = 0;
        }
    });
})();
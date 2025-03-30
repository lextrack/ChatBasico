const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const logoutBtn = document.getElementById('logout-btn');
const userInitial = document.getElementById('user-initial');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');

let authPending = false;

loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
});

function generateSalt() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function deriveKeyFromPassword(password, salt) {
    const passwordBuffer = new TextEncoder().encode(password);
    const saltBuffer = new TextEncoder().encode(salt);
    
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const key = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    
    const rawKey = await window.crypto.subtle.exportKey('raw', key);
    return Array.from(new Uint8Array(rawKey), byte => byte.toString(16).padStart(2, '0')).join('');
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (authPending) return;
    authPending = true;
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    registerError.textContent = '';
    
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Procesando...';
    submitBtn.disabled = true;
    
    try {
        const keyPair = await window.CryptoUtils.generateUserKeyPair();    
        const salt = generateSalt();
        const masterKey = await deriveKeyFromPassword(password, salt);
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        await database.ref('users/' + userCredential.user.uid).set({
            name: name,
            email: email,
            publicKey: keyPair.publicKey,
            salt: salt,
            securityVersion: 1
        });
        
        localStorage.setItem(`userPrivateKey_${userCredential.user.uid}`, keyPair.privateKey);
        localStorage.setItem(`userMasterKey_${userCredential.user.uid}`, masterKey);
        
        console.log('Usuario registrado exitosamente con claves de seguridad');
    } catch (error) {
        console.error('Error de registro:', error);
        registerError.textContent = "Ocurrio un error al registrarse o no tienes permiso";
        
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
        authPending = false;
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (authPending) return;
    authPending = true;
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    loginError.textContent = '';
    
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Iniciando sesión...';
    submitBtn.disabled = true;
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        const userSnapshot = await database.ref('users/' + userCredential.user.uid).once('value');
        const userData = userSnapshot.val() || {};
        
        if (userData.securityVersion && userData.salt) {
            const masterKey = await deriveKeyFromPassword(password, userData.salt);
            
            localStorage.setItem(`userMasterKey_${userCredential.user.uid}`, masterKey);
        } else {
            console.warn('Usuario sin configuración de seguridad actualizada');
            
            const keyPair = await window.CryptoUtils.generateUserKeyPair();
            const salt = generateSalt();
            const masterKey = await deriveKeyFromPassword(password, salt);
            
            await database.ref('users/' + userCredential.user.uid).update({
                publicKey: keyPair.publicKey,
                salt: salt,
                securityVersion: 1
            });
            
            localStorage.setItem(`userPrivateKey_${userCredential.user.uid}`, keyPair.privateKey);
            localStorage.setItem(`userMasterKey_${userCredential.user.uid}`, masterKey);
        }
    } catch (error) {
        console.error('Error de inicio de sesión:', error);
        loginError.textContent = "Credenciales incorrectas o no tienes permiso para acceder";
        
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
        authPending = false;
    }
});

logoutBtn.addEventListener('click', () => {
    if (typeof cleanupEverything === 'function') {
        cleanupEverything();
    } else if (window.cleanupEverything) {
        window.cleanupEverything();
    }
    
    const currentUser = auth.currentUser;
    if (currentUser) {
        const userId = currentUser.uid;
        
        localStorage.removeItem(`userMasterKey_${userId}`);
    }

    auth.signOut().catch((error) => {
        console.error('Error al cerrar sesión:', error);
    });
});

auth.onAuthStateChanged((user) => {
    console.log("Estado de autenticación cambiado:", user ? `Usuario: ${user.uid}` : "No hay usuario");
    
    if (user) {
        authScreen.style.display = 'none';
        chatScreen.style.display = 'flex';

        const loginBtn = loginForm.querySelector('button[type="submit"]');
        const registerBtn = registerForm.querySelector('button[type="submit"]');
        if (loginBtn) {
            loginBtn.textContent = 'Iniciar Sesión';
            loginBtn.disabled = false;
        }
        if (registerBtn) {
            registerBtn.textContent = 'Registrarse';
            registerBtn.disabled = false;
        }
        
        authPending = false;

        database.ref('users/' + user.uid).once('value')
            .then((snapshot) => {
                const userData = snapshot.val() || {};
                const displayName = userData.name || 'Usuario';
                
                userName.textContent = displayName;
                userEmail.textContent = user.email;
                userInitial.textContent = displayName.charAt(0).toUpperCase();
                
                console.log("Llamando a initChat desde auth.js");

                if (typeof window.initChat === 'function') {
                    window.initChat(user.uid, displayName);
                } else if (typeof initChat === 'function') {
                    initChat(user.uid, displayName);
                } else {
                    console.error("La función initChat no está disponible");
                }
            })
            .catch(error => {
                console.error("Error al obtener datos del usuario:", error);
            });
    } else {
        authScreen.style.display = 'flex';
        chatScreen.style.display = 'none';
        
        loginForm.reset();
        registerForm.reset();
        loginError.textContent = '';
        registerError.textContent = '';
    }
});
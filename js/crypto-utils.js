const CryptoUtils = (function() {
    const chatKeys = {};
    let userIdForKeys = null;
    
    function str2ab(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str).buffer;
    }
    
    function ab2str(buf) {
        const decoder = new TextDecoder();
        return decoder.decode(new Uint8Array(buf));
    }
    
    function ab2base64(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    function base642ab(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    async function generateChatKey() {
        const key = await window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
        
        const rawKey = await window.crypto.subtle.exportKey("raw", key);
        
        return {
            key,
            keyData: ab2base64(rawKey)
        };
    }
    
    async function importChatKey(keyData) {
        const rawKey = base642ab(keyData);
        
        return await window.crypto.subtle.importKey(
            "raw",
            rawKey,
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }
    
    async function encryptMessage(chatId, message) {
        let chatKeyObj = chatKeys[chatId];
        
        if (!chatKeyObj) {
            const savedKeyData = localStorage.getItem(`chatKey_${chatId}`);
            
            if (savedKeyData) {
                const importedKey = await importChatKey(savedKeyData);
                chatKeyObj = {
                    key: importedKey,
                    keyData: savedKeyData
                };
            } else {
                chatKeyObj = await generateChatKey();
                localStorage.setItem(`chatKey_${chatId}`, chatKeyObj.keyData);
            }
            
            chatKeys[chatId] = chatKeyObj;
        }
        
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const messageBuffer = str2ab(message);
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            chatKeyObj.key,
            messageBuffer
        );
        
        return {
            iv: ab2base64(iv),
            data: ab2base64(encryptedBuffer),
            keyData: chatKeyObj.keyData
        };
    }
    
    async function decryptMessage(chatId, encryptedMessage) {
        try {
            let chatKeyObj = chatKeys[chatId];
            
            let keyToUse;
            
            if (encryptedMessage.keyData) {
                keyToUse = await importChatKey(encryptedMessage.keyData);
                
                if (!chatKeyObj) {
                    localStorage.setItem(`chatKey_${chatId}`, encryptedMessage.keyData);
                    chatKeys[chatId] = {
                        key: keyToUse,
                        keyData: encryptedMessage.keyData
                    };
                }
            } 

            else if (chatKeyObj) {
                keyToUse = chatKeyObj.key;
            } 

            else {
                const savedKeyData = localStorage.getItem(`chatKey_${chatId}`);
                
                if (savedKeyData) {
                    keyToUse = await importChatKey(savedKeyData);
                    chatKeys[chatId] = {
                        key: keyToUse,
                        keyData: savedKeyData
                    };
                } 
                else {
                    console.log("No se encuentra clave local, intentando obtener clave compartida");
                    try {
                        const sharedKeyRef = await database.ref(`chatKeys/${chatId}/shared/encryptedKey`).once('value');
                        const sharedKeyData = sharedKeyRef.val();
                        
                        if (sharedKeyData) {
                            console.log("Clave compartida encontrada, intentando usar");
                            keyToUse = await importChatKey(sharedKeyData);
                            
                            localStorage.setItem(`chatKey_${chatId}`, sharedKeyData);
                            chatKeys[chatId] = {
                                key: keyToUse,
                                keyData: sharedKeyData
                            };
                        } else {
                            throw new Error("No hay clave compartida disponible");
                        }
                    } catch (keyError) {
                        console.error("Error al obtener clave compartida:", keyError);
                        throw new Error("No se encuentra la clave de encriptación para este chat");
                    }
                }
            }
            
            const iv = base642ab(encryptedMessage.iv);
            const data = base642ab(encryptedMessage.data);
            
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                keyToUse,
                data
            );
    
            return ab2str(decryptedBuffer);
        } catch (error) {
            console.error("Error al desencriptar mensaje:", error);
            return "[Mensaje encriptado - No se puede desencriptar]";
        }
    }

    async function getChatKeyForSharing(chatId) {
        const chatKeyObj = chatKeys[chatId];
        
        if (chatKeyObj) {
            return chatKeyObj.keyData;
        }
        
        const savedKeyData = localStorage.getItem(`chatKey_${chatId}`);
        if (savedKeyData) {
            const importedKey = await importChatKey(savedKeyData);
            chatKeys[chatId] = {
                key: importedKey,
                keyData: savedKeyData
            };
            return savedKeyData;
        }
        
        return null;
    }
    
    async function getUserPublicKey(userId) {
        try {
            let userPublicKeyRef = await database.ref(`users/${userId}/publicKey`).once('value');
            let publicKeyData = userPublicKeyRef.val();
            
            if (publicKeyData) {
                console.log(`Clave pública encontrada para usuario ${userId} en users/`);
                return publicKeyData;
            }
            
            userPublicKeyRef = await database.ref(`userKeys/${userId}/publicKey`).once('value');
            publicKeyData = userPublicKeyRef.val();
            
            if (publicKeyData) {
                console.log(`Clave pública encontrada para usuario ${userId} en userKeys/`);
                return publicKeyData;
            }
            
            console.warn(`No se encontró clave pública para usuario ${userId}`);
            return null;
        } catch (error) {
            console.error(`Error al obtener clave pública para usuario ${userId}:`, error);
            return null;
        }
    }
    
    async function encryptChatKeyForUser(chatId, userId) {
        try {
            const chatKeyData = await getChatKeyForSharing(chatId);
            if (!chatKeyData) {
                throw new Error(`No se pudo obtener la clave del chat ${chatId}`);
            }
            
            const userPublicKeyData = await getUserPublicKey(userId);
            if (!userPublicKeyData) {
                console.warn(`Usuario ${userId} no tiene clave pública, usando placeholder`);
                return {
                    encryptedKey: chatKeyData,
                    placeholder: true
                };
            }
            
            const publicKeyBuffer = base642ab(userPublicKeyData);
            const publicKey = await window.crypto.subtle.importKey(
                "spki",
                publicKeyBuffer,
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256"
                },
                false,
                ["encrypt"]
            );
            
            const chatKeyBuffer = base642ab(chatKeyData);
            const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                publicKey,
                chatKeyBuffer
            );
            
            return {
                encryptedKey: ab2base64(encryptedKeyBuffer),
                algorithm: "RSA-OAEP"
            };
        } catch (error) {
            console.error(`Error al encriptar clave para usuario ${userId}:`, error);
            
            return {
                encryptedKey: await getChatKeyForSharing(chatId),
                algorithm: "none",
                error: error.message
            };
        }
    }
    
    async function generateUserKeyPair() {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );

        const publicKeyData = await window.crypto.subtle.exportKey(
            "spki",
            keyPair.publicKey
        );

        const privateKeyData = await window.crypto.subtle.exportKey(
            "pkcs8",
            keyPair.privateKey
        );
        
        return {
            publicKey: ab2base64(publicKeyData),
            privateKey: ab2base64(privateKeyData)
        };
    }
    
    async function storeUserKeys(keyPair) {
        try {
            if (!userIdForKeys) {
                console.error("No hay usuario autenticado para guardar las claves");
                return false;
            }
            
            localStorage.setItem(`userPrivateKey_${userIdForKeys}`, keyPair.privateKey);
            
            const updates = {};
            updates[`users/${userIdForKeys}/publicKey`] = keyPair.publicKey;
            updates[`userKeys/${userIdForKeys}/publicKey`] = keyPair.publicKey;
            
            await database.ref().update(updates);
            console.log("Claves de usuario guardadas correctamente");
            return true;
        } catch (error) {
            console.error("Error al guardar claves de usuario:", error);
            
            try {
                await database.ref(`users/${userIdForKeys}/publicKey`).set(keyPair.publicKey);
                console.log("Clave pública guardada solo en path users/");
                return true;
            } catch (fallbackError) {
                console.error("Error en intento alternativo:", fallbackError);
                return false;
            }
        }
    }
    
    async function getUserKeys() {
        if (!userIdForKeys) {
            console.error("No hay ID de usuario para obtener claves");
            return null;
        }
        
        const privateKeyData = localStorage.getItem(`userPrivateKey_${userIdForKeys}`);
        
        if (!privateKeyData) {
            console.log("No hay claves de usuario, generando nuevas...");
            const newKeyPair = await generateUserKeyPair();
            await storeUserKeys(newKeyPair);
            return newKeyPair;
        }
        
        try {
            const publicKeyRef = await database.ref(`userKeys/${userIdForKeys}/publicKey`).once('value');
            const publicKeyData = publicKeyRef.val();
            
            if (publicKeyData) {
                return {
                    publicKey: publicKeyData,
                    privateKey: privateKeyData
                };
            } else {
                console.log("Clave pública no encontrada en Firebase, generando nuevas claves...");
                const newKeyPair = await generateUserKeyPair();
                await storeUserKeys(newKeyPair);
                return newKeyPair;
            }
        } catch (error) {
            console.error("Error al obtener clave pública:", error);
            return null;
        }
    }
    
    async function initUserEncryption() {
        try {
            if (!userIdForKeys) {
                console.error("Se requiere ID de usuario para inicializar encriptación");
                return false;
            }
            
            const userKeys = await getUserKeys();
            
            if (!userKeys) {
                console.error("No se pudieron obtener/generar claves de usuario");
                return false;
            }
            
            console.log("Claves de usuario inicializadas correctamente");
            return true;
        } catch (error) {
            console.error("Error al inicializar encriptación de usuario:", error);
            return false;
        }
    }
    
    function setUserId(userId) {
        if (!userId) {
            console.warn("Se intentó establecer un ID de usuario inválido");
            return false;
        }
        
        userIdForKeys = userId;
        console.log(`ID de usuario establecido: ${userId}`);
        return true;
    }
    
    return {
        encryptMessage,
        decryptMessage,
        getChatKeyForSharing,
        encryptChatKeyForUser,
        generateUserKeyPair,
        storeUserKeys,
        getUserKeys,
        initUserEncryption,
        setUserId
    };
})();

window.CryptoUtils = CryptoUtils;
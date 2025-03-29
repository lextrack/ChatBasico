const ChatEncryption = {
    setUserId(userId) {
      return CryptoUtils.setUserId(userId);
    },
  
    async initEncryption() {
      console.log("Inicializando sistema de encriptación...");
      
      if (!window.crypto || !window.crypto.subtle) {
        console.error("Tu navegador no soporta encriptación segura (Web Crypto API)");
        alert("Tu navegador no soporta todas las funciones de seguridad necesarias. Por favor, usa un navegador moderno como Chrome, Firefox, Safari o Edge.");
        return false;
      }
      
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith("chatKey_")) {
            const chatId = key.replace("chatKey_", "");
            console.log(`Cargando clave para chat: ${chatId}`);
          }
        }
        
        return true;
      } catch (error) {
        ChatUtils.handleFirebaseError("inicializar encriptación", error);
        return false;
      }
    },
  
    async initUserEncryption() {
      return CryptoUtils.initUserEncryption();
    },
  
    async encryptMessage(chatId, message) {
      return CryptoUtils.encryptMessage(chatId, message);
    },
  
    async decryptMessage(chatId, encryptedData) {
      return CryptoUtils.decryptMessage(chatId, encryptedData);
    },
  
    async getChatKeyForSharing(chatId) {
      return CryptoUtils.getChatKeyForSharing(chatId);
    },
  
    async encryptChatKeyForUser(chatId, userId) {
      return CryptoUtils.encryptChatKeyForUser(chatId, userId);
    },
  
    async generateUserKeyPair() {
      return CryptoUtils.generateUserKeyPair();
    }
  };
  
  window.ChatEncryption = ChatEncryption;
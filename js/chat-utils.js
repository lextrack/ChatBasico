const ChatUtils = {
    debugLog(message) {
      if (!state.debugMode) return;
      
      console.log(`[DEBUG] ${message}`);
      
      try {
        throw new Error("Stack trace");
      } catch (e) {
        console.log(e.stack.split("\n").slice(2, 5).join("\n"));
      }
    },
  
    sanitizeHTML(text) {
      const element = document.createElement('div');
      element.textContent = text;
      return element.innerHTML;
    },
  
    setTextContentSafely(element, text) {
      if (!element) return;
      
      if (!(element instanceof Element)) {
        console.error('El elemento proporcionado no es un elemento DOM válido');
        return;
      }
      
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
  
      element.textContent = text;
    },
  
    validateMessageInput(text) {
      if (!text || text.length > 10000) {
        return false;
      }
      
      const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+=/gi,
        /<iframe/gi,
        /document\.(location|cookie|write|open|execCommand)/gi,
        /eval\(/gi,
        /setTimeout\(/gi,
        /setInterval\(/gi,
        /new\s+Function\(/gi
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(text)) {
          console.warn(`Contenido potencialmente peligroso detectado: ${text.substring(0, 50)}...`);
          return false;
        }
      }
      
      return true;
    },
  
    implementCSP() {
      const metaCSP = document.createElement('meta');
      metaCSP.httpEquiv = 'Content-Security-Policy';
      metaCSP.content = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.firebaseio.com https://*.firebase.com; img-src 'self' data:; object-src 'none'";
      
      const head = document.querySelector('head');
      if (head && !document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        head.insertBefore(metaCSP, head.firstChild);
        console.log('CSP implementado correctamente');
      }
    },
  
    handleFirebaseError(operation, error) {
      console.error(`Error en ${operation}:`, error);
      return error;
    },
  
    isOnlyEmojis(text) {
      const trimmed = text.trim();
      
      if (!trimmed) return false;
      
      const nonEmojiRegex = /[^\p{Emoji}\s]/u;
      
      return !nonEmojiRegex.test(trimmed);
    }
  };
  
  window.ChatUtils = ChatUtils;
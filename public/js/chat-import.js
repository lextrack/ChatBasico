document.addEventListener('DOMContentLoaded', () => {
    const scriptOrder = [
      'js/chat-utils.js',
      'js/chat-encryption.js',
      'js/chat-firebase.js',
      'js/chat-messages.js',
      'js/chat-ui.js',
      'js/chat-participants.js',
      'js/chat-core.js'
    ];
  
    let scriptsLoaded = 0;
    
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        
        script.onload = () => {
          scriptsLoaded++;
          console.log(`Script cargado (${scriptsLoaded}/${scriptOrder.length}): ${src}`);
          resolve();
        };
        
        script.onerror = (error) => {
          console.error(`Error al cargar script: ${src}`, error);
          reject(error);
        };
        
        document.body.appendChild(script);
      });
    }
  
    async function loadScriptsSequentially() {
      try {
        console.log("Iniciando carga de módulos de chat...");
        
        for (const scriptSrc of scriptOrder) {
          await loadScript(scriptSrc);
        }
        
        console.log("Todos los módulos de chat cargados correctamente");
        
        if (typeof window.initChatSystem === 'function') {
          window.initChatSystem();
        }
      } catch (error) {
        console.error("Error al cargar módulos de chat:", error);
      }
    }
  
    loadScriptsSequentially();
  });
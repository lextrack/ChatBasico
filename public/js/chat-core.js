const CSS_CLASSES = {
  MESSAGE: 'message',
  SENT: 'sent',
  RECEIVED: 'received',
  ACTIVE: 'active',
  NEW: 'new',
  NO_MESSAGES: 'no-messages',
  NO_CHAT_SELECTED: 'no-chat-selected',
  UNREAD_BADGE: 'unread-badge',
  CURRENT_USER: 'current-user',
  LOADING_INDICATOR: 'loading-indicator'
};

const MESSAGES = {
  NO_CHAT_SELECTED: 'Selecciona una conversación para comenzar a chatear',
  NO_MESSAGES: 'No hay mensajes. ¡Sé el primero en escribir!',
  DECRYPTING: 'Desencriptando mensaje...',
  DECRYPT_ERROR: 'Error al desencriptar mensaje',
  NO_CONTENT: '[Mensaje sin contenido]'
};

const CONFIG = {
  SCROLL_THRESHOLD: 100,
  ANIMATION_DELAY: 300,
  BUTTON_COOLDOWN: 500,
  DEBOUNCE_TIME: 100,
  VERIFICATION_INTERVAL: 5 * 60 * 1000, // 5 minutos
  VERIFICATION_INITIAL_DELAY: 10000, // 10 segundos
  BADGE_MAX_COUNT: 99
};

let state = {
  currentUserId: null,
  currentUserName: null,
  currentChatId: null,
  currentMessagesRef: null,
  currentChatsRef: null,
  currentListeningChatId: null,
  previousListeningChatId: null,
  userChatsListener: null,
  messagesListener: null,
  debugMode: false, // DEBUG
  lastRenderedMessages: new Set(),
  renderPending: false,
  pendingMessages: [],
  lastReadMessages: {},
  unreadCounts: {},
  chatMessageListeners: {},
  updateBadgeTimers: {},
  messagesPerPage: 20,
  isLoadingMoreMessages: false,
  oldestMessageTimestamp: null,
  allMessagesLoaded: false,
  scrollToBottomOnNextRender: true,
  replyingTo: null
};

const elements = {
  chatList: document.getElementById('chat-list'),
  newChatBtn: document.getElementById('new-chat-btn'),
  newChatModal: document.getElementById('new-chat-modal'),
  newChatForm: document.getElementById('new-chat-form'),
  closeModal: document.querySelector('#new-chat-modal .close'),
  messagesContainer: document.getElementById('messages-container'),
  messageForm: document.getElementById('message-form'),
  messageInput: document.getElementById('message-input'),
  currentChatName: document.getElementById('current-chat-name'),
  chatInfoModal: document.getElementById('chat-info-modal'),
  chatInfoModalClose: document.querySelector('#chat-info-modal .close'),
  addUserForm: document.getElementById('add-user-form')
};

const firebaseRefs = {
  userChats: (userId) => database.ref(`userChats/${userId}`),
  messages: (chatId) => database.ref(`messages/${chatId}`),
  chat: (chatId) => database.ref(`chats/${chatId}`),
  participants: (chatId) => database.ref(`chatParticipants/${chatId}`),
  user: (userId) => database.ref(`users/${userId}`),
  users: () => database.ref('users'),
  readStatus: (userId) => database.ref(`userReadStatus/${userId}`),
  messagesSeen: (chatId, messageId, userId) => database.ref(`messagesSeen/${chatId}/${messageId}/${userId}`),
  serverTimeOffset: () => database.ref('.info/serverTimeOffset')
};

function initChat(userId, displayName) {
  console.log(`Inicializando chat para: ${displayName} (${userId})`);

  cleanupEverything();
  
  state.currentUserId = userId;
  state.currentUserName = displayName;

  ChatEncryption.setUserId(userId);
  console.log("Inicializando sistema de encriptación...");
  
  if (!window.crypto || !window.crypto.subtle) {
    console.error("Tu navegador no soporta encriptación segura (Web Crypto API)");
    alert("Tu navegador no soporta todas las funciones de seguridad necesarias. Por favor, usa un navegador moderno como Chrome, Firefox, Safari o Edge.");
    return;
  }

  Promise.resolve()
    .then(() => ChatEncryption.initEncryption())
    .then(encryptionSuccess => {
      if (!encryptionSuccess) {
        console.error("No se pudo inicializar el sistema de encriptación básico");
        return Promise.reject("Fallo en inicialización de encriptación básica");
      }
      
      return ChatEncryption.initUserEncryption();
    })
    .then(userEncryptionSuccess => {
      if (!userEncryptionSuccess) {
        console.warn("Advertencia: No se pudieron inicializar claves de usuario para compartir chats");
      }
      
      ChatFirebase.loadReadStatus();
      ChatUI.setupUIListeners();
      ChatFirebase.setupChatListListener();
      ChatFirebase.setupUnreadVerification();
      ChatUI.showNoChatSelected();
    })
    .catch(error => {
      ChatUtils.handleFirebaseError("inicialización del chat", error);
      alert("Ha ocurrido un error al inicializar el chat. Por favor, recarga la página.");
    });
}

function cleanupEverything() {
  console.log("Limpiando estado anterior del chat");
  
  if (state.replyingTo) {
    ChatMessages.clearReplyState();
  }
  
  if (database && database.ref) {
    database.ref().off();
  }
  
  ChatFirebase.removeFirebaseListener(
    state.userChatsListener, 
    state.currentChatsRef, 
    state.currentUserId ? firebaseRefs.userChats(state.currentUserId) : null
  );
  
  ChatFirebase.removeFirebaseListener(
    state.messagesListener, 
    state.currentMessagesRef, 
    state.currentListeningChatId ? firebaseRefs.messages(state.currentListeningChatId) : null
  );
  
  Object.keys(state.chatMessageListeners).forEach(chatId => {
    firebaseRefs.messages(chatId).off('child_added', state.chatMessageListeners[chatId]);
  });

  if (elements.messagesContainer) {
    elements.messagesContainer.removeEventListener('scroll', ChatMessages.handleMessagesScroll);
  }
  
  state.chatMessageListeners = {};
  state.messagesListener = null;
  state.userChatsListener = null;
  state.currentMessagesRef = null;
  state.currentChatsRef = null;
  state.currentListeningChatId = null;
  state.previousListeningChatId = null;
  state.lastRenderedMessages = new Set();
  state.renderPending = false;
  state.pendingMessages = [];
  
  state.oldestMessageTimestamp = null;
  state.allMessagesLoaded = false;
  state.isLoadingMoreMessages = false;
  
  elements.chatList.innerHTML = '';
  elements.messagesContainer.innerHTML = '';
  elements.currentChatName.textContent = '';
  
  state.currentChatId = null;
  
  elements.messageInput.disabled = true;
  elements.messageForm.querySelector('button').disabled = true;
  
  ChatUI.showNoChatSelected();
  
  ChatUtils.debugLog("FIN reseteo completo de Firebase");
}

window.initChat = initChat;
window.cleanupEverything = cleanupEverything;
window.elements = elements;
window.state = state;
window.CSS_CLASSES = CSS_CLASSES;
window.MESSAGES = MESSAGES;
window.CONFIG = CONFIG;
window.firebaseRefs = firebaseRefs;

window.addEventListener('beforeunload', function() {
  cleanupEverything();
});
const ChatFirebase = {
    calculateUnreadMessages(chatId, messages) {
      if (!chatId || !messages || !state.currentUserId) return 0;
      
      const lastReadTime = state.lastReadMessages[chatId] || 0;
      
      if (state.unreadCounts[chatId] === 0) {
        const sortedMessages = [...messages].sort((a, b) => a.message.timestamp - b.message.timestamp);
        const firstUnreadIndex = sortedMessages.findIndex(msg => 
          msg.message.senderId !== state.currentUserId && msg.message.timestamp > lastReadTime
        );
        
        if (firstUnreadIndex === -1) return 0;
        
        return sortedMessages.length - firstUnreadIndex;
      }
      
      return messages.filter(msg => {
        return msg.message.senderId !== state.currentUserId && 
                msg.message.timestamp > lastReadTime;
      }).length;
    },
  
    async markChatAsRead(chatId) {
      if (!chatId) return;
      
      try {
        const timeOffset = await firebaseRefs.serverTimeOffset().once('value');
        const offset = timeOffset.val() || 0;
        const serverTime = Date.now() + offset;
        
        state.lastReadMessages[chatId] = serverTime;
        state.unreadCounts[chatId] = 0;
        
        ChatUI.updateUnreadBadge(chatId, 0);
        
        this.saveReadStatus();
        
        console.log(`Chat ${chatId} marcado como leído en timestamp ${serverTime}`);
      } catch (error) {
        ChatUtils.handleFirebaseError(`marcar chat ${chatId} como leído`, error);
        setTimeout(() => this.saveReadStatus(), 5000);
      }
    },
  
    saveReadStatus() {
      if (!state.currentUserId) return;
      
      localStorage.setItem(`readStatus_${state.currentUserId}`, JSON.stringify(state.lastReadMessages));
      
      const updates = {};
      updates[`userReadStatus/${state.currentUserId}`] = state.lastReadMessages;
      
      database.ref().update(updates)
        .catch(error => {
          ChatUtils.handleFirebaseError("guardar estado de lectura en Firebase", error);
        });
    },
  
    loadReadStatus() {
      if (!state.currentUserId) return;
      
      const savedStatus = localStorage.getItem(`readStatus_${state.currentUserId}`);
      if (savedStatus) {
        state.lastReadMessages = JSON.parse(savedStatus);
      }
      
      firebaseRefs.readStatus(state.currentUserId).once('value')
        .then(snapshot => {
          const firebaseStatus = snapshot.val();
          if (firebaseStatus) {
            Object.keys(firebaseStatus).forEach(chatId => {
              if (!state.lastReadMessages[chatId] || firebaseStatus[chatId] > state.lastReadMessages[chatId]) {
                state.lastReadMessages[chatId] = firebaseStatus[chatId];
              }
            });
            
            localStorage.setItem(`readStatus_${state.currentUserId}`, JSON.stringify(state.lastReadMessages));
          }
        })
        .catch(error => {
          ChatUtils.handleFirebaseError("cargar estado de lectura desde Firebase", error);
        });
    },
  
    async verifyUnreadCounts() {
      try {
        const userChatsSnapshot = await firebaseRefs.userChats(state.currentUserId).once('value');
        const userChats = userChatsSnapshot.val() || {};
        
        for (const chatId in userChats) {
          const messagesSnapshot = await firebaseRefs.messages(chatId).once('value');
          const messages = messagesSnapshot.val() || {};
          
          const messagesArray = Object.keys(messages)
            .map(msgId => ({ id: msgId, message: messages[msgId] }));
          
          const calculatedUnread = this.calculateUnreadMessages(chatId, messagesArray);
          
          if (state.unreadCounts[chatId] !== calculatedUnread) {
            console.warn(`Corrigiendo contador de no leídos para chat ${chatId}: ${state.unreadCounts[chatId]} → ${calculatedUnread}`);
            state.unreadCounts[chatId] = calculatedUnread;
            ChatUI.updateUnreadBadge(chatId, calculatedUnread);
          }
        }
        
        this.saveReadStatus();
      } catch (error) {
        ChatUtils.handleFirebaseError("verificar contadores de no leídos", error);
      }
    },
  
    setupUnreadVerification() {
      setTimeout(this.verifyUnreadCounts.bind(this), CONFIG.VERIFICATION_INITIAL_DELAY);
      setInterval(this.verifyUnreadCounts.bind(this), CONFIG.VERIFICATION_INTERVAL);
    },
  
    setupChatMessageListener(chatId) {
      if (state.chatMessageListeners[chatId]) {
        firebaseRefs.messages(chatId).off('child_added', state.chatMessageListeners[chatId]);
        delete state.chatMessageListeners[chatId];
      }
      
      firebaseRefs.serverTimeOffset().once('value')
        .then(snapshot => {
          const offset = snapshot.val() || 0;
          const serverTime = Date.now() + offset;
          
          state.chatMessageListeners[chatId] = function(snapshot) {
            const message = snapshot.val();
            
            if (!message || !message.timestamp) return;
            
            if (chatId !== state.currentChatId && message.senderId !== state.currentUserId) {
              const lastReadTime = state.lastReadMessages[chatId] || 0;
              
              if (message.timestamp > lastReadTime) {
                state.unreadCounts[chatId] = (state.unreadCounts[chatId] || 0) + 1;
                ChatUI.updateUnreadBadge(chatId, state.unreadCounts[chatId]);
                ChatFirebase.saveReadStatus();
              }
            }
          };
          
          firebaseRefs.messages(chatId)
            .orderByChild('timestamp')
            .startAt(serverTime)
            .on('child_added', state.chatMessageListeners[chatId]);
        })
        .catch(error => {
          ChatUtils.handleFirebaseError(`configurar listener de mensajes para chat ${chatId}`, error);
        });
    },
  
    setupChatListListener() {
      console.log("Configurando listener para lista de chats");
      
      this.removeFirebaseListener(
        state.userChatsListener, 
        state.currentChatsRef, 
        state.currentUserId ? firebaseRefs.userChats(state.currentUserId) : null
      );
  
      Object.keys(state.chatMessageListeners).forEach(chatId => {
        firebaseRefs.messages(chatId).off('child_added', state.chatMessageListeners[chatId]);
        delete state.chatMessageListeners[chatId];
      });
      
      state.currentChatsRef = firebaseRefs.userChats(state.currentUserId);
      
      state.userChatsListener = state.currentChatsRef.on('value', async (snapshot) => {
        console.log("Recibida actualización de lista de chats");
        
        try {
          const userChats = snapshot.val() || {};
          
          elements.chatList.innerHTML = '';
          
          if (Object.keys(userChats).length === 0) {
            const noChatItem = document.createElement('div');
            noChatItem.className = 'chat-item';
            noChatItem.innerHTML = '<p>No tienes conversaciones</p>';
            elements.chatList.appendChild(noChatItem);
            
            if (!state.currentChatId) {
              ChatUI.showNoChatSelected();
            }
            
            return;
          }
          
          const chatsData = new Map();
          
          const chatPromises = Object.keys(userChats).map(async (chatId) => {
            try {
              const chatSnapshot = await firebaseRefs.chat(chatId).once('value');
              const chatData = chatSnapshot.val();
              
              if (chatData) {
                chatsData.set(chatId, chatData);
                this.setupChatMessageListener(chatId);
              }
            } catch (error) {
              ChatUtils.handleFirebaseError(`obtener datos del chat ${chatId}`, error);
            }
          });
          
          await Promise.all(chatPromises);
          
          this.renderChatList(chatsData);
          
          if (!state.currentChatId) {
            ChatUI.showNoChatSelected();
          }
        } catch (error) {
          ChatUtils.handleFirebaseError("listener de lista de chats", error);
          
          if (!state.currentChatId) {
            ChatUI.showNoChatSelected();
          }
        }
      });
    },
  
    renderChatList(chatsData) {
      console.log(`Renderizando ${chatsData.size} chats`);
      
      while (elements.chatList.firstChild) {
        elements.chatList.removeChild(elements.chatList.firstChild);
      }
      
      const sortedChats = Array.from(chatsData.entries())
        .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
      
      const chatPromises = sortedChats.map(async ([chatId, chatData]) => {
        try {
          const messagesSnapshot = await firebaseRefs.messages(chatId).once('value');
          const messages = messagesSnapshot.val() || {};
          
          const messagesArray = Object.keys(messages)
            .sort((a, b) => messages[a].timestamp - messages[b].timestamp)
            .map(msgId => ({ id: msgId, message: messages[msgId] }));
          
          const unreadCount = this.calculateUnreadMessages(chatId, messagesArray);
          state.unreadCounts[chatId] = unreadCount;
          
          return {
            chatId,
            chatData,
            unreadCount
          };
        } catch (error) {
          ChatUtils.handleFirebaseError(`obtener mensajes para ${chatId}`, error);
          return {
            chatId,
            chatData,
            unreadCount: 0
          };
        }
      });
      
      Promise.all(chatPromises).then(chatsWithUnreadCounts => {
        chatsWithUnreadCounts.forEach(({chatId, chatData, unreadCount}) => {
          const chatItem = document.createElement('div');
          chatItem.className = 'chat-item';
          chatItem.dataset.chatId = chatId;
          
          if (state.currentChatId === chatId) {
            chatItem.classList.add(CSS_CLASSES.ACTIVE);
          }
  
          const isCreator = chatData.createdBy === state.currentUserId;
  
          const chatHeader = document.createElement('div');
          chatHeader.className = 'chat-header';
          
          const chatNameContainer = document.createElement('div');
          chatNameContainer.className = 'chat-name-container';
          
          const chatName = document.createElement('h3');
          chatName.textContent = chatData.name;
          chatNameContainer.appendChild(chatName);
          
          if (unreadCount > 0) {
            const badge = document.createElement('div');
            badge.className = CSS_CLASSES.UNREAD_BADGE;
            badge.textContent = unreadCount > CONFIG.BADGE_MAX_COUNT ? `${CONFIG.BADGE_MAX_COUNT}+` : unreadCount;
            chatNameContainer.appendChild(badge);
          }
          
          chatHeader.appendChild(chatNameContainer);
          
          const chatActions = document.createElement('div');
          chatActions.className = 'chat-actions';
          
          const infoButton = document.createElement('button');
          infoButton.className = 'info-chat-btn';
          infoButton.title = 'Ver información';
          infoButton.innerHTML = '<i class="fas fa-info-circle"></i>';
          chatActions.appendChild(infoButton);
          
          if (!isCreator) {
            const leaveButton = document.createElement('button');
            leaveButton.className = 'leave-chat-btn';
            leaveButton.title = 'Salir del chat';
            leaveButton.innerHTML = '<i class="fa-solid fa-door-open"></i>';
            chatActions.appendChild(leaveButton);
          }

          
          chatHeader.appendChild(chatActions);
          chatItem.appendChild(chatHeader);
  
          const helpText = document.createElement('p');
          helpText.textContent = 'Toca para abrir';
          chatItem.appendChild(helpText);
          
          chatItem.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-chat-btn') || 
              e.target.closest('.delete-chat-btn')) {
              e.stopPropagation();
              ChatUI.confirmDeleteChat(chatId, chatData.name);
              return;
            }
            
            if (e.target.classList.contains('leave-chat-btn') || 
              e.target.closest('.leave-chat-btn')) {
              e.stopPropagation();
              const confirmed = confirm(`¿Estás seguro de que quieres salir de "${chatData.name}"?`);
              if (confirmed) {
                ChatParticipants.leaveChat(chatId, chatData.name);
              }
              return;
            }
            
            if (e.target.classList.contains('info-chat-btn') || 
              e.target.closest('.info-chat-btn')) {
              e.stopPropagation();
              ChatParticipants.showChatInfo(chatId, chatData);
              return;
            }
            
            ChatUI.selectChat(chatId, chatData.name);
            this.markChatAsRead(chatId);
          });
          
          elements.chatList.appendChild(chatItem);
        });
      });
    },
  
    removeFirebaseListener(listener, specificRef, genericRef) {
      if (!listener) return;
      
      if (specificRef) {
        try {
          specificRef.off('value', listener);
        } catch (e) {
          console.error("Error al eliminar listener específico:", e);
        }
      }
  
      if (genericRef) {
        try {
          genericRef.off('value', listener);
        } catch (e) {
          console.error("Error al eliminar listener por path:", e);
        }
        
        try {
          genericRef.off();
        } catch (e) {
          console.error("Error al eliminar todos los listeners:", e);
        }
      }
    }
  };
  
  window.ChatFirebase = ChatFirebase;
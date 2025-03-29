const ChatUI = {
    showNoChatSelected() {
      if (!elements.messagesContainer) return;
  
      if (elements.currentChatName) {
        elements.currentChatName.textContent = "Selecciona una conversación";
      }
      
      while (elements.messagesContainer.firstChild) {
        elements.messagesContainer.removeChild(elements.messagesContainer.firstChild);
      }
      
      const noChatDiv = document.createElement('div');
      noChatDiv.className = CSS_CLASSES.NO_CHAT_SELECTED;
      
      const noChatMessage = document.createElement('p');
      noChatMessage.textContent = MESSAGES.NO_CHAT_SELECTED;
      noChatDiv.appendChild(noChatMessage);
      
      elements.messagesContainer.appendChild(noChatDiv);
  
      if (elements.messageForm) {
        if (elements.messageInput) {
          elements.messageInput.disabled = true;
        }
        
        const sendButton = elements.messageForm.querySelector('button[type="submit"]');
        if (sendButton) {
          sendButton.disabled = true;
        }
      }
    },
  
    toggleModal(modal, show) {
      if (!modal) return;
      
      if (show) {
        modal.style.display = 'flex';
        modal.classList.add('modal-active');
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
          const modalContent = modal.querySelector('.modal-content');
          if (modalContent) {
            if (modalContent.offsetHeight > window.innerHeight * 0.9) {
              modalContent.style.alignSelf = 'flex-start';
              modalContent.style.marginTop = '5vh';
              modalContent.style.marginBottom = '5vh';
            } else {
              modalContent.style.alignSelf = 'center';
              modalContent.style.margin = '0';
            }
          }
        }, 10);
      } else {
        modal.classList.remove('modal-active');
        setTimeout(() => {
          modal.style.display = 'none';
          document.body.style.overflow = '';
        }, 300);
      }
    },
  
    updatePageTitleWithUnreadCount() {
      const totalUnread = Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);
      const originalTitle = document.title.replace(/^\(\d+\) /, '');
      
      if (totalUnread > 0) {
        document.title = `(${totalUnread}) ${originalTitle}`;
      } else {
        document.title = originalTitle;
      }
    },
  
    showNoMessagesIndicator() {
      while (elements.messagesContainer.firstChild) {
        elements.messagesContainer.removeChild(elements.messagesContainer.firstChild);
      }
      
      const noMessagesEl = document.createElement('div');
      noMessagesEl.className = CSS_CLASSES.NO_MESSAGES;
      noMessagesEl.textContent = MESSAGES.NO_MESSAGES;
      elements.messagesContainer.appendChild(noMessagesEl);
    },
  
    updateUnreadBadge(chatId, count) {
      console.log(`Actualizando badge para chat ${chatId}: ${count} mensajes no leídos`);
      
      if (state.updateBadgeTimers[chatId]) {
        clearTimeout(state.updateBadgeTimers[chatId]);
      }
      
      state.updateBadgeTimers[chatId] = setTimeout(() => {
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (!chatItem) {
          console.log(`No se encontró elemento visual para chat ${chatId}`);
          return;
        }
        
        const existingBadge = chatItem.querySelector(`.${CSS_CLASSES.UNREAD_BADGE}`);
  
        if (existingBadge && parseInt(existingBadge.textContent) === count) return;
        
        if (existingBadge) {
          existingBadge.remove();
        }
        
        if (count > 0) {
          const nameElement = chatItem.querySelector('.chat-name-container');
          if (nameElement) {
            const badge = document.createElement('div');
            badge.className = CSS_CLASSES.UNREAD_BADGE;
            badge.textContent = count > CONFIG.BADGE_MAX_COUNT ? `${CONFIG.BADGE_MAX_COUNT}+` : count;
            
            if (existingBadge) {
              badge.classList.add('badge-update');
            } else {
              badge.classList.add('badge-new');
            }
            
            nameElement.appendChild(badge);
            console.log(`Badge creado: ${count} mensajes`);
          } else {
            console.log('No se encontró contenedor para el badge');
          }
        }
        
        this.updatePageTitleWithUnreadCount();
        
        delete state.updateBadgeTimers[chatId];
      }, CONFIG.DEBOUNCE_TIME);
    },
  
    setupUIListeners() {
      elements.newChatBtn.removeEventListener('click', () => this.toggleModal(elements.newChatModal, true));
      elements.closeModal.removeEventListener('click', () => this.toggleModal(elements.newChatModal, false));
      elements.chatInfoModalClose.removeEventListener('click', () => this.toggleModal(elements.chatInfoModal, false));
      elements.newChatForm.removeEventListener('submit', ChatParticipants.handleNewChatSubmit);
      elements.messageForm.removeEventListener('submit', e => ChatMessages.handleMessageSubmit(e));
      elements.addUserForm.removeEventListener('submit', ChatParticipants.handleAddUserSubmit);
      
      elements.newChatBtn.addEventListener('click', () => {
        this.toggleModal(elements.newChatModal, true);
        ChatParticipants.loadUsersForNewChat();
      });
    
      window.addEventListener('focus', () => {
        if (document.title.startsWith('(')) {
          this.updatePageTitleWithUnreadCount();
        }
      });
      
      window.addEventListener('blur', () => {
        this.updatePageTitleWithUnreadCount();
      });
      
      elements.closeModal.addEventListener('click', () => this.toggleModal(elements.newChatModal, false));
      elements.chatInfoModalClose.addEventListener('click', () => this.toggleModal(elements.chatInfoModal, false));
      
      elements.newChatForm.addEventListener('submit', e => ChatParticipants.handleNewChatSubmit(e));
      elements.messageForm.addEventListener('submit', e => ChatMessages.handleMessageSubmit(e));
      elements.addUserForm.addEventListener('submit', e => ChatParticipants.handleAddUserSubmit(e));
      window.addEventListener('click', (e) => {
        if (e.target === elements.newChatModal) {
          this.toggleModal(elements.newChatModal, false);
        }
        if (e.target === elements.chatInfoModal) {
          this.toggleModal(elements.chatInfoModal, false);
        }
      });
    },
  
    selectChat(chatId, chatName) {
      ChatUtils.debugLog(`INICIO selectChat: ${chatName} (${chatId})`);
      
      if (state.replyingTo) {
        ChatMessages.clearReplyState();
      }
      
      if (state.currentChatId === chatId) {
        ChatUtils.debugLog(`Ya estamos en este chat, no hacemos nada`);
        return;
      }
    
      state.currentChatId = chatId;
      elements.currentChatName.textContent = chatName;
    
      document.querySelectorAll('.chat-item').forEach((item) => {
        item.classList.remove(CSS_CLASSES.ACTIVE);
      });
      
      const selectedChat = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
      if (selectedChat) {
        selectedChat.classList.add(CSS_CLASSES.ACTIVE);
      }
      
      elements.messageInput.disabled = false;
      elements.messageForm.querySelector('button').disabled = false;
      elements.messagesContainer.innerHTML = '';
      
      const noChat = document.querySelector(`.${CSS_CLASSES.NO_CHAT_SELECTED}`);
      if (noChat) {
        noChat.remove();
      }
      
      state.oldestMessageTimestamp = null;
      state.allMessagesLoaded = false;
      state.scrollToBottomOnNextRender = true;
      state.lastRenderedMessages = new Set();
      
      ChatUtils.debugLog(`Llamando a setupMessagesListener desde selectChat`);
      ChatMessages.setupMessagesListener(chatId);
      
      ChatFirebase.markChatAsRead(chatId);
      
      ChatUtils.debugLog(`FIN selectChat: ${chatName} (${chatId})`);
    },
  
    confirmDeleteChat(chatId, chatName) {
      console.log(`Confirmando eliminación del chat: ${chatName} (${chatId})`);
      
      const confirmed = confirm(`¿Estás seguro de que quieres eliminar la conversación "${chatName}"? Esta acción no se puede deshacer.`);
      
      if (confirmed) {
        ChatParticipants.deleteChat(chatId);
      }
    }
  };
  
  window.ChatUI = ChatUI;
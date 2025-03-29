const ChatMessages = {
  handleMessageSubmit(e) {
    e.preventDefault();
    
    ChatUtils.debugLog(`INICIO handleMessageSubmit`);
    
    if (!state.currentChatId || !elements.messageInput.value.trim()) {
      ChatUtils.debugLog(`No hay chat seleccionado o mensaje vacío`);
      return;
    }
    
    const messageText = elements.messageInput.value.trim();
    elements.messageInput.value = '';
    
    const submitButton = elements.messageForm.querySelector('button');
    submitButton.disabled = true;
    
    const replyData = state.replyingTo ? {
      messageId: state.replyingTo.id,
      senderId: state.replyingTo.senderId,
      senderName: state.replyingTo.senderName,
      text: state.replyingTo.text,
      timestamp: state.replyingTo.timestamp
    } : null;
    
    ChatMessages.clearReplyState();
    
    const isNewChat = elements.messagesContainer.childElementCount === 0 || 
                      elements.messagesContainer.querySelector('.no-messages');
    
    ChatUtils.debugLog(`Encriptando mensaje: "${messageText.substring(0, 20)}..."`);
    
    try {
      ChatEncryption.encryptMessage(state.currentChatId, messageText)
        .then(encryptedMessage => {
          const noMessagesEl = elements.messagesContainer.querySelector('.' + CSS_CLASSES.NO_MESSAGES);
          if (noMessagesEl) {
            elements.messagesContainer.innerHTML = '';
          }
          
          const messageData = {
            encrypted: true,
            data: encryptedMessage.data,
            iv: encryptedMessage.iv,
            keyData: encryptedMessage.keyData,
            senderId: state.currentUserId,
            senderName: state.currentUserName,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          };
          
          if (replyData) {
            messageData.replyTo = replyData;
          }
          
          database.ref(`messages/${state.currentChatId}`).push(messageData)
          .then((messageRef) => {
            ChatUtils.debugLog(`Mensaje encriptado enviado con éxito`);
            console.log("Mensaje encriptado enviado con éxito");
            
            if (isNewChat) {
              setTimeout(() => {
                database.ref(`messages/${state.currentChatId}/${messageRef.key}`).once('value')
                  .then(snapshot => {
                    const newMessage = snapshot.val();
                    if (newMessage) {
                      ChatMessages.createMessageElement(newMessage, messageRef.key)
                        .then(element => {
                          elements.messagesContainer.innerHTML = '';
                          elements.messagesContainer.appendChild(element);
                          ChatMessages.ensureScrollToBottom(true);
                        });
                    }
                  });
              }, 500);
            }
            
            if (state.currentChatId && (!state.messagesListener || state.lastRenderedMessages.size === 0)) {
              ChatMessages.setupMessagesListener(state.currentChatId);
            }
            
            setTimeout(() => {
              submitButton.disabled = false;
            }, CONFIG.BUTTON_COOLDOWN);
          })
          .catch((error) => {
            ChatUtils.handleFirebaseError('enviar mensaje encriptado', error);
            ChatUtils.debugLog(`Error al enviar mensaje: ${error.message}`);
            submitButton.disabled = false;
          });
        })
        .catch(error => {
          ChatUtils.handleFirebaseError('encriptación de mensaje', error);
          alert('Hubo un error al encriptar el mensaje. Por favor, inténtalo de nuevo.');
          submitButton.disabled = false;
        });
    } catch (error) {
      ChatUtils.handleFirebaseError('encriptación de mensaje', error);
      alert('Hubo un error al encriptar el mensaje. Por favor, inténtalo de nuevo.');
      submitButton.disabled = false;
    }
    
    ChatUtils.debugLog(`FIN handleMessageSubmit`);
  },

  setupMessagesListener(chatId) {
    console.log(`Configurando listener para mensajes del chat: ${chatId}`);
    
    state.previousListeningChatId = state.currentListeningChatId;
    
    if (state.currentListeningChatId === chatId && state.messagesListener) {
      return;
    }

    ChatFirebase.removeFirebaseListener(
      state.messagesListener, 
      state.currentMessagesRef, 
      state.previousListeningChatId ? firebaseRefs.messages(state.previousListeningChatId) : null
    );

    if (state.currentListeningChatId !== chatId) {
      state.lastRenderedMessages = new Set();
      state.oldestMessageTimestamp = null;
      state.allMessagesLoaded = false;
      state.scrollToBottomOnNextRender = true;
    }

    state.currentListeningChatId = chatId;
    state.currentMessagesRef = firebaseRefs.messages(chatId);

    this.loadInitialMessages(chatId);
    this.setupScrollListener();
  },

  loadInitialMessages(chatId) {
    state.isLoadingMoreMessages = true;
    
    state.currentMessagesRef
      .orderByChild('timestamp')
      .limitToLast(state.messagesPerPage)
      .once('value')
      .then((snapshot) => {
        console.log("Cargando mensajes iniciales");
        const messages = snapshot.val() || {};
        
        if (Object.keys(messages).length === 0) {
          ChatUI.showNoMessagesIndicator();
          state.isLoadingMoreMessages = false;
          state.allMessagesLoaded = true;
          return;
        }
        
        const messagesArray = Object.keys(messages)
          .map(msgId => ({ id: msgId, message: messages[msgId] }))
          .sort((a, b) => a.message.timestamp - b.message.timestamp);
        
        if (messagesArray.length > 0) {
          state.oldestMessageTimestamp = messagesArray[0].message.timestamp;
        }
        
        this.renderMessages(messagesArray);
        
        this.setupNewMessagesListener(chatId);
        
        if (state.currentChatId === chatId) {
          ChatFirebase.markChatAsRead(chatId);
        } else {
          const unreadCount = ChatFirebase.calculateUnreadMessages(chatId, messagesArray);
          state.unreadCounts[chatId] = unreadCount;
          ChatUI.updateUnreadBadge(chatId, unreadCount);
        }
        
        state.isLoadingMoreMessages = false;
      })
      .catch(error => {
        ChatUtils.handleFirebaseError("cargar mensajes iniciales", error);
        state.isLoadingMoreMessages = false;
      });
  },

  setupNewMessagesListener(chatId) {
    if (state.messagesListener) {
      state.currentMessagesRef.off('child_added', state.messagesListener);
    }
    
    const self = this;
    
    state.messagesListener = function(snapshot) {
      console.log("Nuevo mensaje recibido:", snapshot.key);
      const messageId = snapshot.key;
      const message = snapshot.val();
      
      if (!message || !message.timestamp) return;
      
      if (!state.lastRenderedMessages.has(messageId)) {
        console.log("Creando elemento de mensaje para:", messageId);
        self.createMessageElement(message, messageId)
          .then(element => {
            const noMessagesEl = elements.messagesContainer.querySelector('.' + CSS_CLASSES.NO_MESSAGES);
            if (noMessagesEl) {
              noMessagesEl.remove();
            }
            
            elements.messagesContainer.appendChild(element);
            state.lastRenderedMessages.add(messageId);
            
            if (message.senderId === state.currentUserId) {
              self.ensureScrollToBottom(true);
            } else {
              self.ensureScrollToBottom();
            }
            
            if (state.currentChatId === chatId) {
              ChatFirebase.markChatAsRead(chatId);
            } else {
              state.unreadCounts[chatId] = (state.unreadCounts[chatId] || 0) + 1;
              ChatUI.updateUnreadBadge(chatId, state.unreadCounts[chatId]);
            }
          })
          .catch(error => {
            console.error("Error al crear elemento de mensaje:", error);
          });
      }
    };
    
    state.currentMessagesRef
      .orderByChild('timestamp')
      .on('child_added', state.messagesListener);
  },

  loadMoreMessages() {
    if (state.isLoadingMoreMessages || state.allMessagesLoaded || !state.currentChatId) {
      return;
    }
    
    state.isLoadingMoreMessages = true;
    window.state = window.state || {};
    window.state.isLoadingMoreMessages = true;
    
    this.showLoadingIndicator();
    
    const scrollPos = elements.messagesContainer.scrollTop;
    const containerHeight = elements.messagesContainer.scrollHeight;
    
    state.currentMessagesRef
      .orderByChild('timestamp')
      .endBefore(state.oldestMessageTimestamp)
      .limitToLast(state.messagesPerPage)
      .once('value')
      .then((snapshot) => {
        console.log("Cargando más mensajes antiguos");
        
        const messages = snapshot.val() || {};
        const messagesCount = Object.keys(messages).length;
        
        if (messagesCount === 0) {
          this.removeLoadingIndicator();
          state.allMessagesLoaded = true;
          this.showAllMessagesLoadedIndicator();
          state.isLoadingMoreMessages = false;
          window.state.isLoadingMoreMessages = false;
          return;
        }
        
        const messagesArray = Object.keys(messages)
          .map(msgId => ({ id: msgId, message: messages[msgId] }))
          .sort((a, b) => a.message.timestamp - b.message.timestamp);
        
        if (messagesArray.length > 0) {
          state.oldestMessageTimestamp = messagesArray[0].message.timestamp;
        }
        
        const fragment = document.createDocumentFragment();

        Promise.all(
          messagesArray.map(async (msgData) => {
            const element = await this.createMessageElement(msgData.message, msgData.id);
            element.classList.add('message-old-loaded');
            return element;
          })
        ).then(messageElements => {
          const messagesObserver = window.messagesObserver;
          if (messagesObserver && typeof messagesObserver.disconnect === 'function') {
            messagesObserver.disconnect();
          }

          messageElements.forEach(element => {
            fragment.appendChild(element);
            state.lastRenderedMessages.add(element.dataset.messageId);
          });

          if (elements.messagesContainer.firstChild) {
            elements.messagesContainer.insertBefore(fragment, elements.messagesContainer.firstChild);
          } else {
            elements.messagesContainer.appendChild(fragment);
          }

          requestAnimationFrame(() => {
            const newHeight = elements.messagesContainer.scrollHeight;
            const heightDiff = newHeight - containerHeight;
            elements.messagesContainer.scrollTop = scrollPos + heightDiff;
            
            if (messagesObserver && typeof messagesObserver.observe === 'function' && elements.messagesContainer) {
              messagesObserver.observe(elements.messagesContainer, { childList: true });
            }

            setTimeout(() => {
              if (Math.abs(elements.messagesContainer.scrollTop - (scrollPos + heightDiff)) > 5) {
                console.log("Corrigiendo posición de scroll después de cargar mensajes antiguos");
                elements.messagesContainer.scrollTop = scrollPos + heightDiff;
              }
              
              this.removeLoadingIndicator();
              
              state.isLoadingMoreMessages = false;
              window.state.isLoadingMoreMessages = false;
            }, 50);
          });
        });
      })
      .catch(error => {
        ChatUtils.handleFirebaseError("cargar más mensajes", error);
        this.removeLoadingIndicator();
        state.isLoadingMoreMessages = false;
        window.state.isLoadingMoreMessages = false;
      });
  },

  async createMessageElement(message, messageId) {
    if (messageId) {
      state.lastRenderedMessages.add(messageId);
    }
    
    const isCurrentUser = message.senderId === state.currentUserId;
    
    const messageEl = document.createElement('div');
    messageEl.className = `${CSS_CLASSES.MESSAGE} ${isCurrentUser ? CSS_CLASSES.SENT : CSS_CLASSES.RECEIVED}`;
    messageEl.classList.add(CSS_CLASSES.NEW);
    
    if (messageId) {
      messageEl.dataset.messageId = messageId;
      messageEl.dataset.timestamp = message.timestamp;
      messageEl.dataset.senderId = message.senderId;
      messageEl.dataset.senderName = message.senderName;
    }
    
    const date = new Date(message.timestamp);
    const formattedTime = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    
    const self = this;
    const replyButton = document.createElement('button');
    replyButton.className = 'reply-button';
    replyButton.innerHTML = '<i class="fas fa-reply"></i>';
    replyButton.title = 'Responder';
    replyButton.onclick = function(e) {
      e.stopPropagation();
      self.setReplyToMessage(messageId, message);
    };
    messageBubble.appendChild(replyButton);

    if (message.replyTo) {
      const repliedMessage = document.createElement('div');
      repliedMessage.className = 'replied-message';
      
      const repliedAuthor = document.createElement('div');
      repliedAuthor.className = 'replied-message-author';
      repliedAuthor.textContent = message.replyTo.senderName || 'Usuario';
      repliedMessage.appendChild(repliedAuthor);
      
      const repliedContent = document.createElement('div');
      repliedContent.className = 'replied-message-content';
      
      repliedContent.textContent = message.replyTo.text || '[Contenido no disponible]';
      repliedMessage.appendChild(repliedContent);
      
      messageBubble.appendChild(repliedMessage);
    }

    const messageLoading = document.createElement('div');
    messageLoading.className = 'message-loading';
    messageLoading.textContent = MESSAGES.DECRYPTING;
    messageBubble.appendChild(messageLoading);
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';

    if (!isCurrentUser) {
      const senderNameSpan = document.createElement('span');
      senderNameSpan.textContent = message.senderName + ' - ';
      messageInfo.appendChild(senderNameSpan);
    }
    
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formattedTime;
    messageInfo.appendChild(timeSpan);
    
    messageEl.appendChild(messageBubble);
    messageEl.appendChild(messageInfo);
    
    if (message.encrypted) {
      try {
        const encryptedData = {
          data: message.data,
          iv: message.iv,
          keyData: message.keyData
        };
        
        const decryptedText = await ChatEncryption.decryptMessage(state.currentChatId, encryptedData);
        
        const loadingElement = messageBubble.querySelector('.message-loading');
        if (loadingElement) {
          loadingElement.remove();
        }

        const messageTextEl = document.createElement('div');
        messageTextEl.className = 'message-text';
        messageTextEl.textContent = decryptedText;
        messageBubble.appendChild(messageTextEl);
        
        messageEl.dataset.text = decryptedText;
     
        this.formatMessageContent(messageTextEl);
      } catch (error) {
        ChatUtils.handleFirebaseError('desencriptar mensaje', error);

        const loadingElement = messageBubble.querySelector('.message-loading');
        if (loadingElement) {
          loadingElement.remove();
        }
        
        const messageError = document.createElement('div');
        messageError.className = 'message-error';
        messageError.textContent = MESSAGES.DECRYPT_ERROR;
        messageBubble.appendChild(messageError);
      }
    } else {
      const loadingElement = messageBubble.querySelector('.message-loading');
      if (loadingElement) {
        loadingElement.remove();
      }
      
      const messageTextEl = document.createElement('div');
      messageTextEl.className = 'message-text';
      messageTextEl.textContent = message.text || MESSAGES.NO_CONTENT;
      messageBubble.appendChild(messageTextEl);
      
      messageEl.dataset.text = message.text || MESSAGES.NO_CONTENT;
      
      this.formatMessageContent(messageTextEl);
    }
    
    setTimeout(() => {
      messageEl.classList.remove(CSS_CLASSES.NEW);
    }, CONFIG.ANIMATION_DELAY);
    
    return messageEl;
  },

  formatMessageContent(messageElement) {
    const originalText = messageElement.textContent;
    
    if (ChatUtils.isOnlyEmojis(originalText)) {
      messageElement.setAttribute('data-only-emoji', 'true');
    }
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const fragment = document.createDocumentFragment();
    const parts = originalText.split(urlRegex);
    const urls = originalText.match(urlRegex) || [];
    
    let urlIndex = 0;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        const textNode = document.createTextNode(parts[i]);
        fragment.appendChild(textNode);
      }

      if (urlIndex < urls.length) {
        const url = urls[urlIndex++];
        
        try {
          const urlObj = new URL(url);
          if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
            const link = document.createElement('a');
            link.href = url;
            link.textContent = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            fragment.appendChild(link);
          } else {
            fragment.appendChild(document.createTextNode(url));
          }
        } catch (e) {
          fragment.appendChild(document.createTextNode(url));
        }
      }
    }
    
    while (messageElement.firstChild) {
      messageElement.removeChild(messageElement.firstChild);
    }
    
    messageElement.appendChild(fragment);
  },

  renderMessages(messages) {
    if (state.renderPending) {
      state.pendingMessages = [...state.pendingMessages, ...messages];
      return;
    }
    
    state.renderPending = true;

    requestAnimationFrame(async () => {
      elements.messagesContainer.innerHTML = '';
      
      if (messages.length === 0) {
        ChatUI.showNoMessagesIndicator();
      } else {
        const fragment = document.createDocumentFragment();
        
        const messageElements = await Promise.all(
          messages.map(async (msgData) => {
            return await this.createMessageElement(msgData.message, msgData.id);
          })
        );
        
        messageElements.forEach(element => {
          fragment.appendChild(element);
        });
        
        elements.messagesContainer.appendChild(fragment);
      }
      
      if (state.scrollToBottomOnNextRender) {
        this.ensureScrollToBottom(true);
        state.scrollToBottomOnNextRender = false;
      }
      
      state.renderPending = false;
      
      if (state.pendingMessages.length > 0) {
        const nextBatch = [...state.pendingMessages];
        state.pendingMessages = [];
        this.renderMessages(nextBatch);
      }
    });
  },

  ensureScrollToBottom(forceScroll = false) {
    if (!elements.messagesContainer || !elements.messagesContainer.lastElementChild) return;

    setTimeout(() => {
      const scrollPosition = elements.messagesContainer.scrollTop + elements.messagesContainer.clientHeight;
      const scrollThreshold = elements.messagesContainer.scrollHeight - CONFIG.SCROLL_THRESHOLD;
      
      const lastMessage = elements.messagesContainer.lastElementChild;
      const isOurMessage = lastMessage.classList.contains(CSS_CLASSES.SENT);
      
      if (forceScroll || scrollPosition >= scrollThreshold || isOurMessage) {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        
        setTimeout(() => {
          elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        }, 100);
      }
    }, 50);
  },

  showLoadingIndicator() {
    if (document.querySelector('.messages-loading-indicator')) {
      return;
    }
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'messages-loading-indicator';
    loadingIndicator.innerHTML = `
      <div class="spinner"></div>
      <span>Cargando mensajes anteriores...</span>
    `;
    
    if (elements.messagesContainer.firstChild) {
      elements.messagesContainer.insertBefore(loadingIndicator, elements.messagesContainer.firstChild);
    } else {
      elements.messagesContainer.appendChild(loadingIndicator);
    }
  },

  removeLoadingIndicator() {
    const loadingIndicator = document.querySelector('.messages-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  },

  showAllMessagesLoadedIndicator() {
    if (elements.messagesContainer.childElementCount <= 1 || 
        document.querySelector('.all-messages-loaded')) {
      return;
    }
    
    const indicador = document.createElement('div');
    indicador.className = 'all-messages-loaded';
    indicador.textContent = 'Principio de la conversación';
    
    if (elements.messagesContainer.firstChild) {
      elements.messagesContainer.insertBefore(indicador, elements.messagesContainer.firstChild);
    }
  },

  setupScrollListener() {
    elements.messagesContainer.removeEventListener('scroll', this.handleMessagesScroll);
    elements.messagesContainer.addEventListener('scroll', this.handleMessagesScroll.bind(this));
    elements.messagesContainer.addEventListener('touchend', () => {
      setTimeout(() => {
        if (elements.messagesContainer.scrollTop < 20 && 
            !state.isLoadingMoreMessages && 
            !state.allMessagesLoaded) {
          this.loadMoreMessages();
        }
      }, 100);
    });
  },

  handleMessagesScroll() {
    const scrollThreshold = 100;
    
    if (elements.messagesContainer.scrollTop < scrollThreshold && 
        !state.isLoadingMoreMessages && 
        !state.allMessagesLoaded) {
      
      const proximityToTop = 100 - elements.messagesContainer.scrollTop;
      const isHighPriority = proximityToTop > 80;
      
      if (isHighPriority) {
        ChatMessages.loadMoreMessages();
      } else {
        if (state.loadMoreMessagesTimer) {
          clearTimeout(state.loadMoreMessagesTimer);
        }
        
        state.loadMoreMessagesTimer = setTimeout(() => {
          if (elements.messagesContainer.scrollTop < scrollThreshold) {
            ChatMessages.loadMoreMessages();
          }
        }, 200);
      }
    }
  },

  setReplyToMessage(messageId, message) {
    const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    const text = messageEl.dataset.text || '[Contenido no disponible]';
    
    state.replyingTo = {
      id: messageId,
      senderId: message.senderId || messageEl.dataset.senderId,
      senderName: message.senderName || messageEl.dataset.senderName,
      text: text,
      timestamp: message.timestamp || messageEl.dataset.timestamp
    };
    
    this.updateReplyUI(state.replyingTo);
    
    elements.messageInput.focus();
  },

  updateReplyUI(replyData) {
    if (!document.querySelector('.reply-preview')) {
      const messageForm = elements.messageForm;
      const messageInput = elements.messageInput;
      
      if (!document.querySelector('.message-input-wrapper')) {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'message-input-wrapper';
        
        messageInput.parentNode.insertBefore(inputWrapper, messageInput);
        inputWrapper.appendChild(messageInput);
      }
      
      const replyPreview = document.createElement('div');
      replyPreview.className = 'reply-preview';
      replyPreview.style.display = 'none';
      
      replyPreview.innerHTML = `
        <div class="reply-preview-content">
          <div class="reply-preview-author">Respondiendo a Usuario</div>
          <div class="reply-preview-text">Texto del mensaje</div>
        </div>
        <button type="button" class="reply-preview-close">
          <i class="fas fa-times"></i>
        </button>
      `;
      
      const inputWrapper = document.querySelector('.message-input-wrapper');
      messageForm.insertBefore(replyPreview, inputWrapper);
      
      const self = this;
      replyPreview.querySelector('.reply-preview-close').addEventListener('click', function() {
        self.clearReplyState();
      });
    }
    
    const replyPreview = document.querySelector('.reply-preview');
    const authorEl = replyPreview.querySelector('.reply-preview-author');
    const textEl = replyPreview.querySelector('.reply-preview-text');
    
    authorEl.textContent = `Respondiendo a ${replyData.senderName}`;
    textEl.textContent = replyData.text;
    
    replyPreview.style.display = 'flex';
    
    document.querySelector('.message-input-wrapper').classList.add('reply-mode-active');
  },

  clearReplyState() {
    state.replyingTo = null;
    
    const replyPreview = document.querySelector('.reply-preview');
    if (replyPreview) {
      replyPreview.style.display = 'none';
    }
    
    const inputWrapper = document.querySelector('.message-input-wrapper');
    if (inputWrapper) {
      inputWrapper.classList.remove('reply-mode-active');
    }
  }
};

window.ChatMessages = ChatMessages;
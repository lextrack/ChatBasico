const ChatParticipants = {
  async createNewChat(chatName, selectedUsers) {
    console.log(`Creando nuevo chat: ${chatName} con ${selectedUsers.length} usuarios`);
    
    try {
      const newChatRef = database.ref('chats').push();
      const chatId = newChatRef.key;
      
      await newChatRef.set({
        name: chatName,
        createdBy: state.currentUserId,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      
      const updates = {};
      
      updates[`chatParticipants/${chatId}/${state.currentUserId}`] = true;
      updates[`userChats/${state.currentUserId}/${chatId}`] = true;
      
      selectedUsers.forEach(userId => {
        updates[`chatParticipants/${chatId}/${userId}`] = true;
        updates[`userChats/${userId}/${chatId}`] = true;
      });
      
      await database.ref().update(updates);
      console.log(`Chat creado exitosamente: ${chatId}`);
      
      setTimeout(() => {
        ChatUI.selectChat(chatId, chatName);
      }, 500);
  
      return chatId;
      
    } catch (error) {
      ChatUtils.handleFirebaseError('createNewChat', error);
      throw error;
    }
  },
  
  handleNewChatSubmit(e) {
    e.preventDefault();
    
    const chatName = document.getElementById('chat-name').value;
    const selectedUsers = Array.from(document.querySelectorAll('#user-selection input:checked'))
      .map(input => input.value);
    
    if (selectedUsers.length === 0) {
      alert('Por favor, selecciona al menos un usuario para chatear');
      return;
    }
    
    const submitButton = elements.newChatForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    
    ChatParticipants.createNewChat(chatName, selectedUsers)
      .then((chatId) => {
        elements.newChatForm.reset();
        ChatUI.toggleModal(elements.newChatModal, false);
        submitButton.disabled = false;
      })
      .catch((error) => {
        console.error('Error al crear chat:', error);
        submitButton.disabled = false;
      });
    },
  
    handleAddUserSubmit(e) {
      e.preventDefault();
      
      const selectedUsers = Array.from(document.querySelectorAll('#add-user-selection input:checked'))
        .map(input => input.value);
        
      if (selectedUsers.length === 0) {
        alert('Por favor, selecciona al menos un usuario para añadir');
        return;
      }
      
      const chatId = elements.addUserForm.dataset.chatId;
      ChatParticipants.addUsersToChat(chatId, selectedUsers);
    },
  
    loadUsersForNewChat() {
      const userSelectionDiv = document.getElementById('user-selection') || document.createElement('div');
      userSelectionDiv.id = 'user-selection';
      userSelectionDiv.innerHTML = '<p>Cargando usuarios...</p>';
      
      if (!document.getElementById('user-selection')) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.appendChild(userSelectionDiv);
        
        elements.newChatForm.insertBefore(formGroup, elements.newChatForm.querySelector('button'));
      }
      
      firebaseRefs.users().once('value')
        .then(snapshot => {
          const users = snapshot.val() || {};
          
          let usersToShow = Object.keys(users).filter(userId => userId !== state.currentUserId);
          
          if (usersToShow.length === 0) {
            userSelectionDiv.innerHTML = '<p>No hay otros usuarios disponibles</p>';
            return;
          }
  
          userSelectionDiv.innerHTML = `
            <div class="search-container">
              <i class="search-icon"></i>
              <input type="text" id="new-chat-search-input" placeholder="Buscar por nombre..." class="search-input">
              <button type="button" class="clear-search" title="Limpiar búsqueda">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <p class="selection-header">Selecciona usuarios para chatear:</p>
            <div id="new-chat-users-list" class="users-list"></div>
          `;
          
          const usersList = document.getElementById('new-chat-users-list');
  
          function highlightText(text, filter) {
            if (!filter.trim()) return text;
            
            const filterLower = filter.toLowerCase();
            const textLower = text.toLowerCase();
            
            if (!textLower.includes(filterLower)) return text;
            
            const startIndex = textLower.indexOf(filterLower);
            const endIndex = startIndex + filterLower.length;
            
            const before = text.substring(0, startIndex);
            const match = text.substring(startIndex, endIndex);
            const after = text.substring(endIndex);
            
            return `${before}<span class="highlight">${match}</span>${after}`;
          }
  
          function renderFilteredNewChatUsers(filter = '') {
            usersList.innerHTML = '';
            const fragment = document.createDocumentFragment();
            let userCount = 0;
            
            if (!filter.trim()) {
              const searchPrompt = document.createElement('div');
              searchPrompt.className = 'search-prompt';
              searchPrompt.innerHTML = `
                <p>Escribe en el buscador para encontrar usuarios</p>
              `;
              usersList.appendChild(searchPrompt);
              return;
            }
            
            const filteredUsers = usersToShow.filter(userId => 
              users[userId].name.toLowerCase().includes(filter.toLowerCase())
            );
            
            if (filteredUsers.length === 0) {
              const noResults = document.createElement('p');
              noResults.className = 'no-results';
              noResults.textContent = 'No se encontraron usuarios con ese nombre';
              usersList.appendChild(noResults);
              return;
            }
            
            filteredUsers.forEach((userId, index) => {
              const user = users[userId];
              const userCheckbox = document.createElement('div');
              userCheckbox.className = 'user-checkbox';
              userCheckbox.innerHTML = `
                <label>
                  <input type="checkbox" value="${userId}">
                  <div class="user-info-container">
                    <div class="user-name">${highlightText(user.name, filter)}</div>
                    <div class="user-email">${user.email || 'Sin email'}</div>
                  </div>
                </label>
              `;
              fragment.appendChild(userCheckbox);
              userCount++;
              
              setTimeout(() => {
                userCheckbox.classList.add('fade-in');
              }, index * 30);
            });
            
            usersList.appendChild(fragment);
  
            if (filter.trim()) {
              const resultsInfo = document.createElement('div');
              resultsInfo.className = 'results-info';
              resultsInfo.textContent = `Mostrando ${userCount} resultado${userCount !== 1 ? 's' : ''}`;
              usersList.insertBefore(resultsInfo, usersList.firstChild);
            }
          }
          
          renderFilteredNewChatUsers('');
          
          const searchInput = document.getElementById('new-chat-search-input');
          let debounceTimer;
          
          searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              renderFilteredNewChatUsers(this.value.trim());
            }, 300);
          });
          
          searchInput.addEventListener('focus', function() {
            if (this.value) {
              this.select();
            }
          });
          
          const clearButton = userSelectionDiv.querySelector('.clear-search');
          clearButton.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.focus();
            renderFilteredNewChatUsers('');
          });
        })
        .catch(error => {
          ChatUtils.handleFirebaseError("cargar usuarios", error);
          userSelectionDiv.innerHTML = '<p>Error al cargar usuarios</p>';
        });
    },
  
    async showChatInfo(chatId, chatData) {
      console.log(`Mostrando información del chat: ${chatData.name} (${chatId})`);
      
      elements.addUserForm.dataset.chatId = chatId;
  
      const chatNameElement = document.getElementById('info-chat-name');
      if (chatNameElement) {
        chatNameElement.textContent = chatData.name;
      }
  
      let creationDate = 'Desconocida';
      if (chatData.createdAt) {
        const date = new Date(chatData.createdAt);
        creationDate = date.toLocaleString();
      }
      
      const chatDateElement = document.getElementById('info-chat-date');
      if (chatDateElement) {
        chatDateElement.textContent = creationDate;
      }
      
      this.setupLeaveButton(chatId, chatData);
      
      try {
        const creatorElement = document.getElementById('info-chat-creator');
        if (creatorElement) {
          while (creatorElement.firstChild) {
            creatorElement.removeChild(creatorElement.firstChild);
          }
          
          const loadingIndicator = document.createElement('span');
          loadingIndicator.className = CSS_CLASSES.LOADING_INDICATOR;
          loadingIndicator.textContent = 'Cargando...';
          creatorElement.appendChild(loadingIndicator);
        }
        
        const creatorSnapshot = await firebaseRefs.user(chatData.createdBy).once('value');
        const creatorData = creatorSnapshot.val() || {};
        
        if (creatorElement) {
          while (creatorElement.firstChild) {
            creatorElement.removeChild(creatorElement.firstChild);
          }
          
          let creatorName = creatorData.name || 'Usuario desconocido';
          if (chatData.createdBy === state.currentUserId) {
            creatorName += ' (Tú)';
            
            const creatorLabel = document.getElementById('creator-label');
            if (creatorLabel) {
              creatorLabel.classList.add(CSS_CLASSES.CURRENT_USER);
            }
          } else {
            const creatorLabel = document.getElementById('creator-label');
            if (creatorLabel) {
              creatorLabel.classList.remove(CSS_CLASSES.CURRENT_USER);
            }
          }
          
          creatorElement.textContent = creatorName;
        }
      } catch (error) {
        ChatUtils.handleFirebaseError('obtener datos del creador', error);
        
        const creatorElement = document.getElementById('info-chat-creator');
        if (creatorElement) {
          creatorElement.textContent = 'No disponible';
        }
      }
  
      const participantsList = document.getElementById('participants-list');
      if (participantsList) {
        while (participantsList.firstChild) {
          participantsList.removeChild(participantsList.firstChild);
        }
        
        const loadingItem = document.createElement('li');
        loadingItem.className = 'loading-item';
        loadingItem.textContent = 'Cargando participantes...';
        participantsList.appendChild(loadingItem);
      }
      
      const userSelection = document.getElementById('add-user-selection');
      if (userSelection) {
        while (userSelection.firstChild) {
          userSelection.removeChild(userSelection.firstChild);
        }
        
        const loadingText = document.createElement('p');
        loadingText.className = 'loading-text';
        loadingText.textContent = 'Cargando usuarios disponibles...';
        userSelection.appendChild(loadingText);
      }
      
      ChatUI.toggleModal(elements.chatInfoModal, true);
      
      this.loadChatParticipants(chatId);
      this.loadAvailableUsersForChat(chatId);
    },
  
    setupLeaveButton(chatId, chatData) {
      const leaveButton = document.getElementById('leave-chat-btn');
      if (!leaveButton) return;
      
      if (chatData.createdBy === state.currentUserId) {
        leaveButton.textContent = 'Eliminar y salir';
        leaveButton.classList.add('delete-action');
      } else {
        leaveButton.textContent = 'Salir del chat';
        leaveButton.classList.remove('delete-action');
      }
      
      if (leaveButton.clickHandler) {
        leaveButton.removeEventListener('click', leaveButton.clickHandler);
      }
      
      leaveButton.clickHandler = () => {
        ChatUI.toggleModal(elements.chatInfoModal, false);
        setTimeout(() => {
          this.leaveChat(chatId, chatData.name);
        }, 300);
      };
      
      leaveButton.addEventListener('click', leaveButton.clickHandler);
    },
  
    async loadChatParticipants(chatId) {
      const participantsList = document.getElementById('participants-list');
      participantsList.innerHTML = '<li>Cargando participantes...</li>';
      
      try {
        const participantsSnapshot = await firebaseRefs.participants(chatId).once('value');
        const participants = participantsSnapshot.val() || {};
        
        if (Object.keys(participants).length === 0) {
          participantsList.innerHTML = '<li>No hay participantes</li>';
          return;
        }
        
        const participantPromises = Object.keys(participants).map(async (userId) => {
          const userSnapshot = await firebaseRefs.user(userId).once('value');
          return {
            id: userId,
            data: userSnapshot.val() || { name: 'Usuario desconocido' }
          };
        });
        
        const participantsData = await Promise.all(participantPromises);
        
        participantsList.innerHTML = '';
        participantsData.forEach(participant => {
          const listItem = document.createElement('li');
          listItem.textContent = participant.data.name;
          
          if (participant.id === state.currentUserId) {
            listItem.className = CSS_CLASSES.CURRENT_USER;
            listItem.textContent += ' (Tú)';
          }
          
          participantsList.appendChild(listItem);
        });
      } catch (error) {
        ChatUtils.handleFirebaseError('cargar participantes', error);
        participantsList.innerHTML = '<li>Error al cargar participantes</li>';
      }
    },
  
    async loadAvailableUsersForChat(chatId) {
      const userSelectionDiv = document.getElementById('add-user-selection');
      userSelectionDiv.innerHTML = '<p class="loading-text">Cargando usuarios disponibles...</p>';
      
      try {
        const [usersSnapshot, participantsSnapshot] = await Promise.all([
          firebaseRefs.users().once('value'),
          firebaseRefs.participants(chatId).once('value')
        ]);
        
        const users = usersSnapshot.val() || {};
        const participants = participantsSnapshot.val() || {};
        
        const availableUsers = Object.keys(users).filter(userId => !participants[userId]);
  
        if (availableUsers.length === 0) {
          userSelectionDiv.innerHTML = '<p class="no-users-message">No hay más usuarios disponibles para añadir</p>';
          elements.addUserForm.querySelector('button').disabled = true;
          return;
        }
        
        userSelectionDiv.innerHTML = `
          <div class="search-container">
            <i class="search-icon"></i>
            <input type="text" id="user-search-input" placeholder="Buscar por nombre..." class="search-input">
            <button type="button" class="clear-search" title="Limpiar búsqueda">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <p class="selection-header">Selecciona usuarios para añadir:</p>
          <div id="users-list" class="users-list"></div>
        `;
        
        elements.addUserForm.querySelector('button').disabled = false;
        
        const usersList = document.getElementById('users-list');
        
        const availableUsersData = {};
        availableUsers.forEach(userId => {
          availableUsersData[userId] = users[userId];
        });
        
        function renderFilteredUsers(filter = '') {
          usersList.innerHTML = '';
          const fragment = document.createDocumentFragment();
          let userCount = 0;
          
          if (!filter.trim()) {
            const searchPrompt = document.createElement('div');
            searchPrompt.className = 'search-prompt';
            searchPrompt.innerHTML = `
              <p>Escribe en el buscador para encontrar usuarios</p>
            `;
            usersList.appendChild(searchPrompt);
            return;
          }
          
          const filteredUsers = filter.trim() ? 
            Object.entries(availableUsersData).filter(([id, user]) => 
              user.name.toLowerCase().includes(filter.toLowerCase())
            ) :
            [];
          
          if (filteredUsers.length === 0) {
            const noResults = document.createElement('p');
            noResults.className = 'no-results';
            noResults.textContent = 'No se encontraron usuarios con ese nombre';
            usersList.appendChild(noResults);
            return;
          }
          
          filteredUsers.forEach(([userId, user], index) => {
            const userCheckbox = document.createElement('div');
            userCheckbox.className = 'user-checkbox';
            userCheckbox.innerHTML = `
              <label>
                <input type="checkbox" value="${userId}">
                <div class="user-info-container">
                  <div class="user-name">${highlightText(user.name, filter)}</div>
                  <div class="user-email">${user.email || 'Sin email'}</div>
                </div>
              </label>
            `;
            fragment.appendChild(userCheckbox);
            userCount++;
            
            setTimeout(() => {
              userCheckbox.classList.add('fade-in');
            }, index * 30);
          });
          
          usersList.appendChild(fragment);
          
          if (filter.trim()) {
            const resultsInfo = document.createElement('div');
            resultsInfo.className = 'results-info';
            resultsInfo.textContent = `Mostrando ${userCount} resultado${userCount !== 1 ? 's' : ''}`;
            usersList.insertBefore(resultsInfo, usersList.firstChild);
          }
        }
        
        function highlightText(text, filter) {
          if (!filter.trim()) return text;
          
          const filterLower = filter.toLowerCase();
          const textLower = text.toLowerCase();
          
          if (!textLower.includes(filterLower)) return text;
          
          const startIndex = textLower.indexOf(filterLower);
          const endIndex = startIndex + filterLower.length;
          
          const before = text.substring(0, startIndex);
          const match = text.substring(startIndex, endIndex);
          const after = text.substring(endIndex);
          
          return `${before}<span class="highlight">${match}</span>${after}`;
        }
        
        renderFilteredUsers('');
        
        const searchInput = document.getElementById('user-search-input');
        let debounceTimer;
        
        searchInput.addEventListener('input', function() {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            renderFilteredUsers(this.value.trim());
          }, 300);
        });
  
        searchInput.addEventListener('focus', function() {
          if (this.value) {
            this.select();
          }
        });
        
        const clearButton = userSelectionDiv.querySelector('.clear-search');
        clearButton.addEventListener('click', () => {
          searchInput.value = '';
          searchInput.focus();
          renderFilteredUsers('');
        });
        
      } catch (error) {
        ChatUtils.handleFirebaseError('cargar usuarios disponibles', error);
        userSelectionDiv.innerHTML = '<p class="error-message">Error al cargar usuarios disponibles</p>';
      }
    },
  
    async addUsersToChat(chatId, userIds) {
      console.log(`Añadiendo ${userIds.length} usuarios al chat ${chatId}`);
  
      const participantsSnapshot = await firebaseRefs.participants(chatId).once('value');
      const participantsCount = Object.keys(participantsSnapshot.val() || {}).length;
      
      if (participantsCount + userIds.length > 30) {
        alert('El chat alcanzaría demasiados participantes. Máximo permitido: 30.');
        return;
      }
      
      const addButton = elements.addUserForm.querySelector('button[type="submit"]');
      addButton.disabled = true;
      addButton.textContent = 'Añadiendo usuarios...';
      
      try {
        const updates = {};
        const successfulUsers = [];
        const errorUsers = [];
        
        for (const userId of userIds) {
          updates[`chatParticipants/${chatId}/${userId}`] = true;
          updates[`userChats/${userId}/${chatId}`] = true;
          successfulUsers.push(userId);
        }
        
        console.log("Obteniendo clave del chat para compartir");
        const chatKey = await ChatEncryption.getChatKeyForSharing(chatId);
        
        if (chatKey) {
          console.log("Clave del chat obtenida, intentando encriptar para cada usuario");
          
          updates[`chatKeys/${chatId}/shared`] = {
            encryptedKey: chatKey,
            algorithm: "none",
            timestamp: firebase.database.ServerValue.TIMESTAMP
          };
          
          for (const userId of userIds) {
            try {
              const encryptedKey = await ChatEncryption.encryptChatKeyForUser(chatId, userId);
              
              if (encryptedKey) {
                updates[`chatKeys/${chatId}/${userId}`] = encryptedKey;
                console.log(`Clave encriptada para usuario ${userId}`);
              } else {
                console.warn(`No se pudo encriptar la clave para usuario ${userId}`);
                errorUsers.push(userId);
              }
            } catch (error) {
              ChatUtils.handleFirebaseError(`encriptar clave para usuario ${userId}`, error);
              errorUsers.push(userId);
            }
          }
        } else {
          console.warn("No se pudo obtener la clave del chat para compartir");
        }
        
        const messageRef = firebase.database().ref().push().key;
        updates[`messages/${chatId}/${messageRef}`] = {
          encrypted: false,
          text: `[Mensaje del sistema: Se han añadido ${userIds.length} nuevos participantes]`,
          senderId: "system",
          senderName: "Sistema",
          timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref().update(updates);
        this.loadChatParticipants(chatId);
        this.loadAvailableUsersForChat(chatId);
        
        if (errorUsers.length > 0) {
          alert(`Usuarios añadidos al chat correctamente, pero ${errorUsers.length} pueden tener problemas para ver mensajes antiguos.`);
        } else {
          alert('Usuario(s) añadidos exitosamente');
        }
      } catch (error) {
        ChatUtils.handleFirebaseError('añadir usuarios', error);
        alert('Error al añadir usuarios. Por favor, inténtalo de nuevo.');
      } finally {
        addButton.disabled = false;
        addButton.textContent = 'Añadir usuarios';
      }
    },
  
    async leaveChat(chatId, chatName) {
      console.log(`Saliendo del chat: ${chatName} (${chatId})`);
      
      try {
        const chatSnapshot = await firebaseRefs.chat(chatId).once('value');
        const chatData = chatSnapshot.val() || {};
        
        if (chatData.createdBy === state.currentUserId) {
          const confirmDelete = confirm(`Eres el creador de "${chatName}". Si sales, la conversación se eliminará para todos los participantes. ¿Deseas continuar?`);
          
          if (confirmDelete) {
            await this.deleteChat(chatId);
            return;
          } else {
            return;
          }
        }
        
        const updates = {};
        updates[`chatParticipants/${chatId}/${state.currentUserId}`] = null;
        updates[`userChats/${state.currentUserId}/${chatId}`] = null;
        
        const messageRef = firebase.database().ref().push().key;
        updates[`messages/${chatId}/${messageRef}`] = {
          encrypted: false,
          text: `[Mensaje del sistema: ${state.currentUserName} ha salido del chat]`,
          senderId: "system",
          senderName: "Sistema",
          timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref().update(updates);
        
        console.log(`Usuario ${state.currentUserId} ha salido del chat ${chatId} exitosamente`);
        
        if (state.currentChatId === chatId) {
          state.currentChatId = null;
          elements.currentChatName.textContent = '';
          elements.messagesContainer.innerHTML = '';
          elements.messageInput.disabled = true;
          elements.messageForm.querySelector('button').disabled = true;
          
          ChatUI.showNoChatSelected();
        }
  
        alert(`Has salido de la conversación "${chatName}"`);
        
      } catch (error) {
        ChatUtils.handleFirebaseError('salir del chat', error);
        alert('Hubo un error al salir de la conversación. Por favor, inténtalo de nuevo.');
      }
    },
  
    async deleteChat(chatId) {
      try {
        const participantsSnapshot = await firebaseRefs.participants(chatId).once('value');
        const participants = participantsSnapshot.val() || {};
        
        const updates = {};
        
        Object.keys(participants).forEach(userId => {
          updates[`userChats/${userId}/${chatId}`] = null;
        });
        
        updates[`chats/${chatId}`] = null;
        updates[`chatParticipants/${chatId}`] = null;
        updates[`messages/${chatId}`] = null;
        
        await database.ref().update(updates);
        
        console.log(`Chat ${chatId} eliminado con éxito`);
        
        if (state.currentChatId === chatId) {
          state.currentChatId = null;
          elements.currentChatName.textContent = '';
          elements.messagesContainer.innerHTML = '';
          elements.messageInput.disabled = true;
          elements.messageForm.querySelector('button').disabled = true;
          
          ChatUI.showNoChatSelected();
        }
      } catch (error) {
        ChatUtils.handleFirebaseError('eliminar chat', error);
        alert('Hubo un error al eliminar la conversación. Por favor, inténtalo de nuevo.');
      }
    }
  };
  
  window.ChatParticipants = ChatParticipants;